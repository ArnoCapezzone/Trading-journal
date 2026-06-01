import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccountsStore, getAccountTypeLabel, getAccountTypeColor } from '../../lib/accountsStore';

export default function AccountSelector() {
  const navigate = useNavigate();
  const { accounts, activeId, setActive } = useAccountsStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const visibleAccounts = accounts.filter((a) => !a.archived);
  const active = visibleAccounts.find((a) => a.id === activeId);
  const isAll = activeId === 'all';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px 6px 8px',
          backgroundColor: 'var(--bg-surface-2)',
          border: '1px solid var(--border-default)',
          borderRadius: 6,
          color: 'var(--text-primary)',
          fontSize: 12,
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'border-color 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-default)')}
        title="Switch account"
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: 2,
            backgroundColor: isAll ? 'var(--text-muted)' : active?.color ?? 'var(--text-muted)',
            flexShrink: 0,
          }}
        />
        <span style={{ whiteSpace: 'nowrap', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {isAll ? 'All Accounts' : active?.name ?? '—'}
        </span>
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" style={{ opacity: 0.5, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
          <polyline points="3,5 6,8 9,5" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            minWidth: 240,
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 8,
            boxShadow: 'var(--shadow-card)',
            zIndex: 100,
            overflow: 'hidden',
          }}
        >
          {/* All accounts option */}
          <button
            onClick={() => { setActive('all'); setOpen(false); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '9px 12px',
              backgroundColor: isAll ? 'var(--bg-surface-2)' : 'transparent',
              border: 'none',
              color: isAll ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: isAll ? 600 : 400,
              cursor: 'pointer',
              textAlign: 'left',
              borderBottom: '1px solid var(--border-faint)',
              transition: 'background 0.12s',
            }}
            onMouseEnter={(e) => { if (!isAll) e.currentTarget.style.backgroundColor = 'var(--bg-surface-2)'; }}
            onMouseLeave={(e) => { if (!isAll) e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: 'var(--text-muted)' }} />
            <span style={{ flex: 1 }}>All Accounts</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: '"JetBrains Mono", monospace' }}>
              aggregated view
            </span>
          </button>

          {visibleAccounts.length === 0 ? (
            <div style={{ padding: '14px 12px', fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center' }}>
              No accounts yet
            </div>
          ) : (
            visibleAccounts.map((a) => (
              <button
                key={a.id}
                onClick={() => { setActive(a.id); setOpen(false); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '9px 12px',
                  backgroundColor: a.id === activeId ? 'var(--bg-surface-2)' : 'transparent',
                  border: 'none',
                  color: a.id === activeId ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: 12,
                  fontWeight: a.id === activeId ? 600 : 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => { if (a.id !== activeId) e.currentTarget.style.backgroundColor = 'var(--bg-surface-2)'; }}
                onMouseLeave={(e) => { if (a.id !== activeId) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: a.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                  {a.broker && (
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: '"JetBrains Mono", monospace', marginTop: 1 }}>
                      {a.broker}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 9, fontWeight: 600, color: getAccountTypeColor(a.type), padding: '2px 6px', backgroundColor: getAccountTypeColor(a.type) + '15', borderRadius: 3, letterSpacing: '0.04em' }}>
                  {getAccountTypeLabel(a.type).toUpperCase()}
                </span>
              </button>
            ))
          )}

          {/* Manage link */}
          <button
            onClick={() => { setOpen(false); navigate('/accounts'); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              width: '100%',
              padding: '9px 12px',
              backgroundColor: 'transparent',
              border: 'none',
              borderTop: '1px solid var(--border-faint)',
              color: 'var(--text-tertiary)',
              fontSize: 11,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.12s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-2)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="6" r="1.5" />
              <path d="M6 1.5v1.5M6 9v1.5M1.5 6h1.5M9 6h1.5M2.5 2.5l1.1 1.1M8.4 8.4l1.1 1.1M9.5 2.5l-1.1 1.1M3.6 8.4l-1.1 1.1" />
            </svg>
            Manage accounts
          </button>
        </div>
      )}
    </div>
  );
}
