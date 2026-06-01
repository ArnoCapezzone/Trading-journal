// MT5 AutoSync store — controls polling and surface state to UI
import { create } from 'zustand';
import {
  isFileSystemAccessSupported,
  loadHandle,
  persistHandle,
  clearHandle,
  queryPermission,
  requestPermission,
  pickDirectory,
  readCSVFile,
  describeHandle,
} from '../lib/mt5AutoSync';
import { parseMT5CSV } from '../utils/mt5Parser';
import { useTradesStore } from './tradesStore';
import { useAccountsStore } from '../lib/accountsStore';

const SETTINGS_KEY = 'tj_mt5_sync_settings_v1';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'no-permission';

interface PersistedSettings {
  enabled: boolean;
  pollIntervalSec: number;
  filename: string;
  targetAccountId: string;        // '' = active account at sync time
}

interface SyncState extends PersistedSettings {
  supported: boolean;
  hasHandle: boolean;
  permission: 'granted' | 'prompt' | 'denied' | 'unknown';
  status: SyncStatus;
  folderName: string;
  lastSyncAt: number;
  lastImportedCount: number;
  lastDuplicateCount: number;
  lastError: string;
  lastModifiedSeen: number;       // CSV mtime we last processed (avoid re-parsing identical content)
  initialized: boolean;

  initialize: () => Promise<void>;
  pickFolder: () => Promise<void>;
  enable: () => Promise<void>;
  disable: () => void;
  reauthorize: () => Promise<void>;
  setPollInterval: (sec: number) => void;
  setFilename: (name: string) => void;
  setTargetAccountId: (id: string) => void;
  syncNow: () => Promise<void>;
  clearFolder: () => Promise<void>;
}

function readSettings(): PersistedSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        enabled: !!p.enabled,
        pollIntervalSec: typeof p.pollIntervalSec === 'number' ? p.pollIntervalSec : 30,
        filename: typeof p.filename === 'string' ? p.filename : 'trading_journal_export.csv',
        targetAccountId: typeof p.targetAccountId === 'string' ? p.targetAccountId : '',
      };
    }
  } catch {}
  return {
    enabled: false,
    pollIntervalSec: 30,
    filename: 'trading_journal_export.csv',
    targetAccountId: '',
  };
}

function writeSettings(s: PersistedSettings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
}

// ── Polling loop (module-scoped, singleton) ─────────────────────
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let currentHandle: FileSystemDirectoryHandle | null = null;

