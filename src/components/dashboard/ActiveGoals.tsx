import { useState, useEffect, useMemo } from 'react';
import type { Trade } from '../../types/trade';
import type { Goal } from '../../lib/goalsStore';
import {
  listGoals,
  saveGoal,
  deleteGoal,
  computeGoalProgress,
  getGoalTypeLabel,
} from '../../lib/goalsStore';
import GoalModal from './GoalModal';

interface Props {
  trades: Trade[];
  accountBalance: number;
  currency: string;
}

function fmtDeadline(ts?: number): { text: string; urgent: boolean; expired: boolean } {
  if (!ts) return { text: '', urgent: false, expired: false };
  const now = Date.now();
  const diff = ts - now;
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, urgent: true, expired: true };
  if (days === 0) return { text: 'Today', urgent: true, expired: false };
  if (days <= 7) return { text: `${days}d left`, urgent: true, expired: false };
  if (days <= 30) return { text: `${days}d left`, urgent: false, expired: false };
  const months = Math.round(days / 30);
  return { text: `${months}mo left`, urgent: false, expired: false };
}

export default function ActiveGoals({ trades, accountBalance, currency }: Props) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setGoals(listGoals());
  }, []);

  const refresh = () => setGoals(listGoals());

  const progressByGoal = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeGoalProgress>>();
    for (const g of goals) {
      map.set(g.id, computeGoalProgress(g, trades, accountBalance, currency));
    }
    return map;
  }, [goals, trades, accountBalance, currency]);

  // Auto-mark achievedAt when first hit
  useEffect(() => {
    let changed = false;
    const updated = goals.map((g) => {
      const p = progressByGoal.get(g.id);
      if (p?.achieved && !g.achievedAt) {
        changed = true;
        return { ...g, achievedAt: Date.now() };
      }
      return g;
    });
    if (changed) {
      updated.forEach(saveGoal);
      setGoals(updated);
    }
  }, [progressByGoal, goals]);

  function handleSave(g: Goal) {
    saveGoal(g);
    refresh();
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this goal?')) return;
    deleteGoal(id);
    refresh();
  }

  function handleNew() {
    setEditing(null);
    setModalOpen(true);
  }

  function handleEdit(g: Goal) {
    setEditing(g);
    setModalOpen(true);
  }

  // Sort: active first (by closest to completion), then achieved, then expired
  const sorted = [...goals].sort((a, b) => {
    const pa = progressByGoal.get(a.id);
    const pb = progressByGoal.get(b.id);
    const aAchieved = pa?.achieved ? 1 : 0;
    const bAchieved = pb?.achieved ? 1 : 0;
    if (aAchieved !== bAchieved) return aAchieved - bAchieved;
    return (pb?.percent ?? 0) - (pa?.percent ?? 0);
  });

  const visible = showAll ? sorted : sorted.slice(0, 3);

  return (
    <div>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#3D8EF0', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          Goals & Milestones
        </div>
        <div style={{ flex: 1, height: 1, backgroundColor: '#181E2C' }} />
        <button
          onClick={handleNew}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 12px',
            backgroundColor: 'rgba(61,142,240,0.10)',
            border: '1px solid rgba(61,142,240,0.35)',
            borderRadius: 5,
            color: '#3D8EF0',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(61,142,240,0.18)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(61,142,240,0.10)')}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="5" y1="1.5" x2="5" y2="8.5" /><line x1="1.5" y1="5" x2="8.5" y2="5" />
          </svg>
          New goal
        </button>
      </div>

      {sorted.length === 0 ? (
        <div
          style={{
            backgroundColor: '#0D1017',
            border: '1px dashed #252D3F',
            borderRadius: 8,
            padding: '20px 16px',
            textAlign: 'center',
            fontSize: 12,
            color: '#8E97AC',
            lineHeight: 1.6,
          }}
        >
          No goals set yet. <button onClick={handleNew} style={{ background: 'none', border: 'none', color: '#3D8EF0', cursor: 'pointer', fontSize: 12, padding: 0, fontWeight: 600 }}>Set your first goal</button> to start tracking progress.
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 8 }}>
            {visible.map((g) => {
              const p = progressByGoal.get(g.id);
              if (!p) return null;
              const deadline = fmtDeadline(g.deadline);
              const barColor = p.achieved
                ? '#00C47A'
                : p.percent >= 75 ? '#3D8EF0'
                : p.percent >= 40 ? '#F0A030'
                : '#252D3F';

              return (
                <div
                  key={g.id}
                  style={{
                    backgroundColor: '#0D1017',
                    border: '1px solid #1E2839',
                    borderLeft: `3px solid ${p.achieved ? '#00C47A' : '#3D8EF0'}`,
                    borderRadius: 8,
                    padding: '12px 14px',
                    position: 'relative',
                    transition: 'border-color 0.15s',
                  }}
                >
                  {/* Top row: type + actions */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontSize: 9, color: '#4A5368', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.10em' }}>
                      {getGoalTypeLabel(g.type)}
                    </div>
                    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      {p.achieved && (
                        <span style={{ fontSize: 9, color: '#00C47A', fontWeight: 700, padding: '2px 6px', backgroundColor: 'rgba(0,196,122,0.12)', borderRadius: 3, marginRight: 4, letterSpacing: '0.05em' }}>
                          ✓ DONE
                        </span>
                      )}
                      {deadline.text && (
                        <span
                          style={{
                            fontSize: 9,
                            color: deadline.expired ? '#F04848' : deadline.urgent ? '#F0A030' : '#4A5368',
                            fontFamily: '"JetBrains Mono", monospace',
                            fontWeight: 600,
                            marginRight: 4,
                          }}
                        >
                          {deadline.text}
                        </span>
                      )}
                      <button
                        onClick={() => handleEdit(g)}
                        style={{ background: 'none', border: 'none', color: '#4A5368', cursor: 'pointer', padding: 3, fontSize: 11 }}
                        title="Edit"
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#8E97AC')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#4A5368')}
                      >
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M8.5 1.5l2 2-7 7H1.5v-2l7-7z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(g.id)}
                        style={{ background: 'none', border: 'none', color: '#4A5368', cursor: 'pointer', padding: 3, fontSize: 11 }}
                        title="Delete"
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#F04848')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#4A5368')}
                      >
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M2 3h8M4.5 3V2a1 1 0 011-1h1a1 1 0 011 1v1M3 3v7a1 1 0 001 1h4a1 1 0 001-1V3" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Title */}
                  <div style={{ fontSize: 12, color: '#EEF0F6', fontWeight: 500, marginBottom: 10, lineHeight: 1.4 }}>
                    {g.title}
                  </div>

                  {/* Progress numbers */}
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: p.achieved ? '#00C47A' : '#EEF0F6', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '-0.01em' }}>
                      {p.formatted.current}
                    </div>
                    <div style={{ fontSize: 11, color: '#4A5368', fontFamily: '"JetBrains Mono", monospace' }}>
                      / {p.formatted.target}
                    </div>
                  </div>

                  {/* Bar */}
                  <div style={{ height: 5, backgroundColor: '#181E2C', borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
                    <div
                      style={{
                        width: `${p.percent}%`,
                        height: '100%',
                        backgroundColor: barColor,
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#4A5368', fontFamily: '"JetBrains Mono", monospace' }}>
                    <span>{p.percent.toFixed(0)}%</span>
                    <span>{g.scope === 'period' ? 'since goal set' : 'all-time'}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {sorted.length > 3 && (
            <div style={{ textAlign: 'center', marginTop: 10 }}>
              <button
                onClick={() => setShowAll((s) => !s)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#8E97AC',
                  fontSize: 11,
                  cursor: 'pointer',
                  padding: '4px 10px',
                  fontWeight: 500,
                }}
              >
                {showAll ? '↑ Show less' : `↓ Show all ${sorted.length} goals`}
              </button>
            </div>
          )}
        </>
      )}

      <GoalModal
        open={modalOpen}
        goal={editing}
        currency={currency}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
