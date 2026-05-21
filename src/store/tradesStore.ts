import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Trade, TradeFilters, TradeDirection, TradeSource, TradeStatus, SetupType, Timeframe } from '../types/trade';
import { supabase } from '../lib/supabase';
import {
  isAfter,
  isBefore,
  startOfDay,
  startOfWeek,
  startOfMonth,
  subMonths,
} from 'date-fns';

// ─── Supabase row ↔ Trade mapping ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToTrade(row: Record<string, any>): Trade {
  return {
    id: row.id,
    source: row.source as TradeSource,
    status: row.status as TradeStatus,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    instrument: row.instrument,
    direction: row.direction as TradeDirection,
    entryPrice: Number(row.entry_price),
    exitPrice: Number(row.exit_price),
    entryTime: new Date(row.entry_time),
    exitTime: new Date(row.exit_time),
    lotSize: Number(row.lot_size),
    stopLoss: row.stop_loss != null ? Number(row.stop_loss) : undefined,
    takeProfit: row.take_profit != null ? Number(row.take_profit) : undefined,
    commission: row.commission != null ? Number(row.commission) : undefined,
    swap: row.swap != null ? Number(row.swap) : undefined,
    mt5TicketId: row.mt5_ticket_id ?? undefined,
    mt5Profit: row.mt5_profit != null ? Number(row.mt5_profit) : undefined,
    timeframe: row.timeframe as Timeframe | undefined,
    setup: row.setup as SetupType | undefined,
    notes: row.notes ?? undefined,
    tags: row.tags ?? undefined,
    chartImageBase64: row.chart_image_base64 ?? undefined,
    accountBalanceAtEntry: row.account_balance_at_entry != null ? Number(row.account_balance_at_entry) : undefined,
  };
}

function tradeToRow(trade: Partial<Trade>, userId: string): Record<string, unknown> {
  const row: Record<string, unknown> = { user_id: userId };
  if (trade.id !== undefined)                    row.id = trade.id;
  if (trade.source !== undefined)                row.source = trade.source;
  if (trade.status !== undefined)                row.status = trade.status;
  if (trade.createdAt !== undefined)             row.created_at = trade.createdAt;
  if (trade.updatedAt !== undefined)             row.updated_at = trade.updatedAt;
  if (trade.instrument !== undefined)            row.instrument = trade.instrument;
  if (trade.direction !== undefined)             row.direction = trade.direction;
  if (trade.entryPrice !== undefined)            row.entry_price = trade.entryPrice;
  if (trade.exitPrice !== undefined)             row.exit_price = trade.exitPrice;
  if (trade.entryTime !== undefined)             row.entry_time = trade.entryTime;
  if (trade.exitTime !== undefined)              row.exit_time = trade.exitTime;
  if (trade.lotSize !== undefined)               row.lot_size = trade.lotSize;
  if (trade.stopLoss !== undefined)              row.stop_loss = trade.stopLoss;
  if (trade.takeProfit !== undefined)            row.take_profit = trade.takeProfit;
  if (trade.commission !== undefined)            row.commission = trade.commission;
  if (trade.swap !== undefined)                  row.swap = trade.swap;
  if (trade.mt5TicketId !== undefined)           row.mt5_ticket_id = trade.mt5TicketId;
  if (trade.mt5Profit !== undefined)             row.mt5_profit = trade.mt5Profit;
  if (trade.timeframe !== undefined)             row.timeframe = trade.timeframe;
  if (trade.setup !== undefined)                 row.setup = trade.setup;
  if (trade.notes !== undefined)                 row.notes = trade.notes;
  if (trade.tags !== undefined)                  row.tags = trade.tags;
  if (trade.chartImageBase64 !== undefined)      row.chart_image_base64 = trade.chartImageBase64;
  if (trade.accountBalanceAtEntry !== undefined) row.account_balance_at_entry = trade.accountBalanceAtEntry;
  return row;
}

// ─── Store ──────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: TradeFilters = {
  instruments: [],
  direction: 'ALL',
  status: 'ALL',
  setups: [],
  source: 'ALL',
  dateFrom: undefined,
  dateTo: undefined,
};

interface TradesState {
  trades: Trade[];
  isLoading: boolean;
  error: string | null;
  filters: TradeFilters;
  selectedPeriod: 'today' | 'week' | 'month' | '3months' | 'all';

