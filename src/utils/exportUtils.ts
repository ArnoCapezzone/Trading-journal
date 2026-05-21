import type { Trade } from '../types/trade';
import { calculateTrade } from './calculations';
import { format } from 'date-fns';

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportToCSV(trades: Trade[]): void {
  const headers = [
    'ID',
    'Date Entry',
    'Date Exit',
    'Instrument',
    'Direction',
    'Entry Price',
    'Exit Price',
    'Lot Size',
    'Stop Loss',
    'Take Profit',
    'Commission',
    'Swap',
    'P&L Pips',
    'P&L Dollar',
    'Duration (min)',
    'R:R',
    'Setup',
    'Timeframe',
    'Status',
    'Source',
    'MT5 Ticket',
    'Tags',
    'Notes',
  ];

  const rows = trades.map((t) => {
    const calc = calculateTrade(t);
    return [
      t.id,
      format(new Date(t.entryTime), 'yyyy-MM-dd HH:mm:ss'),
      format(new Date(t.exitTime), 'yyyy-MM-dd HH:mm:ss'),
      t.instrument,
      t.direction,
      t.entryPrice,
      t.exitPrice,
      t.lotSize,
      t.stopLoss ?? '',
      t.takeProfit ?? '',
      t.commission ?? 0,
      t.swap ?? 0,
      calc.pnlPips.toFixed(1),
      calc.pnlDollar.toFixed(2),
      calc.durationMinutes,
      calc.rrRatio !== null ? calc.rrRatio.toFixed(2) : '',
      t.setup ?? '',
      t.timeframe ?? '',
      t.status,
      t.source,
      t.mt5TicketId ?? '',
      (t.tags ?? []).join('; '),
      (t.notes ?? '').replace(/,/g, ';'),
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
  });

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const date = format(new Date(), 'yyyy-MM-dd');
  downloadBlob(csvContent, `trading-journal-${date}.csv`, 'text/csv;charset=utf-8;');
}

export function exportToJSON(trades: Trade[]): void {
  const data = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    count: trades.length,
    trades: trades.map((t) => ({
      ...t,
      entryTime: new Date(t.entryTime).toISOString(),
      exitTime: new Date(t.exitTime).toISOString(),
      createdAt: new Date(t.createdAt).toISOString(),
      updatedAt: new Date(t.updatedAt).toISOString(),
    })),
  };

  const jsonContent = JSON.stringify(data, null, 2);
  const date = format(new Date(), 'yyyy-MM-dd');
  downloadBlob(
    jsonContent,
    `trading-journal-backup-${date}.json`,
    'application/json'
  );
}

export function importFromJSON(jsonContent: string): Trade[] {
  const data = JSON.parse(jsonContent);
  const rawTrades = Array.isArray(data) ? data : (data.trades ?? []);

  return rawTrades.map(
    (t: Record<string, unknown>): Trade => ({
      id: String(t.id ?? ''),
      source: (t.source as Trade['source']) ?? 'MANUAL',
      status: (t.status as Trade['status']) ?? 'COMPLETE',
      createdAt: new Date(t.createdAt as string),
      updatedAt: new Date(t.updatedAt as string),
      instrument: String(t.instrument ?? ''),
      direction: (t.direction as Trade['direction']) ?? 'LONG',
      entryPrice: Number(t.entryPrice ?? 0),
      exitPrice: Number(t.exitPrice ?? 0),
      entryTime: new Date(t.entryTime as string),
      exitTime: new Date(t.exitTime as string),
      lotSize: Number(t.lotSize ?? 0),
      stopLoss: t.stopLoss !== undefined ? Number(t.stopLoss) : undefined,
      takeProfit: t.takeProfit !== undefined ? Number(t.takeProfit) : undefined,
      commission: t.commission !== undefined ? Number(t.commission) : undefined,
      swap: t.swap !== undefined ? Number(t.swap) : undefined,
      mt5TicketId: t.mt5TicketId ? String(t.mt5TicketId) : undefined,
      timeframe: t.timeframe as Trade['timeframe'],
      setup: t.setup as Trade['setup'],
      notes: t.notes ? String(t.notes) : undefined,
      tags: Array.isArray(t.tags) ? (t.tags as string[]) : undefined,
      chartImageBase64: t.chartImageBase64 ? String(t.chartImageBase64) : undefined,
      accountBalanceAtEntry: t.accountBalanceAtEntry
        ? Number(t.accountBalanceAtEntry)
        : undefined,
    })
  );
}

export function generateCSVTemplate(): void {
  const headers = [
    'instrument',
    'direction',
    'entryTime',
    'exitTime',
    'entryPrice',
    'exitPrice',
    'lotSize',
    'stopLoss',
    'takeProfit',
    'commission',
    'swap',
    'setup',
    'timeframe',
    'notes',
    'tags',
  ];

  const example = [
    'EURUSD',
    'LONG',
    '2024-01-15 09:30:00',
    '2024-01-15 14:45:00',
    '1.08500',
    '1.09200',
    '0.10',
    '1.08000',
    '1.09500',
    '0',
    '0',
    'BREAKOUT',
    '1H',
    'Nice breakout trade',
    'morning;london',
  ];

  const csvContent = [headers.join(','), example.join(',')].join('\n');
  downloadBlob(csvContent, 'trading-journal-template.csv', 'text/csv;charset=utf-8;');
}

export function parseCustomCSV(csvContent: string): Partial<Trade>[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const trades: Partial<Trade>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] ?? '';
    });

    const direction = row.direction?.toUpperCase();
    if (direction !== 'LONG' && direction !== 'SHORT') continue;

    trades.push({
      source: 'MANUAL',
      status: 'COMPLETE',
      instrument: row.instrument ?? '',
      direction: direction as Trade['direction'],
      entryTime: new Date(row.entryTime ?? ''),
      exitTime: new Date(row.exitTime ?? ''),
      entryPrice: parseFloat(row.entryPrice ?? '0'),
      exitPrice: parseFloat(row.exitPrice ?? '0'),
      lotSize: parseFloat(row.lotSize ?? '0'),
      stopLoss: row.stopLoss ? parseFloat(row.stopLoss) : undefined,
      takeProfit: row.takeProfit ? parseFloat(row.takeProfit) : undefined,
      commission: row.commission ? parseFloat(row.commission) : 0,
      swap: row.swap ? parseFloat(row.swap) : 0,
      setup: row.setup as Trade['setup'],
      timeframe: row.timeframe as Trade['timeframe'],
      notes: row.notes ?? '',
      tags: row.tags ? row.tags.split(';').map((t) => t.trim()).filter(Boolean) : [],
    });
  }

  return trades;
}
