// File System Access API helpers for MT5 AutoSync.
// Handles persist across reloads via IndexedDB (FSA handles aren't JSON-serialisable).

const IDB_NAME = 'tj_fsa';
const IDB_STORE = 'handles';
const IDB_KEY = 'mt5_dir';

// ── Feature detection ─────────────────────────────────────────────
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

// ── IndexedDB helpers ─────────────────────────────────────────────
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function persistHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(handle, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDB();
    return await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function clearHandle(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {}
}

// ── Permission helpers ────────────────────────────────────────────
type PermissionState = 'granted' | 'prompt' | 'denied';

export async function queryPermission(
  handle: FileSystemDirectoryHandle,
): Promise<PermissionState> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await (handle as any).queryPermission({ mode: 'read' }) as PermissionState;
  } catch {
    return 'prompt';
  }
}

export async function requestPermission(
  handle: FileSystemDirectoryHandle,
): Promise<PermissionState> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await (handle as any).requestPermission({ mode: 'read' }) as PermissionState;
  } catch {
    return 'denied';
  }
}

// ── Directory picker ──────────────────────────────────────────────
export async function pickDirectory(): Promise<FileSystemDirectoryHandle> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return await (window as any).showDirectoryPicker({ mode: 'read', startIn: 'desktop' });
}

export function describeHandle(handle: FileSystemDirectoryHandle): string {
  return handle.name;
}

// ── CSV reader ────────────────────────────────────────────────────
export interface CSVReadResult {
  content: string;
  lastModified: number;
}

export async function readCSVFile(
  dir: FileSystemDirectoryHandle,
  filename: string,
): Promise<CSVReadResult | null> {
  try {
    const fileHandle = await dir.getFileHandle(filename);
    const file = await fileHandle.getFile();
    const content = await file.text();
    return { content, lastModified: file.lastModified };
  } catch (e) {
    // File not found yet — not an error, MT5 may not have exported yet
    if ((e as DOMException).name === 'NotFoundError') return null;
    throw e;
  }
}
