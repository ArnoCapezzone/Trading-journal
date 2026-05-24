import { useState, useEffect, useMemo } from 'react';
import { useTradesStore } from '../store/tradesStore';
import { useSettingsStore } from '../store/settingsStore';
import { useIsMobile } from '../hooks/useMediaQuery';
import {
  listPlaybooks,
  savePlaybook,
  deletePlaybook,
  createPlaybook,
  computePlaybookStats,
  PLAYBOOK_COLORS,
  type Playbook,
} from '../lib/playbooksStore';

function inputStyle(): React.CSSProperties {
  return {
    width: '100%',
    padding: '8px 11px',
    backgroundColor: '#080B12',
    border: '1px solid #252D3F',
    borderRadius: 5,
    color: '#EEF0F6',
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  };
}

function labelStyle(): React.CSSProperties {
  return {
    display: 'block',
    fontSize: 10,
    color: '#8E97AC',
    fontWeight: 600,
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
  };
}

// ── List item ────────────────────────────────────────────────────
function ListItem({
  playbook,
  active,
  count,
  pnl,
  currency,
  onSelect,
}: {
  playbook: Playbook;
  active: boolean;
  count: number;
  pnl: number;
  currency: string;
  onSelect: () => void;
}) {
  const c = currency === 'EUR' ? '€' : '$';
  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        marginBottom: 4,
        borderRadius: 7,
        cursor: 'pointer',
        backgroundColor: active ? 'rgba(255,255,255,0.04)' : 'transparent',
        borderLeft: `3px solid ${active ? playbook.color : 'transparent'}`,
        transition: 'all 0.12s',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <div style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: playbook.color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: active ? '#EEF0F6' : '#C8CDD8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {playbook.name}
        </div>
        <div style={{ fontSize: 10, color: '#4A5368', fontFamily: '"JetBrains Mono", monospace', marginTop: 2 }}>
          {count} trade{count !== 1 ? 's' : ''} · {pnl >= 0 ? '+' : ''}{pnl.toFixed(0)} {c}
        </div>
      </div>
    </div>
  );
}

// ── String list editor ───────────────────────────────────────────
function StringListEditor({
  items,
  onChange,
  placeholder,
  accent,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  accent: string;
}) {
  const [adding, setAdding] = useState('');

  function add() {
    if (!adding.trim()) return;
    onChange([...items, adding.trim()]);
    setAdding('');
  }

  function remove(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  function move(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const arr = [...items];
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    onChange(arr);
  }

  return (
    <div>
      {items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
          {items.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                backgroundColor: '#080B12',
                border: '1px solid #181E2C',
                borderRadius: 5,
                fontSize: 12,
                color: '#EEF0F6',
              }}
            >
              <span style={{
                width: 18, height: 18, borderRadius: 4,
                backgroundColor: accent + '20', border: `1px solid ${accent}`,
                color: accent,
                fontSize: 10, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: '"JetBrains Mono", monospace',
                flexShrink: 0,
              }}>
                {idx + 1}
              </span>
              <span style={{ flex: 1 }}>{item}</span>
              <button
                onClick={() => move(idx, -1)}
                disabled={idx === 0}
                style={{ background: 'none', border: 'none', color: '#4A5368', cursor: idx === 0 ? 'not-allowed' : 'pointer', padding: 2, opacity: idx === 0 ? 0.3 : 1 }}
                title="Move up"
              >↑</button>
              <button
                onClick={() => move(idx, 1)}
                disabled={idx === items.length - 1}
                style={{ background: 'none', border: 'none', color: '#4A5368', cursor: idx === items.length - 1 ? 'not-allowed' : 'pointer', padding: 2, opacity: idx === items.length - 1 ? 0.3 : 1 }}
                title="Move down"
              >↓</button>
              <button
                onClick={() => remove(idx)}
                style={{ background: 'none', border: 'none', color: '#4A5368', cursor: 'pointer', padding: 2 }}
                title="Remove"
                onMouseEnter={(e) => (e.currentTarget.style.color = '#F04848')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#4A5368')}
              >✕</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder}
          style={{ ...inputStyle(), flex: 1 }}
        />
        <button
          onClick={add}
          disabled={!adding.trim()}
          style={{
            padding: '6px 14px',
            backgroundColor: adding.trim() ? accent : '#19202F',
            border: 'none',
            borderRadius: 5,
            color: adding.trim() ? '#fff' : '#4A5368',
            fontSize: 12,
            fontWeight: 600,
            cursor: adding.trim() ? 'pointer' : 'not-allowed',
            transition: 'background 0.15s',
          }}
        >
          + Add
        </button>
      </div>
    </div>
  );
}

// ── Stats panel ──────────────────────────────────────────────────
function StatPill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ padding: '8px 12px', backgroundColor: '#080B12', borderRadius: 6, border: '1px solid #181E2C', minWidth: 100 }}>
      <div style={{ fontSize: 9, color: '#4A5368', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: color ?? '#EEF0F6', fontFamily: '"JetBrains Mono", monospace', lineHeight: 1 }}>
        {value}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────
