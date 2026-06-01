// MT5 AutoSync — watches a user-selected folder for the CSV export from MQL5
// and auto-imports new trades. Uses the File System Access API (Chrome / Edge /
// Brave / Opera on desktop only).
//
// Architecture:
//  1. User picks the MQL5/Files directory once. We persist the handle to IDB.
//  2. On every poll, we read the configured CSV file, parse it, and pass new
//     trades to the consumer. Deduplication is already handled by
//     useTradesStore.importTrades() via mt5_ticket_id.

const DB_NAME = 'tj_mt5_sync';
const STORE_NAME = 'handles';
const HANDLE_KEY = 'mt5_dir';

// ── Feature detection ───────────────────────────────────────────
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined'
    && 'showDirectoryPicker' in window
    && typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';
}

// ── IndexedDB persistence ───────────────────────────────────────
function openSyncDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function persistHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openSyncDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function clearHandle(): Promise<void> {
  try {
    const db = await openSyncDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(HANDLE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { /* ignore */ }
}

// ── Permissions ─────────────────────────────────────────────────
type PermState = 'granted' | 'prompt' | 'denied';

interface HandleWithPermission {
  queryPermission?(opts: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission?(opts: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
}

export async function queryPermission(handle: FileSystemDirectoryHandle): Promise<PermState> {
  const h = handle as unknown as HandleWithPermission;
  if (!h.queryPermission) return 'prompt';
  const state = await h.queryPermission({ mode: 'read' });
  return state as PermState;
}

export async function requestPermission(handle: FileSystemDirectoryHandle): Promise<PermState> {
  const h = handle as unknown as HandleWithPermission;
  if (!h.requestPermission) return 'denied';
  const state = await h.requestPermission({ mode: 'read' });
  return state as PermState;
}

// ── Directory picker ────────────────────────────────────────────
export async function pickDirectory(): Promise<FileSystemDirectoryHandle> {
  type SDP = (opts?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
  const showDirectoryPicker = (window as unknown as { showDirectoryPicker: SDP }).showDirectoryPicker;
  return await showDirectoryPicker({ mode: 'read' });
}

// ── Read CSV ────────────────────────────────────────────────────
export interface ReadResult {
  content: string;
  lastModified: number;
  size: number;
}

export async function readCSVFile(
  dirHandle: FileSystemDirectoryHandle,
  filename = 'trading_journal_export.csv'
): Promise<ReadResult | null> {
  try {
    const fileHandle = await dirHandle.getFileHandle(filename);
    const file = await fileHandle.getFile();
    const content = await file.text();
    return { content, lastModified: file.lastModified, size: file.size };
  } catch (e) {
    // File doesn't exist or unreadable
    const msg = (e as Error).message ?? '';
    if (msg.includes('NotFoundError') || (e as Error).name === 'NotFoundError') return null;
    throw e;
  }
}

// ── Helper: human-readable path hint ────────────────────────────
export function describeHandle(handle: FileSystemDirectoryHandle | null): string {
  if (!handle) return '—';
  return handle.name;
}