function stopPolling() {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

async function performSync(): Promise<{ imported: number; duplicates: number; mtime: number | null }> {
  if (!currentHandle) throw new Error('No folder selected');

  const settings = useSyncStore.getState();
  const result = await readCSVFile(currentHandle, settings.filename);
  if (!result) {
    // File doesn't exist yet (MT5 hasn't exported)
    return { imported: 0, duplicates: 0, mtime: null };
  }

  // Skip if mtime hasn't changed
  if (result.lastModified <= settings.lastModifiedSeen) {
    return { imported: 0, duplicates: 0, mtime: result.lastModified };
  }

  // Parse + import
  const parsed = parseMT5CSV(result.content);
  if (parsed.length === 0) {
    return { imported: 0, duplicates: 0, mtime: result.lastModified };
  }

  const { imported, duplicates } = await useTradesStore.getState().importTrades(parsed);

  // Tag imported trades to target account
  if (imported > 0) {
    const targetAccountId = settings.targetAccountId || useAccountsStore.getState().activeId;
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

  return { imported, duplicates, mtime: result.lastModified };
}

async function scheduleNextPoll() {
  const settings = useSyncStore.getState();
  if (!settings.enabled || !currentHandle) return;
  pollTimer = setTimeout(async () => {
    await runPoll();
  }, settings.pollIntervalSec * 1000);
}

async function runPoll() {
  const store = useSyncStore;
  if (!currentHandle) return;
  try {
    store.setState({ status: 'syncing', lastError: '' });
    const { imported, duplicates, mtime } = await performSync();
    store.setState({
      status: 'idle',
      lastSyncAt: Date.now(),
      lastImportedCount: imported,
      lastDuplicateCount: duplicates,
      lastModifiedSeen: mtime ?? store.getState().lastModifiedSeen,
    });
  } catch (e) {
    store.setState({
      status: 'error',
      lastError: e instanceof Error ? e.message : String(e),
      lastSyncAt: Date.now(),
    });
  } finally {
    if (store.getState().enabled) scheduleNextPoll();
  }
}

// ── Zustand store ───────────────────────────────────────────────
export const useSyncStore = create<SyncState>((set, get) => ({
  ...readSettings(),
  supported: isFileSystemAccessSupported(),
  hasHandle: false,
  permission: 'unknown',
  status: 'idle',
  folderName: '',
  lastSyncAt: 0,
  lastImportedCount: 0,
  lastDuplicateCount: 0,
  lastError: '',
  lastModifiedSeen: 0,
  initialized: false,

  initialize: async () => {
    if (!get().supported) {
      set({ initialized: true });
      return;
    }
    const handle = await loadHandle();
    if (!handle) {
      set({ hasHandle: false, initialized: true });
      return;
    }
    currentHandle = handle;
    const perm = await queryPermission(handle);
    set({
      hasHandle: true,
      folderName: describeHandle(handle),
      permission: perm,
      initialized: true,
    });

    // Auto-resume polling if enabled and we have granted permission
    if (get().enabled && perm === 'granted') {
      // Run immediately, then schedule
      void runPoll();
    } else if (perm !== 'granted') {
      set({ status: 'no-permission' });
    }
  },

  pickFolder: async () => {
    if (!get().supported) {
      set({ lastError: 'File System Access API not supported in this browser. Use Chrome, Edge or Brave on desktop.' });
      return;
    }
    try {
      stopPolling();
      const handle = await pickDirectory();
      await persistHandle(handle);
      currentHandle = handle;
      const perm = await queryPermission(handle);
      set({
        hasHandle: true,
        folderName: describeHandle(handle),
        permission: perm,
        status: 'idle',
        lastError: '',
        lastModifiedSeen: 0,
      });
      // Auto-enable on first pick
      if (!get().enabled) {
        const next = { ...readSettings(), enabled: true };
        writeSettings(next);
        set({ enabled: true });
      }
      // Run an initial sync
      void runPoll();
    } catch (e) {
      // User dismissed the picker
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.toLowerCase().includes('aborted')) {
        set({ lastError: msg });
      }
    }
  },

  enable: async () => {
    if (!currentHandle) return;
    let perm = await queryPermission(currentHandle);
    if (perm !== 'granted') perm = await requestPermission(currentHandle);
    if (perm !== 'granted') {
      set({ permission: perm, status: 'no-permission', lastError: 'Permission denied' });
      return;
    }
    set({ enabled: true, permission: 'granted', status: 'idle', lastError: '' });
    writeSettings({
      enabled: true,
      pollIntervalSec: get().pollIntervalSec,
      filename: get().filename,
      targetAccountId: get().targetAccountId,
    });
    void runPoll();
  },

  disable: () => {
    stopPolling();
    set({ enabled: false, status: 'idle' });
    writeSettings({
      enabled: false,
      pollIntervalSec: get().pollIntervalSec,
      filename: get().filename,
      targetAccountId: get().targetAccountId,
    });
  },

  reauthorize: async () => {
    if (!currentHandle) return;
    const perm = await requestPermission(currentHandle);
    set({ permission: perm });
    if (perm === 'granted' && get().enabled) {
      set({ status: 'idle' });
      void runPoll();
    }
  },

  setPollInterval: (sec) => {
    set({ pollIntervalSec: sec });
    writeSettings({
      enabled: get().enabled,
      pollIntervalSec: sec,
      filename: get().filename,
      targetAccountId: get().targetAccountId,
    });
    // Restart cycle so the new interval takes effect immediately
    if (get().enabled) {
      stopPolling();
      void runPoll();
    }
  },

  setFilename: (name) => {
    set({ filename: name, lastModifiedSeen: 0 });
    writeSettings({
      enabled: get().enabled,
      pollIntervalSec: get().pollIntervalSec,
      filename: name,
      targetAccountId: get().targetAccountId,
    });
  },

  setTargetAccountId: (id) => {
    set({ targetAccountId: id });
    writeSettings({
      enabled: get().enabled,
      pollIntervalSec: get().pollIntervalSec,
      filename: get().filename,
      targetAccountId: id,
    });
  },

  syncNow: async () => {
    if (!currentHandle) return;
    // Reset mtime to force re-read
    set({ lastModifiedSeen: 0 });
    await runPoll();
  },

  clearFolder: async () => {
    stopPolling();
    currentHandle = null;
    await clearHandle();
    set({
      hasHandle: false,
      folderName: '',
      permission: 'unknown',
      status: 'idle',
      enabled: false,
      lastModifiedSeen: 0,
    });
    writeSettings({
      enabled: false,
      pollIntervalSec: get().pollIntervalSec,
      filename: get().filename,
      targetAccountId: get().targetAccountId,
    });
  },
}));