export default function Playbooks() {
  const { trades } = useTradesStore();
  const { accountBalance, currency } = useSettingsStore();
  const isMobile = useIsMobile();
  const c = currency === 'EUR' ? '€' : '$';

  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const stats = useMemo(() => computePlaybookStats(trades, accountBalance), [trades, accountBalance]);

  useEffect(() => {
    const all = listPlaybooks();
    setPlaybooks(all);
    if (all.length > 0 && !activeId) setActiveId(all[0].id);
  }, []);

  function refresh() {
    setPlaybooks(listPlaybooks());
  }

  const active = playbooks.find((p) => p.id === activeId) ?? null;

  function handleNew() {
    const fresh = createPlaybook();
    savePlaybook(fresh);
    refresh();
    setActiveId(fresh.id);
  }

  function handleDelete() {
    if (!active) return;
    if (!confirm(`Delete playbook "${active.name}"? This will also unassign it from any trades.`)) return;
    deletePlaybook(active.id);
    const next = listPlaybooks();
    setPlaybooks(next);
    setActiveId(next.length > 0 ? next[0].id : null);
  }

  function update<K extends keyof Playbook>(key: K, value: Playbook[K]) {
    if (!active) return;
    const updated = { ...active, [key]: value };
    savePlaybook(updated);
    refresh();
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  if (playbooks.length === 0) {
    return (
      <div style={{ padding: 24, maxWidth: 540 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', backgroundColor: 'rgba(0,196,122,0.10)', border: '1px solid rgba(0,196,122,0.3)', borderRadius: 4, fontSize: 10, color: '#00C47A', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 16 }}>
          STRATEGY PLAYBOOKS
        </div>
        <div style={{ fontSize: 14, color: '#EEF0F6', marginBottom: 8, fontWeight: 600 }}>
          Build your edge as a system, not gut feel
        </div>
        <div style={{ fontSize: 13, color: '#8E97AC', lineHeight: 1.65, marginBottom: 24 }}>
          A playbook is a documented strategy with entry rules, exit rules, and a pre-trade checklist.
          Assign trades to playbooks and measure each one's real performance — not what you think it does,
          what the data says.
        </div>
        <button
          onClick={handleNew}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '10px 20px',
            background: 'linear-gradient(135deg, #00C47A, #00A867)',
            border: 'none',
            borderRadius: 6,
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 12px rgba(0,196,122,0.3)',
          }}
        >
          + Create first playbook
        </button>
      </div>
    );
  }

  const playbookStat = active ? stats[active.id] : null;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 52px)', backgroundColor: '#080B12' }}>
      {/* Sidebar list (hidden on mobile) */}
      {!isMobile && (
      <aside
        style={{
          width: 260,
          flexShrink: 0,
          backgroundColor: '#0A0D14',
          borderRight: '1px solid #181E2C',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '14px 14px 10px' }}>
          <button
            onClick={handleNew}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '8px 12px',
              background: 'linear-gradient(135deg, #00C47A, #00A867)',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 6px rgba(0,196,122,0.25)',
            }}
          >
            + New playbook
          </button>
        </div>

        <div style={{ padding: '4px 14px 8px', fontSize: 9, fontWeight: 600, color: '#2E3A52', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          {playbooks.length} playbook{playbooks.length !== 1 ? 's' : ''}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px' }}>
          {playbooks.map((p) => (
            <ListItem
              key={p.id}
              playbook={p}
              active={p.id === activeId}
              count={stats[p.id]?.count ?? 0}
              pnl={stats[p.id]?.totalPnl ?? 0}
              currency={currency}
              onSelect={() => setActiveId(p.id)}
            />
          ))}
        </div>
      </aside>
      )}

      {/* Editor */}
      {active && (
        <main style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
          {/* Mobile-only: playbook switcher + new button */}
          {isMobile && (
            <div style={{ display: 'flex', gap: 6, padding: '10px 14px', borderBottom: '1px solid #181E2C', backgroundColor: '#0A0D14' }}>
              <select
                value={activeId ?? ''}
                onChange={(e) => setActiveId(e.target.value)}
                style={{ flex: 1, padding: '7px 10px', backgroundColor: '#0D1017', border: '1px solid #252D3F', borderRadius: 5, color: '#EEF0F6', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
              >
                {playbooks.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button
                onClick={handleNew}
                style={{ padding: '7px 12px', background: 'linear-gradient(135deg, #00C47A, #00A867)', border: 'none', borderRadius: 5, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >+ New</button>
            </div>
          )}
          <div style={{ maxWidth: 820, margin: '0 auto', padding: isMobile ? '16px 14px 24px' : '24px 28px' }}>
            {/* Top: name + color + actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 4 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: active.color, flexShrink: 0, boxShadow: `0 2px 12px ${active.color}40` }} />
              <input
                type="text"
                value={active.name}
                onChange={(e) => update('name', e.target.value)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: '#EEF0F6',
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                  outline: 'none',
                  padding: 0,
                }}
                placeholder="Untitled playbook"
              />
              <div style={{ fontSize: 10, color: savedFlash ? '#00C47A' : '#4A5368', transition: 'color 0.3s', minWidth: 50, textAlign: 'right' }}>
                {savedFlash ? '✓ saved' : ''}
              </div>
              <button
                onClick={handleDelete}
                style={{ padding: '6px 12px', backgroundColor: 'transparent', border: '1px solid #252D3F', borderRadius: 5, color: '#8E97AC', fontSize: 11, cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#F04848', e.currentTarget.style.color = '#F04848')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#252D3F', e.currentTarget.style.color = '#8E97AC')}
              >
                Delete
              </button>
            </div>

            {/* Color picker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 24 }}>
              <span style={{ fontSize: 10, color: '#4A5368', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Color:</span>
              {PLAYBOOK_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => update('color', color)}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    border: active.color === color ? '2px solid #EEF0F6' : '2px solid transparent',
                    backgroundColor: color,
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'transform 0.12s',
                  }}
                />
              ))}
            </div>

            {/* Description */}
            <div style={{ marginBottom: 22 }}>
              <label style={labelStyle()}>Description</label>
              <textarea
                value={active.description}
                onChange={(e) => update('description', e.target.value)}
                rows={2}
                style={{ ...inputStyle(), resize: 'vertical' }}
                placeholder="What is this strategy? When do you deploy it?"
              />
            </div>

            {/* Stats card */}
            {playbookStat && playbookStat.count > 0 && (
              <div style={{ backgroundColor: '#0D1017', border: '1px solid #1E2839', borderTop: `2px solid ${active.color}`, borderRadius: 9, padding: '14px 16px', marginBottom: 22 }}>
                <div style={{ fontSize: 10, color: active.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>
                  Live Performance
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <StatPill label="Trades" value={String(playbookStat.count)} />
                  <StatPill label="Win Rate" value={`${(playbookStat.winRate * 100).toFixed(1)}%`} color={playbookStat.winRate >= 0.5 ? '#00C47A' : '#F0A030'} />
                  <StatPill label="Net P&L" value={`${playbookStat.totalPnl >= 0 ? '+' : ''}${playbookStat.totalPnl.toFixed(2)} ${c}`} color={playbookStat.totalPnl >= 0 ? '#00C47A' : '#F04848'} />
                  <StatPill label="Profit Factor" value={playbookStat.profitFactor !== null ? playbookStat.profitFactor.toFixed(2) : '—'} color={playbookStat.profitFactor !== null && playbookStat.profitFactor >= 1.5 ? '#00C47A' : playbookStat.profitFactor !== null && playbookStat.profitFactor >= 1 ? '#F0A030' : '#F04848'} />
                  <StatPill label="Expectancy" value={`${playbookStat.expectancy >= 0 ? '+' : ''}${playbookStat.expectancy.toFixed(2)}`} color={playbookStat.expectancy >= 0 ? '#00C47A' : '#F04848'} />
                  <StatPill label="Avg P&L" value={`${playbookStat.avgPnl >= 0 ? '+' : ''}${playbookStat.avgPnl.toFixed(2)}`} color={playbookStat.avgPnl >= 0 ? '#00C47A' : '#F04848'} />
                </div>
              </div>
            )}

            {playbookStat && playbookStat.count === 0 && (
              <div style={{ padding: '12px 16px', backgroundColor: '#0D1017', border: '1px dashed #252D3F', borderRadius: 8, fontSize: 12, color: '#8E97AC', marginBottom: 22, textAlign: 'center' }}>
                No trades assigned yet. Assign this playbook from the trade form to track performance.
              </div>
            )}

            {/* Entry rules */}
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle()}>Entry Rules</label>
              <StringListEditor
                items={active.entryRules}
                onChange={(v) => update('entryRules', v)}
                placeholder="e.g. Price closes above PDH on H1"
                accent="#00C47A"
              />
            </div>

            {/* Exit rules */}
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle()}>Exit Rules</label>
              <StringListEditor
                items={active.exitRules}
                onChange={(v) => update('exitRules', v)}
                placeholder="e.g. Take partial at 1R, full TP at 2R"
                accent="#F0A030"
              />
            </div>

            {/* Pre-trade checklist */}
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle()}>Pre-Trade Checklist</label>
              <div style={{ fontSize: 11, color: '#4A5368', marginBottom: 8 }}>
                Items to verify BEFORE entering. Use as a discipline gate.
              </div>
              <StringListEditor
                items={active.checklist}
                onChange={(v) => update('checklist', v)}
                placeholder="e.g. No high-impact news in next 30min"
                accent="#3D8EF0"
              />
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
