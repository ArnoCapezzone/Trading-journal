import { useState, useEffect } from 'react';
import type { Goal, GoalType } from '../../lib/goalsStore';
import { createGoal, suggestTitle, getGoalTypeLabel } from '../../lib/goalsStore';

interface Props {
  open: boolean;
  goal?: Goal | null;
  currency: string;
  onClose: () => void;
  onSave: (goal: Goal) => void;
}

const TYPES: GoalType[] = [
  'pnl_amount',
  'pnl_percent',
  'win_rate',
  'profit_factor',
  'trade_count',
  'discipline_score',
  'win_streak',
  'avg_rr',
];

const DEFAULT_TARGETS: Record<GoalType, number> = {
  pnl_amount: 1000,
  pnl_percent: 10,
  win_rate: 55,
  profit_factor: 1.5,
  trade_count: 50,
  discipline_score: 80,
  win_streak: 5,
  avg_rr: 1.5,
};

function inputStyle(): React.CSSProperties {
  return {
    width: '100%',
    padding: '8px 11px',
    backgroundColor: 'var(--bg-app)',
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
    display: 'block',
    fontSize: 10,
    color: 'var(--text-tertiary)',
    fontWeight: 600,
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  };
}

function toDateInput(ts?: number) {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function GoalModal({ open, goal, currency, onClose, onSave }: Props) {
  const [type, setType] = useState<GoalType>('pnl_amount');
  const [target, setTarget] = useState('1000');
  const [title, setTitle] = useState('');
  const [scope, setScope] = useState<'all' | 'period'>('period');
  const [deadline, setDeadline] = useState('');
  const [titleEdited, setTitleEdited] = useState(false);

  useEffect(() => {
    if (goal) {
      setType(goal.type);
      setTarget(String(goal.target));
      setTitle(goal.title);
      setScope(goal.scope);
      setDeadline(toDateInput(goal.deadline));
      setTitleEdited(true);
    } else {
      setType('pnl_amount');
      setTarget(String(DEFAULT_TARGETS.pnl_amount));
      setTitle(suggestTitle('pnl_amount', DEFAULT_TARGETS.pnl_amount, currency));
      setScope('period');
      setDeadline('');
      setTitleEdited(false);
    }
  }, [goal, open, currency]);

  // Auto-update title if user hasn't manually edited it
  useEffect(() => {
    if (!titleEdited && !goal) {
      const t = parseFloat(target);
      if (!isNaN(t)) setTitle(suggestTitle(type, t, currency));
    }
  }, [type, target, titleEdited, goal, currency]);

  function handleTypeChange(newType: GoalType) {
    setType(newType);
    if (!titleEdited && !goal) {
      const def = DEFAULT_TARGETS[newType];
      setTarget(String(def));
    }
  }

  function handleSave() {
    const t = parseFloat(target);
    if (isNaN(t) || t <= 0) return;
    const finalTitle = title.trim() || suggestTitle(type, t, currency);
    const deadlineTs = deadline ? new Date(deadline).getTime() : undefined;

    if (goal) {
      onSave({ ...goal, type, target: t, title: finalTitle, scope, deadline: deadlineTs });
    } else {
      onSave(createGoal({ type, target: t, title: finalTitle, scope, deadline: deadlineTs }));
    }
    onClose();
  }

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(8,11,18,0.78)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 12,
          padding: '24px 28px',
          width: 'min(92vw, 480px)',
          boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 10, color: '#8B6CF0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 4 }}>
              {goal ? 'Edit goal' : 'New goal'}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
              Set a measurable target
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', padding: 4 }}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Type */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle()}>Goal Type</label>
          <select value={type} onChange={(e) => handleTypeChange(e.target.value as GoalType)} style={{ ...inputStyle(), cursor: 'pointer' }}>
            {TYPES.map((t) => (
              <option key={t} value={t}>{getGoalTypeLabel(t)}</option>
            ))}
          </select>
        </div>

        {/* Target */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle()}>Target Value</label>
          <input
            type="number"
            step="any"
            min="0"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            style={{ ...inputStyle(), fontFamily: '"JetBrains Mono", monospace' }}
            placeholder="e.g. 1000"
          />
        </div>

        {/* Title */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle()}>Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setTitleEdited(true); }}
            style={inputStyle()}
            placeholder="Auto-generated based on type and target"
          />
        </div>

        {/* Scope + deadline */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 22 }}>
          <div>
            <label style={labelStyle()}>Scope</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { v: 'period', label: 'Since now' },
                { v: 'all', label: 'All time' },
              ].map((s) => (
                <button
                  key={s.v}
                  type="button"
                  onClick={() => setScope(s.v as 'all' | 'period')}
                  style={{
                    flex: 1,
                    padding: '7px 8px',
                    borderRadius: 5,
                    border: `1px solid ${scope === s.v ? '#3D8EF0' : 'var(--border-default)'}`,
                    backgroundColor: scope === s.v ? 'rgba(61,142,240,0.12)' : 'transparent',
                    color: scope === s.v ? '#3D8EF0' : 'var(--text-tertiary)',
                    fontSize: 11,
                    fontWeight: scope === s.v ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={labelStyle()}>Deadline (optional)</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              style={{ ...inputStyle(), fontFamily: '"JetBrains Mono", monospace' }}
            />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              backgroundColor: 'transparent',
              border: '1px solid var(--border-default)',
              borderRadius: 6,
              color: 'var(--text-tertiary)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!target || isNaN(parseFloat(target)) || parseFloat(target) <= 0}
            style={{
              padding: '8px 22px',
              backgroundColor: '#3D8EF0',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              opacity: !target || isNaN(parseFloat(target)) || parseFloat(target) <= 0 ? 0.4 : 1,
              boxShadow: '0 1px 6px rgba(61,142,240,0.25)',
            }}
          >
            {goal ? 'Save' : 'Create Goal'}
          </button>
        </div>
      </div>
    </div>
  );
}
