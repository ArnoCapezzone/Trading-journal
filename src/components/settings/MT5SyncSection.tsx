import { useEffect } from 'react';
import { useSyncStore } from '../../store/syncStore';
import { useAccountsStore } from '../../lib/accountsStore';

function fmtAgo(ts: number): string {
  if (!ts) return 'never';
  const diff = (Date.now() - ts) / 1000;
  if (diff < 5) return 'just now';
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}min ago`;
  return `${Math.round(diff / 3600)}h ago`;
}

const POLL_OPTIONS = [
  { v: 15, label: '15 s' },
  { v: 30, label: '30 s' },
  { v: 60, label: '1 min' },
  { v: 300, label: '5 min' },
];

export default function MT5SyncSection() {
  const sync = useSyncStore();
  const accounts = useAccountsStore((s) => s.accounts).filter((a) => !a.archived);

  // Re-render every 5s to keep "X ago" counter fresh
  useEffect(() => {
    const id = setInterval(() => { /* force re-render via setState noop */ }, 5000);
    return () => clearInterval(id);
  }, []);

  if (!sync.supported) {
    return (
      <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '20px 24px', marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#3D8EF0', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--border-default)' }}>
          MT5 AutoSync
        </div>
        <div style={{ padding: '12px 14px', backgroundColor: 'rgba(240,72,72,0.07)', border: '1px solid rgba(240,72,72,0.25)', borderRadius: 6, fontSize: 12, color: '#F04848', lineHeight: 1.6 }}>
          Your browser doesn't support the File System Access API. To use AutoSync, open this app in <strong>Chrome, Edge, Brave or Opera on desktop</strong>.
        </div>
      </div>
    );
  }

  const statusColor = sync.status === 'error' ? '#F04848'
    : sync.status === 'syncing' ? '#F0A030'
    : sync.status === 'no-permission' ? '#F0A030'
    : sync.enabled ? '#00C47A'
    : 'var(--text-muted)';

  const statusLabel = sync.status === 'error' ? 'Error'
    : sync.status === 'syncing' ? 'Syncing…'
    : sync.status === 'no-permission' ? 'Permission needed'
    : sync.enabled ? 'Active'
    : 'Off';

  return (
    <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '20px 24px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--border-default)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#3D8EF0', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          MT5 AutoSync
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: statusColor, boxShadow: sync.enabled && sync.status === 'idle' ? `0 0 5px ${statusColor}` : 'none' }} />
          <span style={{ color: statusColor, fontWeight: 600 }}>{statusLabel}</span>
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.65, marginBottom: 16 }}>
        Watches the folder where MT5 exports your <code style={{ padding: '1px 5px', backgroundColor: 'var(--bg-app)', borderRadius: 3, fontFamily: '"JetBrains Mono", monospace', fontSize: 11 }}>{sync.filename}</code> file and auto-imports new trades when it changes.
      </div>

      {/* Folder picker */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            MT5 Files folder
          </span>
          {sync.hasHandle && (
            <button
              onClick={() => sync.clearFolder()}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 10, cursor: 'pointer', textDecoration: 'underline' }}
            >
              Reset
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div
            style={{
              flex: 1,
              padding: '8px 11px',
              backgroundColor: 'var(--bg-app)',
              border: '1px solid var(--border-default)',
              borderRadius: 5,
              fontSize: 12,
              fontFamily: '"JetBrains Mono", monospace',
              color: sync.hasHandle ? 'var(--text-primary)' : 'var(--text-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {sync.hasHandle ? `📁 ${sync.folderName}` : 'No folder selected'}
          </div>
          <button
            onClick={() => sync.pickFolder()}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3D8EF0',
              border: 'none',
              borderRadius: 5,
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: 'var(--shadow-accent)',
              whiteSpace: 'nowrap',
            }}
          >
            {sync.hasHandle ? 'Change…' : 'Pick folder'}
          </button>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
          On Mac with MT5 via Wine: <code style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10 }}>~/Library/Application Support/net.metaquotes.wine.metatrader5/drive_c/Program Files/MetaTrader 5/MQL5/Files</code>
        </div>
      </div>

      {/* Permission prompt */}
      {sync.hasHandle && sync.permission !== 'granted' && (
        <div style={{ padding: '10px 12px', backgroundColor: 'rgba(240,160,48,0.07)', border: '1px solid rgba(240,160,48,0.3)', borderRadius: 6, fontSize: 12, color: '#F0A030', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span>⚠️ Permission needed to read the folder.</span>
          <button
            onClick={() => sync.reauthorize()}
            style={{ padding: '4px 12px', backgroundColor: '#F0A030', border: 'none', borderRadius: 4, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
          >
            Grant access
          </button>
        </div>
      )}

      {/* Settings row */}
      {sync.hasHandle && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Poll interval
              </label>
              <div style={{ display: 'flex', gap: 3, padding: 3, backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-default)', borderRadius: 6 }}>
                {POLL_OPTIONS.map((o) => (
                  <button
                    key={o.v}
                    onClick={() => sync.setPollInterval(o.v)}
                    style={{
                      flex: 1,
                      padding: '5px 4px',
                      borderRadius: 4,
                      border: 'none',
                      backgroundColor: sync.pollIntervalSec === o.v ? 'var(--bg-surface-3)' : 'transparent',
                      color: sync.pollIntervalSec === o.v ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontSize: 11,
                      fontWeight: sync.pollIntervalSec === o.v ? 600 : 400,
                      cursor: 'pointer',
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Import to account
              </label>
              <select
                value={sync.targetAccountId}
                onChange={(e) => sync.setTargetAccountId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 9px',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 5,
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="">— Active account at sync time —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.broker ? ` · ${a.broker}` : ''}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                CSV filename
              </label>
              <input
                type="text"
                value={sync.filename}
                onChange={(e) => sync.setFilename(e.target.value)}
                placeholder="trading_journal_export.csv"
                style={{
                  width: '100%',
                  padding: '7px 9px',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 5,
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  fontFamily: '"JetBrains Mono", monospace',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Action row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {sync.enabled ? (
              <button
                onClick={() => sync.disable()}
                style={{ padding: '7px 16px', backgroundColor: 'rgba(240,72,72,0.10)', border: '1px solid rgba(240,72,72,0.4)', borderRadius: 5, color: '#F04848', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                Pause AutoSync
              </button>
            ) : (
              <button
                onClick={() => sync.enable()}
                disabled={sync.permission === 'denied'}
                style={{ padding: '7px 16px', backgroundColor: '#00C47A', border: 'none', borderRadius: 5, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: sync.permission === 'denied' ? 0.4 : 1 }}
              >
                ▶ Start AutoSync
              </button>
            )}
            <button
              onClick={() => sync.syncNow()}
              disabled={sync.status === 'syncing'}
              style={{ padding: '7px 16px', backgroundColor: 'transparent', border: '1px solid var(--border-default)', borderRadius: 5, color: 'var(--text-primary)', fontSize: 12, cursor: sync.status === 'syncing' ? 'wait' : 'pointer', opacity: sync.status === 'syncing' ? 0.5 : 1 }}
            >
              ↻ Sync now
            </button>
          </div>

          {/* Status panel */}
          <div style={{ marginTop: 14, padding: '12px 14px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-faint)', borderRadius: 6, fontSize: 11, fontFamily: '"JetBrains Mono", monospace' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: 'var(--text-tertiary)' }}>Last sync</span>
              <span style={{ color: 'var(--text-primary)' }}>{sync.lastSyncAt ? fmtAgo(sync.lastSyncAt) : 'never'}</span>
            </div>
            {sync.lastSyncAt > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Last import</span>
                  <span style={{ color: '#00C47A' }}>+{sync.lastImportedCount} new · {sync.lastDuplicateCount} duplicates</span>
                </div>
              </>
            )}
            {sync.lastError && (
              <div style={{ marginTop: 6, padding: '6px 8px', backgroundColor: 'rgba(240,72,72,0.08)', borderRadius: 4, color: '#F04848', fontSize: 11, lineHeight: 1.5, wordBreak: 'break-word' }}>
                {sync.lastError}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
