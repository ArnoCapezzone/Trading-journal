import { useState, useEffect, useMemo } from 'react';
import {
  todayKey,
  getPlan,
  savePlan,
  createPlan,
  deletePlan,
  listPlans,
  computePlanStats,
  MOOD_TAGS_POSITIVE,
  MOOD_TAGS_NEGATIVE,
  type DailyPlan,
  type Bias,
} from '../lib/dailyPlanStore';
import { useIsMobile } from '../hooks/useMediaQuery';

// ── Style helpers ─────────────────────────────────────────────
function labelStyle(): React.CSSProperties {
  return {
    display: 'block',
    fontSize: 10,
    color: 'var(--text-tertiary)',
    fontWeight: 600,
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
  };
}
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

function Section({ title, accent, children, action }: { title: string; accent: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderTop: `2px solid ${accent}`, borderRadius: 9, padding: '18px 22px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: accent, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          {title}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function MoodSlider({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  const color = value <= 3 ? '#F04848' : value <= 6 ? '#F0A030' : '#00C47A';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseInt(e.target.value))}
        style={{ flex: 1, accentColor: color, cursor: disabled ? 'not-allowed' : 'pointer' }}
      />
      <div style={{
        minWidth: 42,
        textAlign: 'center',
        padding: '4px 10px',
        backgroundColor: color + '20',
        border: `1px solid ${color}`,
        borderRadius: 5,
        color,
        fontSize: 13,
        fontWeight: 700,
        fontFamily: '"JetBrains Mono", monospace',
      }}>
        {value}
      </div>
    </div>
  );
}

