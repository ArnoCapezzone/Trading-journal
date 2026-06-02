// MT5 AutoSync store — EA webhook via Vercel + Supabase
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { parseMT5CSV } from '../utils/mt5Parser';
import { useTradesStore } from './tradesStore';
import { useAccountsStore } from '../lib/accountsStore';

const SETTINGS_KEY = 'tj_mt5_sync_settings_v1';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'disconnected';

interface PersistedSettings {
  enabled: boolean;
  pollIntervalSec: number;
  targetAccountId: string;
}

interface WebhookCreds {
  userId: string;
  token: string;
}

interface SyncState extends PersistedSettings {
  status: SyncStatus;
  lastSyncAt: number;
  lastImportedCount: number;
  lastDuplicateCount: number;
  lastError: string;
  initialized: boolean;
  creds: WebhookCreds | null;   // loaded from /api/mt5token on init
  loadingCreds: boolean;

  initialize: () => Promise<void>;
  loadCreds: () => Promise<void>;
  regenerateToken: () => Promise<void>;
  enable: () => void;
  disable: () => void;
  setPollInterval: (sec: number) => void;
  setTargetAccountId: (id: string) => void;
  syncNow: () => Promise<void>;
}

function readSettings(): PersistedSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<PersistedSettings>;
      return {
        enabled: !!p.enabled,
        pollIntervalSec: typeof p.pollIntervalSec === 'number' ? p.pollIntervalSec : 300,
        targetAccountId: typeof p.targetAccountId === 'string' ? p.targetAccountId : '',
      };
    }
  } catch {}
  return { enabled: false, pollIntervalSec: 300, targetAccountId: '' };
}

function writeSettings(s: PersistedSettings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
}

// ── Polling loop ──────────────────────────────────────────────────
let pollTimer: ReturnType<typeof setTimeout> | null = null;

function stopPolling() {
  if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
}

async function performSync(): Promise<{ imported: number; duplicates: number }> {
  const { creds } = useSyncStore.getState();
  if (!creds) throw new Error('Not connected');

  // Fetch trades from Supabase
  const { data, error } = await supabase
    .from('mt5_sync')
    .select('trades')
    .eq('user_id', creds.userId)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(error.message);
  if (!data?.trades || !Array.isArray(data.trades) || data.trades.length === 0) {
    return { imported: 0, duplicates: 0 };
  }

  // Convert raw trade objects to CSV-like format for the existing parser,
  // OR import directly since they already match our Partial<Trade> shape
  const trades = data.trades as Record<string, unknown>[];

  // Map from EA JSON format to Partial<Trade>
  const mapped = trades.map((t) => ({
    source: 'MT5_IMPORT' as const,
    status: 'PENDING_REVIEW' as const,
    instrument: String(t.symbol ?? '').replace(/[^A-Z0-9]/gi, '').toUpperCase(),
    direction: (String(t.type ?? '').toLowerCase().includes('buy') ? 'LONG' : 'SHORT') as 'LONG' | 'SHORT',
    entryPrice: Number(t.open_price ?? 0),
    exitPrice: Number(t.close_price ?? 0),
    entryTime: new Date(String(t.open_time ?? '')),
    exitTime: new Date(String(t.close_time ?? '')),
    lotSize: Number(t.size ?? 0),
    stopLoss: Number(t.sl ?? 0) || undefined,
    takeProfit: Number(t.tp ?? 0) || undefined,
    swap: Number(t.swap ?? 0),
    commission: Math.abs(Number(t.commission ?? 0)),
    mt5TicketId: String(t.ticket ?? ''),
    mt5Profit: Number(t.profit ?? 0),
  })).filter((t) => t.instrument && t.entryPrice > 0 && t.exitPrice > 0 && t.lotSize > 0);

  if (mapped.length === 0) return { imported: 0, duplicates: 0 };

  const { imported, duplicates } = await useTradesStore.getState().importTrades(mapped);

  if (imported > 0) {
    const state = useSyncStore.getState();
    const targetAccountId = state.targetAccountId || useAccountsStore.getState().activeId;
    const finalAccountId = targetAccountId === 'all'
      ? (useAccountsStore.getState().accounts[0]?.id ?? '')
      : targetAccountId;

    if (finalAccountId) {
      const allTrades = useTradesStore.getState().trades;
      const tradeMap = useAccountsStore.getState().tradeMap;
      const recentlyImported = allTrades.filter((t) => !tradeMap[t.id] && t.source === 'MT5_IMPORT');
      for (const t of recentlyImported) {
        useAccountsStore.getState().assignTrade(t.id, finalAccountId);
      }
    }
  }

  return { imported, duplicates };
}