  loadTrades: () => Promise<void>;
  addTrade: (trade: Omit<Trade, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Trade>;
  updateTrade: (id: string, updates: Partial<Trade>) => Promise<void>;
  deleteTrade: (id: string) => Promise<void>;
  importTrades: (trades: Partial<Trade>[]) => Promise<{ imported: number; duplicates: number }>;
  setFilters: (filters: Partial<TradeFilters>) => void;
  clearFilters: () => void;
  setSelectedPeriod: (period: TradesState['selectedPeriod']) => void;
  getFilteredTrades: () => Trade[];
  getPeriodTrades: () => Trade[];
}

export const useTradesStore = create<TradesState>((set, get) => ({
  trades: [],
  isLoading: false,
  error: null,
  filters: DEFAULT_FILTERS,
  selectedPeriod: 'all',

  loadTrades: async () => {
    set({ isLoading: true, error: null });
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .order('exit_time', { ascending: false });
    if (error) {
      set({ error: error.message, isLoading: false });
    } else {
      set({ trades: (data ?? []).map(rowToTrade), isLoading: false });
    }
  },

  addTrade: async (tradeData) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const now = new Date();
    const trade: Trade = { ...tradeData, id: uuidv4(), createdAt: now, updatedAt: now };
    const row = tradeToRow(trade, user.id);

    const { data, error } = await supabase.from('trades').insert(row).select().single();
    if (error) throw new Error(error.message);

    const inserted = rowToTrade(data);
    set((state) => ({ trades: [inserted, ...state.trades] }));
    return inserted;
  },

  updateTrade: async (id, updates) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const now = new Date();
    const row = tradeToRow({ ...updates, updatedAt: now }, user.id);
    delete row.user_id; // not needed for update

    const { error } = await supabase.from('trades').update(row).eq('id', id);
    if (error) throw new Error(error.message);

    set((state) => ({
      trades: state.trades.map((t) =>
        t.id === id ? { ...t, ...updates, updatedAt: now } : t
      ),
    }));
  },

  deleteTrade: async (id) => {
    const { error } = await supabase.from('trades').delete().eq('id', id);
    if (error) throw new Error(error.message);
    set((state) => ({ trades: state.trades.filter((t) => t.id !== id) }));
  },

  importTrades: async (newTrades) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Fetch existing ticket IDs to detect duplicates
    const { data: existingRows } = await supabase
      .from('trades')
      .select('id, mt5_ticket_id')
      .eq('user_id', user.id);

    const existingTickets = new Set(
      (existingRows ?? []).map((r) => r.mt5_ticket_id).filter(Boolean)
    );
    const existingIds = new Set((existingRows ?? []).map((r) => r.id));

    const toInsert: Record<string, unknown>[] = [];
    let duplicates = 0;

    for (const t of newTrades) {
      if (t.mt5TicketId && existingTickets.has(t.mt5TicketId)) { duplicates++; continue; }
      if (t.id && existingIds.has(t.id)) { duplicates++; continue; }

      const now = new Date();
      const trade: Trade = {
        id: t.id ?? uuidv4(),
        source: t.source ?? 'MT5_IMPORT',
        status: t.status ?? 'PENDING_REVIEW',
        createdAt: t.createdAt ?? now,
        updatedAt: now,
        instrument: t.instrument ?? 'UNKNOWN',
        direction: t.direction ?? 'LONG',
        entryPrice: t.entryPrice ?? 0,
        exitPrice: t.exitPrice ?? 0,
        entryTime: t.entryTime ?? now,
        exitTime: t.exitTime ?? now,
        lotSize: t.lotSize ?? 0,
        stopLoss: t.stopLoss,
        takeProfit: t.takeProfit,
        commission: t.commission,
        swap: t.swap,
        mt5TicketId: t.mt5TicketId,
        mt5Profit: t.mt5Profit,
        timeframe: t.timeframe,
        setup: t.setup,
        notes: t.notes,
        tags: t.tags,
        chartImageBase64: t.chartImageBase64,
        accountBalanceAtEntry: t.accountBalanceAtEntry,
      };
      toInsert.push(tradeToRow(trade, user.id));
    }

    if (toInsert.length > 0) {
      const { data, error } = await supabase.from('trades').insert(toInsert).select();
      if (error) throw new Error(error.message);
      const inserted = (data ?? []).map(rowToTrade);
      set((state) => ({ trades: [...inserted, ...state.trades] }));
    }

    return { imported: toInsert.length, duplicates };
  },

  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
  clearFilters: () => set({ filters: DEFAULT_FILTERS }),
  setSelectedPeriod: (period) => set({ selectedPeriod: period }),

  getFilteredTrades: () => {
    const { trades, filters } = get();
    return trades
      .filter((t) => {
        if (filters.instruments.length > 0 && !filters.instruments.includes(t.instrument)) return false;
        if (filters.direction !== 'ALL' && t.direction !== filters.direction) return false;
        if (filters.status !== 'ALL' && t.status !== filters.status) return false;
        if (filters.setups.length > 0 && (!t.setup || !filters.setups.includes(t.setup))) return false;
        if (filters.source !== 'ALL' && t.source !== filters.source) return false;
        if (filters.dateFrom && isBefore(new Date(t.exitTime), startOfDay(filters.dateFrom))) return false;
        if (filters.dateTo && isAfter(new Date(t.exitTime), startOfDay(filters.dateTo))) return false;
        return true;
      })
      .sort((a, b) => new Date(b.exitTime).getTime() - new Date(a.exitTime).getTime());
  },

  getPeriodTrades: () => {
    const { trades, selectedPeriod } = get();
    const now = new Date();
    let fromDate: Date | null = null;
    switch (selectedPeriod) {
      case 'today':    fromDate = startOfDay(now); break;
      case 'week':     fromDate = startOfWeek(now, { weekStartsOn: 1 }); break;
      case 'month':    fromDate = startOfMonth(now); break;
      case '3months':  fromDate = subMonths(now, 3); break;
      default:         fromDate = null;
    }
    return trades
      .filter((t) => !fromDate || !isBefore(new Date(t.exitTime), fromDate))
      .sort((a, b) => new Date(b.exitTime).getTime() - new Date(a.exitTime).getTime());
  },
}));
