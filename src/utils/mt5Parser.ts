import Papa from 'papaparse';
import type { Trade, TradeDirection } from '../types/trade';
import { parseISO, parse } from 'date-fns';

function parseDateFlexible(str: string): Date {
  if (!str) return new Date();
  // Try ISO format
  const iso = parseISO(str);
  if (!isNaN(iso.getTime())) return iso;
  // Try MT5 format: "2024.01.15 10:30:00"
  try {
    const fmt1 = parse(str, 'yyyy.MM.dd HH:mm:ss', new Date());
    if (!isNaN(fmt1.getTime())) return fmt1;
  } catch {}
  // Try "2024-01-15 10:30:00"
  try {
    const fmt2 = parse(str, 'yyyy-MM-dd HH:mm:ss', new Date());
    if (!isNaN(fmt2.getTime())) return fmt2;
  } catch {}
  return new Date(str);
}

function normalizeMT5Symbol(symbol: string): string {
  return symbol.replace(/[^A-Z0-9]/gi, '').toUpperCase();
}

function parseMT5Direction(type: string): TradeDirection {
  const t = type.toLowerCase();
  if (t.includes('buy') || t === 'in') return 'LONG';
  if (t.includes('sell')) return 'SHORT';
  return 'LONG';
}

// MT5 CSV — supports two formats:
// 1. ExportTradingJournal.mq5 script output:
//    Ticket,Open Time,Type,Size,Symbol,Price,S/L,T/P,Close Time,Close Price,Swap,Profit,Commission,Position ID,Comment
// 2. MT5 native "Save as Report" CSV:
//    Ticket,Open Time,Type,Size,Symbol,Price,S/L,T/P,Close Time,Close Price,Swap,Profit,Commission
export function parseMT5CSV(csvContent: string): Partial<Trade>[] {
  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const trades: Partial<Trade>[] = [];

  for (const row of result.data) {
    const type = (row['Type'] ?? row['type'] ?? '').trim();
    // Skip non-trade rows (balance, credit, etc.)
    if (!type.toLowerCase().includes('buy') && !type.toLowerCase().includes('sell')) continue;

    const ticket = (
      row['Ticket'] ?? row['ticket'] ?? row['Position ID'] ?? row['Deal'] ?? row['deal'] ?? ''
    ).trim();
    const openTime  = row['Open Time']   ?? row['open time']   ?? row['Open time']   ?? '';
    const closeTime = row['Close Time']  ?? row['close time']  ?? row['Close time']  ?? '';
    const symbol    = row['Symbol']      ?? row['symbol']      ?? '';
    const price      = parseFloat(row['Price']       ?? row['price']       ?? '0');
    const closePrice = parseFloat(row['Close Price'] ?? row['close price'] ?? row['Close price'] ?? '0');
    const size       = parseFloat(row['Size']        ?? row['size']        ?? row['Volume'] ?? '0');
    const sl         = parseFloat(row['S/L']         ?? row['s/l']         ?? row['SL']    ?? '0');
    const tp         = parseFloat(row['T/P']         ?? row['t/p']         ?? row['TP']    ?? '0');
    const swap       = parseFloat(row['Swap']        ?? row['swap']        ?? '0');
    const commission = parseFloat(row['Commission']  ?? row['commission']  ?? '0');

    const profit = parseFloat(row['Profit'] ?? row['profit'] ?? 'NaN');

    if (!symbol || isNaN(price) || isNaN(closePrice) || isNaN(size) || size <= 0) continue;
    if (price <= 0 || closePrice <= 0) continue;

    trades.push({
      source: 'MT5_IMPORT',
      status: 'PENDING_REVIEW',
      instrument: normalizeMT5Symbol(symbol),
      direction: parseMT5Direction(type),
      entryPrice: price,
      exitPrice: closePrice,
      entryTime: parseDateFlexible(openTime),
      exitTime: parseDateFlexible(closeTime),
      lotSize: size,
      stopLoss: sl !== 0 && !isNaN(sl) ? sl : undefined,
      takeProfit: tp !== 0 && !isNaN(tp) ? tp : undefined,
      swap: isNaN(swap) ? 0 : swap,
      commission: isNaN(commission) ? 0 : Math.abs(commission),
      mt5TicketId: ticket || undefined,
      mt5Profit: !isNaN(profit) ? profit : undefined,
    });
  }

  return trades;
}

// JSON format from mt5_export.py
interface MT5JsonTrade {
  ticket: string | number;
  symbol: string;
  type: string;
  volume: number;
  open_time: string;
  open_price: number;
  sl: number;
  tp: number;
  close_time: string;
  close_price: number;
  swap: number;
  profit: number;
  commission: number;
}

export function parseMT5JSON(jsonContent: string): Partial<Trade>[] {
  let data: MT5JsonTrade[] = [];
  try {
    const parsed = JSON.parse(jsonContent);
    data = Array.isArray(parsed) ? parsed : (parsed.trades ?? []);
  } catch {
    return [];
  }

  return data.map((item) => ({
    source: 'MT5_IMPORT' as const,
    status: 'PENDING_REVIEW' as const,
    instrument: normalizeMT5Symbol(item.symbol ?? ''),
    direction: parseMT5Direction(item.type ?? ''),
    entryPrice: item.open_price ?? 0,
    exitPrice: item.close_price ?? 0,
    entryTime: parseDateFlexible(item.open_time ?? ''),
    exitTime: parseDateFlexible(item.close_time ?? ''),
    lotSize: item.volume ?? 0,
    stopLoss: item.sl !== 0 ? item.sl : undefined,
    takeProfit: item.tp !== 0 ? item.tp : undefined,
    swap: item.swap ?? 0,
    commission: Math.abs(item.commission ?? 0),
    mt5TicketId: String(item.ticket ?? ''),
  }));
}

export function detectDuplicates(
  newTrades: Partial<Trade>[],
  existingTrades: Trade[]
): { toImport: Partial<Trade>[]; duplicates: Partial<Trade>[] } {
  const existingTickets = new Set(
    existingTrades.map((t) => t.mt5TicketId).filter(Boolean)
  );
  const existingKeys = new Set(
    existingTrades.map(
      (t) =>
        `${t.instrument}_${t.entryTime}_${t.exitTime}_${t.lotSize}`
    )
  );

  const toImport: Partial<Trade>[] = [];
  const duplicates: Partial<Trade>[] = [];

  for (const t of newTrades) {
    const ticketDup = t.mt5TicketId && existingTickets.has(t.mt5TicketId);
    const keyDup = existingKeys.has(
      `${t.instrument}_${t.entryTime}_${t.exitTime}_${t.lotSize}`
    );

    if (ticketDup || keyDup) {
      duplicates.push(t);
    } else {
      toImport.push(t);
    }
  }

  return { toImport, duplicates };
}