async function runPoll() {
  const store = useSyncStore;
  try {
    store.setState({ status: 'syncing', lastError: '' });
    const { imported, duplicates } = await performSync();
    store.setState({ status: 'idle', lastSyncAt: Date.now(), lastImportedCount: imported, lastDuplicateCount: duplicates });
  } catch (e) {
    store.setState({ status: 'error', lastError: e instanceof Error ? e.message : String(e), lastSyncAt: Date.now() });
  } finally {
    const s = store.getState();
    if (s.enabled) {
      pollTimer = setTimeout(() => { void runPoll(); }, s.pollIntervalSec * 1000);
    }
  }
}

// ── Zustand store ─────────────────────────────────────────────────
export const useSyncStore = create<SyncState>((set, get) => ({
  ...readSettings(),
  status: 'disconnected',
  lastSyncAt: 0,
  lastImportedCount: 0,
  lastDuplicateCount: 0,
  lastError: '',
  initialized: false,
  creds: null,
  loadingCreds: false,

  initialize: async () => {
    set({ initialized: true });
    await get().loadCreds();
  },

  loadCreds: async () => {
    set({ loadingCreds: true });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { set({ loadingCreds: false, status: 'disconnected' }); return; }

      const res = await fetch('/api/mt5token', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) { set({ loadingCreds: false, status: 'error', lastError: 'Failed to load webhook token' }); return; }

      const { userId, token } = await res.json() as { userId: string; token: string };
      set({ creds: { userId, token }, status: 'idle', loadingCreds: false });

      if (get().enabled) { stopPolling(); void runPoll(); }
    } catch (e) {
      set({ loadingCreds: false, status: 'error', lastError: (e as Error).message });
    }
  },

  regenerateToken: async () => {
    set({ loadingCreds: true });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      // Clear existing token to force regeneration
      await supabase.auth.updateUser({ data: { mt5_token: null } });
      await get().loadCreds();
    } catch (e) {
      set({ loadingCreds: false, lastError: (e as Error).message });
    }
  },

  enable: () => {
    if (!get().creds) return;
    set({ enabled: true, status: 'idle', lastError: '' });
    writeSettings({ enabled: true, pollIntervalSec: get().pollIntervalSec, targetAccountId: get().targetAccountId });
    void runPoll();
  },

  disable: () => {
    stopPolling();
    set({ enabled: false, status: 'idle' });
    writeSettings({ enabled: false, pollIntervalSec: get().pollIntervalSec, targetAccountId: get().targetAccountId });
  },

  setPollInterval: (sec) => {
    set({ pollIntervalSec: sec });
    writeSettings({ enabled: get().enabled, pollIntervalSec: sec, targetAccountId: get().targetAccountId });
    if (get().enabled) { stopPolling(); void runPoll(); }
  },

  setTargetAccountId: (id) => {
    set({ targetAccountId: id });
    writeSettings({ enabled: get().enabled, pollIntervalSec: get().pollIntervalSec, targetAccountId: id });
  },

  syncNow: async () => {
    if (!get().creds) return;
    await runPoll();
  },
}));

// Keep parseMT5CSV imported to avoid dead code warning
void parseMT5CSV;
