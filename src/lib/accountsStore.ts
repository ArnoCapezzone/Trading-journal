// Multi-account management — localStorage based (no DB migration needed)
import { create } from 'zustand';
import type { Trade } from '../types/trade';

export type AccountType = 'LIVE' | 'DEMO' | 'PROP_FIRM' | 'OTHER';

export interface Account {
  id: string;
  name: string;
  broker: string;
  type: AccountType;
  initialBalance: number;
  currency: 'USD' | 'EUR';
  color: string;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

const ACCOUNTS_KEY = 'tj_accounts_v1';
const TRADE_MAP_KEY = 'tj_trade_accounts_v1';
const ACTIVE_KEY = 'tj_active_account_v1';

export const ACCOUNT_COLORS = [
  '#3D8EF0', '#00C47A', '#8B6CF0', '#F0A030',
  '#F04848', '#5AA0F5', '#00BFB3', '#FF7AB6',
];

// ── Local IO ────────────────────────────────────────────────────
function readAccounts(): Account[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function writeAccounts(items: Account[]) {
  try { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(items)); } catch {}
}

function readTradeMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(TRADE_MAP_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : {};
  } catch { return {}; }
}

function writeTradeMap(map: Record<string, string>) {
  try { localStorage.setItem(TRADE_MAP_KEY, JSON.stringify(map)); } catch {}
}

function readActive(): string {
  try {
    return localStorage.getItem(ACTIVE_KEY) || 'all';
  } catch { return 'all'; }
}

function writeActive(id: string) {
  try { localStorage.setItem(ACTIVE_KEY, id); } catch {}
}

// ── Zustand store ───────────────────────────────────────────────
interface AccountsState {
  accounts: Account[];
  tradeMap: Record<string, string>;
  activeId: string;  // 'all' or account.id
  initialized: boolean;

  initialize: (existingTrades: Trade[]) => void;

  addAccount: (data: Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'archived'>) => Account;
  updateAccount: (id: string, patch: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  setActive: (id: string) => void;

  assignTrade: (tradeId: string, accountId: string | null) => void;
  bulkAssign: (tradeIds: string[], accountId: string) => void;
  getActiveAccount: () => Account | null;
}

export const useAccountsStore = create<AccountsState>((set, get) => ({
  accounts: [],
  tradeMap: {},
  activeId: 'all',
  initialized: false,

  initialize: (existingTrades) => {
    let accounts = readAccounts();
    let tradeMap = readTradeMap();
    let activeId = readActive();

    // First-run: create default "Main Account" and assign all existing trades
    if (accounts.length === 0) {
      const defaultAcc: Account = {
        id: crypto.randomUUID(),
        name: 'Main Account',
        broker: '',
        type: 'LIVE',
        initialBalance: 10000,
        currency: 'USD',
        color: '#3D8EF0',
        archived: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      accounts = [defaultAcc];
      writeAccounts(accounts);

      // Assign all existing trades to the default account
      const newMap: Record<string, string> = {};
      for (const t of existingTrades) {
        if (!tradeMap[t.id]) newMap[t.id] = defaultAcc.id;
      }
      tradeMap = { ...tradeMap, ...newMap };
      writeTradeMap(tradeMap);
    }

    // Validate activeId
    if (activeId !== 'all' && !accounts.find((a) => a.id === activeId)) {
      activeId = 'all';
      writeActive(activeId);
    }

    set({ accounts, tradeMap, activeId, initialized: true });
  },

  addAccount: (data) => {
    const account: Account = {
      ...data,
      id: crypto.randomUUID(),
      archived: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const next = [...get().accounts, account];
    writeAccounts(next);
    set({ accounts: next });
    return account;
  },

  updateAccount: (id, patch) => {
    const next = get().accounts.map((a) =>
      a.id === id ? { ...a, ...patch, updatedAt: Date.now() } : a
    );
    writeAccounts(next);
    set({ accounts: next });
  },

  deleteAccount: (id) => {
    const remaining = get().accounts.filter((a) => a.id !== id);
    writeAccounts(remaining);

    // Unassign trades from this account
    const map = { ...get().tradeMap };
    let changed = false;
    for (const tradeId of Object.keys(map)) {
      if (map[tradeId] === id) {
        delete map[tradeId];
        changed = true;
      }
    }
    if (changed) writeTradeMap(map);

    const activeId = get().activeId === id ? 'all' : get().activeId;
    writeActive(activeId);

    set({ accounts: remaining, tradeMap: map, activeId });
  },

  setActive: (id) => {
    writeActive(id);
    set({ activeId: id });
  },

  assignTrade: (tradeId, accountId) => {
    const map = { ...get().tradeMap };
    if (accountId) map[tradeId] = accountId;
    else delete map[tradeId];
    writeTradeMap(map);
    set({ tradeMap: map });
  },

  bulkAssign: (tradeIds, accountId) => {
    const map = { ...get().tradeMap };
    for (const tid of tradeIds) map[tid] = accountId;
    writeTradeMap(map);
    set({ tradeMap: map });
  },

  getActiveAccount: () => {
    const { accounts, activeId } = get();
    if (activeId === 'all') return null;
    return accounts.find((a) => a.id === activeId) ?? null;
  },
}));

// ── Helpers (non-hook) ──────────────────────────────────────────
export function filterTradesByAccount(
  trades: Trade[],
  activeId: string,
  tradeMap: Record<string, string>
): Trade[] {
  if (activeId === 'all') return trades;
  return trades.filter((t) => tradeMap[t.id] === activeId);
}

export function getAccountTypeLabel(type: AccountType): string {
  switch (type) {
    case 'LIVE': return 'Live';
    case 'DEMO': return 'Demo';
    case 'PROP_FIRM': return 'Prop Firm';
    case 'OTHER': return 'Other';
  }
}

export function getAccountTypeColor(type: AccountType): string {
  switch (type) {
    case 'LIVE': return '#00C47A';
    case 'DEMO': return '#8E97AC';
    case 'PROP_FIRM': return '#8B6CF0';
    case 'OTHER': return '#3D8EF0';
  }
}
