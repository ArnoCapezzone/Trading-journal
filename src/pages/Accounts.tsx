import { useState, useMemo } from 'react';
import { useAccountsStore, ACCOUNT_COLORS, getAccountTypeLabel, getAccountTypeColor, type AccountType, type Account } from '../lib/accountsStore';
import { useTradesStore } from '../store/tradesStore';
import { calculateTrade } from '../utils/calculations';
import { useIsMobile } from '../hooks/useMediaQuery';

const TYPE_OPTIONS: AccountType[] = ['LIVE', 'DEMO', 'PROP_FIRM', 'OTHER'];

function inputStyle(): React.CSSProperties {
  return {
    width: '100%',
    padding: '8px 11px',
    backgroundColor: 'var(--bg-input)',
    border: '1px solid var(--border-default)',
    borderRadius: 5,
    color: 'var(--text-primary)',
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  };
}
function labelStyle(): React.CSSProperties {
  return {
    display: 'block', fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600,
    marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em',
  };
}

export default function AccountsPage() {
  const isMobile = useIsMobile();
  const { accounts, tradeMap, activeId, addAccount, updateAccount, deleteAccount, setActive } = useAccountsStore();
  const trades = useTradesStore((s) => s.trades);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  // Compute per-account stats
  const stats = useMemo(() => {
    const result: Record<string, { trades: number; wins: number; pnl: number; openCount: number }> = {};
    for (const acc of accounts) {
      result[acc.id] = { trades: 0, wins: 0, pnl: 0, openCount: 0 };
    }
    for (const t of trades) {
      const aid = tradeMap[t.id];
      if (!aid || !result[aid]) continue;
      const acc = accounts.find((a) => a.id === aid);
      if (!acc) continue;
      const calc = calculateTrade(t, acc.initialBalance);
      result[aid].trades++;
      if (calc.isWin) result[aid].wins++;
      result[aid].pnl += calc.pnlDollar;
    }
    return result;
  }, [accounts, trades, tradeMap]);

  function handleCreate() {
    const newAcc = addAccount({
      name: 'New Account',
      broker: '',
      type: 'LIVE',
      initialBalance: 10000,
      currency: 'USD',
      color: ACCOUNT_COLORS[accounts.length % ACCOUNT_COLORS.length],
    });
    setEditingId(newAcc.id);
  }

  function handleUpdate<K extends keyof Account>(id: string, key: K, value: Account[K]) {
    updateAccount(id, { [key]: value });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
  }

  function handleDelete(id: string) {
    const acc = accounts.find((a) => a.id === id);
    if (!acc) return;
    const stat = stats[id];
    const msg = stat && stat.trades > 0
      ? `Delete "${acc.name}"? Its ${stat.trades} trades will be UNASSIGNED (not deleted). They will appear under "All Accounts" only.`
      : `Delete "${acc.name}"?`;
    if (!confirm(msg)) return;
    deleteAccount(id);
    if (editingId === id) setEditingId(null);
  }

  return (
    <div style={{ padding: isMobile ? 14 : 24, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', backgroundColor: 'rgba(61,142,240,0.10)', border: '1px solid rgba(61,142,240,0.3)', borderRadius: 4, fontSize: 10, color: '#3D8EF0', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 8 }}>
            ACCOUNTS
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
            Manage multiple trading accounts (live, demo, prop firm). Switch from the account selector in the top bar.
          </div>
        </div>
        <button
          onClick={handleCreate}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px',
            background: 'linear-gradient(135deg, #3D8EF0, #5AA0F5)',
            border: 'none', borderRadius: 6,
            color: '#fff', fontSize: 12, fontWeight: 600,
            cursor: 'pointer',
            boxShadow: 'var(--shadow-accent)',
          }}
        >
          + New account
        </button>
      </div>

      {accounts.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, backgroundColor: 'var(--bg-surface)', border: '1px dashed var(--border-default)', borderRadius: 8 }}>
          No accounts yet. Click "New account" to create your first one.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {accounts.map((acc) => {
            const isEditing = editingId === acc.id;
            const s = stats[acc.id] ?? { trades: 0, wins: 0, pnl: 0, openCount: 0 };
            const isActive = activeId === acc.id;
            const c = acc.currency === 'EUR' ? '€' : '$';
            const wr = s.trades > 0 ? (s.wins / s.trades) * 100 : 0;

            return (
              <div
                key={acc.id}
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-mid)',
                  borderTop: `2px solid ${acc.color}`,
                  borderRadius: 9,
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: acc.color, flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isEditing ? (
                      <input
                        autoFocus
                        type="text"
                        value={acc.name}
                        onChange={(e) => handleUpdate(acc.id, 'name', e.target.value)}
                        onBlur={() => setEditingId(null)}
                        onKeyDown={(e) => e.key === 'Enter' && setEditingId(null)}
                        style={{ ...inputStyle(), padding: '3px 8px', fontSize: 14, fontWeight: 600 }}
                      />
                    ) : (
                      <div
                        onClick={() => setEditingId(acc.id)}
                        style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', wordBreak: 'break-word' }}
                      >
                        {acc.name}
                      </div>
                    )}
                    {acc.broker && !isEditing && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontFamily: '"JetBrains Mono", monospace' }}>
                        {acc.broker}
                      </div>
                    )}
                  </div>

                  <span style={{ fontSize: 9, fontWeight: 700, color: getAccountTypeColor(acc.type), padding: '3px 7px', backgroundColor: getAccountTypeColor(acc.type) + '15', borderRadius: 3, letterSpacing: '0.04em' }}>
                    {getAccountTypeLabel(acc.type).toUpperCase()}
                  </span>
                </div>

                {/* Quick stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  <Stat label="Trades" value={String(s.trades)} />
                  <Stat label="WR" value={s.trades > 0 ? `${wr.toFixed(0)}%` : '—'} color={s.trades > 0 ? (wr >= 50 ? '#00C47A' : '#F0A030') : undefined} />
                  <Stat label="P&L" value={s.trades > 0 ? `${s.pnl >= 0 ? '+' : ''}${s.pnl.toFixed(0)} ${c}` : '—'} color={s.trades > 0 ? (s.pnl >= 0 ? '#00C47A' : '#F04848') : undefined} />
                </div>

                {/* Configuration fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={labelStyle()}>Broker</label>
                    <input
                      type="text"
                      value={acc.broker}
                      onChange={(e) => handleUpdate(acc.id, 'broker', e.target.value)}
                      placeholder="e.g. IC Markets"
                      style={{ ...inputStyle(), padding: '5px 9px', fontSize: 12 }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle()}>Type</label>
                    <select
                      value={acc.type}
                      onChange={(e) => handleUpdate(acc.id, 'type', e.target.value as AccountType)}
                      style={{ ...inputStyle(), padding: '5px 9px', fontSize: 12, cursor: 'pointer' }}
                    >
                      {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{getAccountTypeLabel(t)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle()}>Initial Balance</label>
                    <input
                      type="number"
                      value={acc.initialBalance}
                      onChange={(e) => handleUpdate(acc.id, 'initialBalance', parseFloat(e.target.value) || 0)}
                      style={{ ...inputStyle(), padding: '5px 9px', fontSize: 12, fontFamily: '"JetBrains Mono", monospace' }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle()}>Currency</label>
                    <select
                      value={acc.currency}
                      onChange={(e) => handleUpdate(acc.id, 'currency', e.target.value as 'USD' | 'EUR')}
                      style={{ ...inputStyle(), padding: '5px 9px', fontSize: 12, cursor: 'pointer' }}
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                </div>

                {/* Color picker */}
                <div>
                  <label style={labelStyle()}>Color</label>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {ACCOUNT_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => handleUpdate(acc.id, 'color', color)}
                        style={{
                          width: 18, height: 18, borderRadius: 4,
                          border: acc.color === color ? '2px solid var(--text-primary)' : '2px solid transparent',
                          backgroundColor: color, cursor: 'pointer', padding: 0,
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                  <button
                    onClick={() => setActive(acc.id)}
                    disabled={isActive}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      backgroundColor: isActive ? 'var(--bg-surface-2)' : acc.color + '15',
                      border: `1px solid ${isActive ? 'var(--border-default)' : acc.color}`,
                      borderRadius: 5,
                      color: isActive ? 'var(--text-muted)' : acc.color,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: isActive ? 'default' : 'pointer',
                    }}
                  >
                    {isActive ? '✓ Active' : 'Set active'}
                  </button>
                  <button
                    onClick={() => handleDelete(acc.id)}
                    style={{
                      padding: '6px 10px',
                      backgroundColor: 'transparent',
                      border: '1px solid var(--border-default)',
                      borderRadius: 5,
                      color: 'var(--text-tertiary)',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#F04848', e.currentTarget.style.color = '#F04848')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-default)', e.currentTarget.style.color = 'var(--text-tertiary)')}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', fontFamily: '"JetBrains Mono", monospace', padding: '6px 4px' }}>
        <span>Trades are assigned via the trade form. Existing trades default to "Main Account".</span>
        <span style={{ color: savedFlash ? '#00C47A' : 'var(--text-faint)', transition: 'color 0.3s' }}>
          {savedFlash ? '✓ saved' : ''}
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ padding: '7px 9px', backgroundColor: 'var(--bg-app)', borderRadius: 5, border: '1px solid var(--border-faint)' }}>
      <div style={{ fontSize: 8, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: color ?? 'var(--text-primary)', fontFamily: '"JetBrains Mono", monospace', lineHeight: 1 }}>
        {value}
      </div>
    </div>
  );
}