function MoodChips({ value, onChange, options, color }: { value: string[]; onChange: (tags: string[]) => void; options: string[]; color: string }) {
  function toggle(tag: string) {
    if (value.includes(tag)) onChange(value.filter((t) => t !== tag));
    else onChange([...value, tag]);
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {options.map((tag) => {
        const active = value.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            onClick={() => toggle(tag)}
            style={{
              padding: '4px 10px',
              borderRadius: 4,
              border: `1px solid ${active ? color : 'var(--border-default)'}`,
              backgroundColor: active ? color + '15' : 'transparent',
              color: active ? color : 'var(--text-tertiary)',
              fontSize: 11,
              fontWeight: active ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.12s',
            }}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}

function BiasButtons({ value, onChange }: { value: Bias; onChange: (b: Bias) => void }) {
  const opts: { v: Bias; label: string; color: string }[] = [
    { v: 'LONG', label: '▲ Long', color: '#00C47A' },
    { v: 'NEUTRAL', label: '— Neutral', color: 'var(--text-tertiary)' },
    { v: 'SHORT', label: '▼ Short', color: '#F04848' },
  ];
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 5,
            border: `1px solid ${value === o.v ? o.color : 'var(--border-default)'}`,
            backgroundColor: value === o.v ? o.color + '15' : 'transparent',
            color: value === o.v ? o.color : 'var(--text-tertiary)',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: '"JetBrains Mono", monospace',
            letterSpacing: '0.03em',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function DailyPlanPage() {
  const isMobile = useIsMobile();
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [history, setHistory] = useState<DailyPlan[]>([]);

  // Load plan for selected date (or create new)
  useEffect(() => {
    const existing = getPlan(selectedDate);
    setPlan(existing ?? createPlan(selectedDate));
    setHistory(listPlans());
  }, [selectedDate]);

  const stats = useMemo(() => computePlanStats(), [history]);

  function update<K extends keyof DailyPlan>(key: K, value: DailyPlan[K]) {
    if (!plan) return;
    const updated = { ...plan, [key]: value };
    setPlan(updated);
    savePlan(updated);
    setHistory(listPlans());
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  function handleStartReview() {
    if (!plan) return;
    update('reviewed', true);
  }

  function handleDelete() {
    if (!plan) return;
    if (!confirm(`Delete daily plan for ${plan.date}?`)) return;
    deletePlan(plan.date);
    if (plan.date === todayKey()) {
      setPlan(createPlan(todayKey()));
    } else {
      setSelectedDate(todayKey());
    }
    setHistory(listPlans());
  }

  if (!plan) return null;

  const isToday = plan.date === todayKey();
  const isPast = plan.date < todayKey();

  return (
    <div style={{ padding: isMobile ? 14 : 24, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16, alignItems: 'flex-start' }}>
      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', backgroundColor: 'rgba(0,196,122,0.10)', border: '1px solid rgba(0,196,122,0.3)', borderRadius: 4, fontSize: 10, color: '#00C47A', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 8 }}>
              {isToday ? 'TODAY\'S PLAN' : isPast ? 'PAST PLAN' : 'FUTURE PLAN'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              Pre-market plan + end-of-day review · auto-saved
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="date"
              value={plan.date}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ ...inputStyle(), width: 150, fontFamily: '"JetBrains Mono", monospace' }}
            />
            <div style={{ fontSize: 10, color: savedFlash ? '#00C47A' : 'var(--text-muted)', transition: 'color 0.3s', minWidth: 50, textAlign: 'right' }}>
              {savedFlash ? '✓ saved' : ''}
            </div>
          </div>
        </div>

        {/* Pre-market plan */}
        <Section title="Pre-Market Plan" accent="#3D8EF0">
          {/* Row 1: Bias + caps */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div>
              <label style={labelStyle()}>Market Bias</label>
              <BiasButtons value={plan.bias} onChange={(b) => update('bias', b)} />
            </div>
            <div>
              <label style={labelStyle()}>Max Trades Today</label>
              <input
                type="number"
                min={0}
                value={plan.maxTrades}
                onChange={(e) => update('maxTrades', parseInt(e.target.value) || 0)}
                style={{ ...inputStyle(), fontFamily: '"JetBrains Mono", monospace' }}
              />
            </div>
            <div>
              <label style={labelStyle()}>Max Daily Risk</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  value={plan.maxRiskPct}
                  onChange={(e) => update('maxRiskPct', parseFloat(e.target.value) || 0)}
                  style={{ ...inputStyle(), fontFamily: '"JetBrains Mono", monospace', paddingRight: 28 }}
                />
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-muted)' }}>%</span>
              </div>
            </div>
          </div>

          {/* Key levels */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle()}>Key Levels & Zones</label>
            <textarea
              value={plan.keyLevels}
              onChange={(e) => update('keyLevels', e.target.value)}
              rows={2}
              style={{ ...inputStyle(), resize: 'vertical', fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}
              placeholder="e.g. EURUSD support 1.0820 · NAS100 PDH 19560 · XAUUSD weekly low 2620"
            />
          </div>

          {/* Setups */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle()}>Setups To Watch</label>
            <textarea
              value={plan.setupsToWatch}
              onChange={(e) => update('setupsToWatch', e.target.value)}
              rows={2}
              style={{ ...inputStyle(), resize: 'vertical' }}
              placeholder="e.g. London breakout on EURUSD if it cleans the Asian high · range fade on NAS100"
            />
          </div>

          {/* Mood + tags */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14 }}>
            <div>
              <label style={labelStyle()}>Pre-Market Mood (1-10)</label>
              <MoodSlider value={plan.preMood} onChange={(v) => update('preMood', v)} />
            </div>
            <div>
              <label style={labelStyle()}>How are you feeling?</label>
              <MoodChips
                value={plan.preMoodTags}
                onChange={(t) => update('preMoodTags', t)}
                options={[...MOOD_TAGS_POSITIVE, ...MOOD_TAGS_NEGATIVE]}
                color="#3D8EF0"
              />
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginTop: 14 }}>
            <label style={labelStyle()}>Notes</label>
            <textarea
              value={plan.preNotes}
              onChange={(e) => update('preNotes', e.target.value)}
              rows={2}
              style={{ ...inputStyle(), resize: 'vertical' }}
              placeholder="Anything else to remember before you start..."
            />
          </div>
        </Section>

        {/* End-of-day review */}
        <Section
          title="End-of-Day Review"
          accent="#8B6CF0"
          action={
            !plan.reviewed && (
              <button
                onClick={handleStartReview}
                style={{ padding: '5px 12px', backgroundColor: 'rgba(139,108,240,0.15)', border: '1px solid rgba(139,108,240,0.4)', borderRadius: 5, color: '#8B6CF0', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
              >
                Start review
              </button>
            )
          }
        >
          {!plan.reviewed ? (
            <div style={{ padding: '14px 16px', backgroundColor: 'var(--bg-app)', borderRadius: 7, fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.6 }}>
              Review not started. Click <strong style={{ color: '#8B6CF0' }}>Start review</strong> at end of session.
            </div>
          ) : (
            <>
              {/* Followed plan */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle()}>Did you follow your plan?</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[
                    { v: 'yes', label: '✓ Yes', color: '#00C47A' },
                    { v: 'partial', label: '~ Partial', color: '#F0A030' },
                    { v: 'no', label: '✗ No', color: '#F04848' },
                  ].map((o) => (
                    <button
                      key={o.v}
                      onClick={() => update('followedPlan', o.v as 'yes' | 'partial' | 'no')}
                      style={{
                        flex: 1,
                        padding: '7px',
                        borderRadius: 5,
                        border: `1px solid ${plan.followedPlan === o.v ? o.color : 'var(--border-default)'}`,
                        backgroundColor: plan.followedPlan === o.v ? o.color + '15' : 'transparent',
                        color: plan.followedPlan === o.v ? o.color : 'var(--text-tertiary)',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle()}>Best Decision</label>
                  <textarea
                    value={plan.bestDecision}
                    onChange={(e) => update('bestDecision', e.target.value)}
                    rows={2}
                    style={{ ...inputStyle(), resize: 'vertical' }}
                    placeholder="What worked today?"
                  />
                </div>
                <div>
                  <label style={labelStyle()}>Worst Decision</label>
                  <textarea
                    value={plan.worstDecision}
                    onChange={(e) => update('worstDecision', e.target.value)}
                    rows={2}
                    style={{ ...inputStyle(), resize: 'vertical' }}
                    placeholder="What didn't work?"
                  />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle()}>Key Lesson</label>
                <textarea
                  value={plan.lesson}
                  onChange={(e) => update('lesson', e.target.value)}
                  rows={2}
                  style={{ ...inputStyle(), resize: 'vertical' }}
                  placeholder="One sentence to remember next time..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14 }}>
                <div>
                  <label style={labelStyle()}>End-of-Day Mood</label>
                  <MoodSlider value={plan.postMood || 5} onChange={(v) => update('postMood', v)} />
                </div>
                <div>
                  <label style={labelStyle()}>How are you feeling now?</label>
                  <MoodChips
                    value={plan.postMoodTags}
                    onChange={(t) => update('postMoodTags', t)}
                    options={[...MOOD_TAGS_POSITIVE, ...MOOD_TAGS_NEGATIVE]}
                    color="#8B6CF0"
                  />
                </div>
              </div>
            </>
          )}
        </Section>

        {/* Delete */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleDelete}
            style={{ padding: '6px 14px', backgroundColor: 'transparent', border: '1px solid var(--border-default)', borderRadius: 5, color: 'var(--text-tertiary)', fontSize: 11, cursor: 'pointer' }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#F04848', e.currentTarget.style.color = '#F04848')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-default)', e.currentTarget.style.color = 'var(--text-tertiary)')}
          >
            Delete this plan
          </button>
        </div>
      </div>

      {/* Right column: stats + history */}
      <div style={{ width: isMobile ? '100%' : 280, flexShrink: 0, position: isMobile ? 'static' : 'sticky', top: 80, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Stats card */}
        <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 9, padding: '16px 18px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>
            Discipline
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <StatRow label="Planning Streak" value={`${stats.consecutiveDays}d`} color="#00C47A" />
            <StatRow label="Total Plans" value={String(stats.total)} color="#EEF0F6" />
            <StatRow label="Review Rate" value={`${(stats.reviewRate * 100).toFixed(0)}%`} color={stats.reviewRate >= 0.7 ? '#00C47A' : stats.reviewRate >= 0.4 ? '#F0A030' : '#F04848'} />
            <StatRow label="Plan Followed" value={`${(stats.followedRate * 100).toFixed(0)}%`} color={stats.followedRate >= 0.7 ? '#00C47A' : stats.followedRate >= 0.4 ? '#F0A030' : '#F04848'} />
            <StatRow label="Avg Pre Mood" value={stats.avgPreMood ? stats.avgPreMood.toFixed(1) : '—'} color="#8E97AC" />
            <StatRow label="Avg Post Mood" value={stats.avgPostMood ? stats.avgPostMood.toFixed(1) : '—'} color="#8E97AC" />
          </div>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 9, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
              Recent Plans
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 320, overflowY: 'auto' }}>
              {history.slice(0, 14).map((p) => (
                <div
                  key={p.date}
                  onClick={() => setSelectedDate(p.date)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 5,
                    backgroundColor: p.date === plan.date ? 'rgba(61,142,240,0.10)' : 'transparent',
                    color: p.date === plan.date ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    fontFamily: '"JetBrains Mono", monospace',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={(e) => {
                    if (p.date !== plan.date) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
                  }}
                  onMouseLeave={(e) => {
                    if (p.date !== plan.date) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <span>{p.date}</span>
                  <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {p.bias === 'LONG' && <span style={{ color: '#00C47A' }}>▲</span>}
                    {p.bias === 'SHORT' && <span style={{ color: '#F04848' }}>▼</span>}
                    {p.bias === 'NEUTRAL' && <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                    {p.reviewed && (
                      <span style={{ fontSize: 9, color: p.followedPlan === 'yes' ? '#00C47A' : p.followedPlan === 'partial' ? '#F0A030' : '#F04848' }}>
                        ✓
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color, fontFamily: '"JetBrains Mono", monospace' }}>{value}</div>
    </div>
  );
}
