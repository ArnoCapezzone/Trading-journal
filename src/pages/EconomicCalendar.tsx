import { useState, useEffect, useMemo } from 'react';
import {
  loadCalendar,
  groupByDay,
  impactColor,
  getCurrencies,
  type EconomicEvent,
  type Impact,
} from '../lib/economicCalendar';
import { useIsMobile } from '../hooks/useMediaQuery';

const ALL_IMPACTS: Impact[] = ['High', 'Medium', 'Low', 'Holiday'];
const FX_MAJORS = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD'];

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

function formatDay(iso: string): { dayName: string; dayNum: string; month: string; isToday: boolean; isPast: boolean } {
  try {
    const d = new Date(iso + 'T00:00:00');
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const isPast = d < new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = String(d.getDate());
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    return { dayName, dayNum, month, isToday, isPast };
  } catch {
    return { dayName: '', dayNum: '', month: '', isToday: false, isPast: false };
  }
}

function relativeTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const absMin = Math.abs(diff) / 60000;
  if (absMin < 1) return 'now';
  if (absMin < 60) {
    const min = Math.round(absMin);
    return diff < 0 ? `${min}m ago` : `in ${min}m`;
  }
  const absH = absMin / 60;
  if (absH < 24) {
    const h = Math.round(absH);
    return diff < 0 ? `${h}h ago` : `in ${h}h`;
  }
  const d = Math.round(absH / 24);
  return diff < 0 ? `${d}d ago` : `in ${d}d`;
}

export default function EconomicCalendarPage() {
  const isMobile = useIsMobile();
  const [thisWeek, setThisWeek] = useState<EconomicEvent[]>([]);
  const [nextWeek, setNextWeek] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [fromCache, setFromCache] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [view, setView] = useState<'this' | 'next'>('this');
  const [impactFilter, setImpactFilter] = useState<Set<Impact>>(new Set(['High', 'Medium']));
  const [currencyFilter, setCurrencyFilter] = useState<Set<string>>(new Set());

  async function refresh(force = false) {
    setLoading(true);
    setError('');
    setInfo('');
    try {
      const result = await loadCalendar(force);
      setThisWeek(result.thisWeek);
      setNextWeek(result.nextWeek);
      setFromCache(result.fromCache);
      setFetchedAt(result.fetchedAt);
      if (result.error) setInfo(result.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const allEvents = view === 'this' ? thisWeek : nextWeek;
  const availableCurrencies = useMemo(() => getCurrencies([...thisWeek, ...nextWeek]), [thisWeek, nextWeek]);

  const filtered = useMemo(() => {
    return allEvents.filter((e) => {
      if (!impactFilter.has(e.impact)) return false;
      if (currencyFilter.size > 0 && !currencyFilter.has(e.country)) return false;
      return true;
    });
  }, [allEvents, impactFilter, currencyFilter]);

  const grouped = useMemo(() => groupByDay(filtered), [filtered]);

  // Stats
  const highCount = filtered.filter((e) => e.impact === 'High').length;

  function toggleImpact(i: Impact) {
    const next = new Set(impactFilter);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setImpactFilter(next);
  }

  function toggleCurrency(c: string) {
    const next = new Set(currencyFilter);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    setCurrencyFilter(next);
  }

  return (
    <div style={{ padding: isMobile ? 14 : 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', backgroundColor: 'rgba(240,72,72,0.10)', border: '1px solid rgba(240,72,72,0.3)', borderRadius: 4, fontSize: 10, color: '#F04848', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 8 }}>
            ECONOMIC CALENDAR
          </div>
          <div style={{ fontSize: 13, color: '#8E97AC', lineHeight: 1.6 }}>
            Macro events that move markets. Plan entries/exits around high-impact releases.
          </div>
        </div>
        <button
          onClick={() => refresh(true)}
          disabled={loading}
          style={{
            padding: '7px 14px',
            backgroundColor: '#141823',
            border: '1px solid #252D3F',
            borderRadius: 5,
            color: '#EEF0F6',
            fontSize: 12,
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {loading ? '⟳ Loading…' : '⟳ Refresh'}
        </button>
      </div>

      {/* Week selector + stats */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 2, backgroundColor: '#0D1017', border: '1px solid #1E2839', borderRadius: 7, padding: 3 }}>
          {[
            { v: 'this', label: 'This Week', count: thisWeek.length },
            { v: 'next', label: 'Next Week', count: nextWeek.length },
          ].map((w) => (
            <button
              key={w.v}
              onClick={() => setView(w.v as 'this' | 'next')}
              style={{
                padding: '5px 14px',
                borderRadius: 5,
                border: 'none',
                backgroundColor: view === w.v ? '#19202F' : 'transparent',
                color: view === w.v ? '#EEF0F6' : '#4A5368',
                fontSize: 12,
                fontWeight: view === w.v ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.12s',
              }}
            >
              {w.label}
              <span style={{ marginLeft: 6, fontSize: 10, color: '#4A5368', fontFamily: '"JetBrains Mono", monospace' }}>{w.count}</span>
            </button>
          ))}
        </div>

        <div style={{ fontSize: 11, color: '#4A5368', fontFamily: '"JetBrains Mono", monospace' }}>
          {filtered.length} of {allEvents.length} events · <span style={{ color: '#F04848' }}>{highCount} high-impact</span>
        </div>

        {fetchedAt > 0 && (
          <div style={{ marginLeft: 'auto', fontSize: 10, color: '#2E3A52', fontFamily: '"JetBrains Mono", monospace' }}>
            {fromCache ? '(cached) ' : ''}updated {relativeTime(new Date(fetchedAt).toISOString())}
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 14px', backgroundColor: '#0D1017', border: '1px solid #1E2839', borderRadius: 8 }}>
        <div>
          <div style={{ fontSize: 9, color: '#4A5368', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 6 }}>Impact</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ALL_IMPACTS.map((i) => {
              const active = impactFilter.has(i);
              const color = impactColor(i);
              return (
                <button
                  key={i}
                  onClick={() => toggleImpact(i)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 4,
                    border: `1px solid ${active ? color : '#252D3F'}`,
                    backgroundColor: active ? color + '15' : 'transparent',
                    color: active ? color : '#8E97AC',
                    fontSize: 11,
                    fontWeight: active ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                  }}
                >
                  {i}
                </button>
              );
            })}
          </div>
        </div>

        {availableCurrencies.length > 0 && (
          <div>
            <div style={{ fontSize: 9, color: '#4A5368', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 6 }}>
              Currency {currencyFilter.size > 0 && <span style={{ color: '#3D8EF0' }}>({currencyFilter.size} selected)</span>}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {FX_MAJORS.filter((c) => availableCurrencies.includes(c)).map((c) => {
                const active = currencyFilter.has(c);
                return (
                  <button
                    key={c}
                    onClick={() => toggleCurrency(c)}
                    style={{
                      padding: '3px 10px',
                      borderRadius: 4,
                      border: `1px solid ${active ? '#3D8EF0' : '#252D3F'}`,
                      backgroundColor: active ? 'rgba(61,142,240,0.12)' : 'transparent',
                      color: active ? '#3D8EF0' : '#8E97AC',
                      fontSize: 11,
                      fontWeight: active ? 600 : 400,
                      cursor: 'pointer',
                      fontFamily: '"JetBrains Mono", monospace',
                    }}
                  >
                    {c}
                  </button>
                );
              })}
              {currencyFilter.size > 0 && (
                <button
                  onClick={() => setCurrencyFilter(new Set())}
                  style={{ padding: '3px 10px', borderRadius: 4, border: 'none', background: 'none', color: '#4A5368', fontSize: 11, cursor: 'pointer' }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Status messages */}
      {error && (
        <div style={{ padding: '10px 14px', backgroundColor: 'rgba(240,72,72,0.08)', border: '1px solid rgba(240,72,72,0.3)', borderRadius: 6, fontSize: 12, color: '#F04848' }}>
          ⚠️ {error}
        </div>
      )}
      {info && (
        <div style={{ padding: '8px 14px', backgroundColor: 'rgba(240,160,48,0.08)', border: '1px solid rgba(240,160,48,0.3)', borderRadius: 6, fontSize: 11, color: '#F0A030' }}>
          {info}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && grouped.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#8E97AC', fontSize: 13 }}>
          Loading economic events…
        </div>
      )}

      {/* Empty state */}
      {!loading && grouped.length === 0 && !error && (
        <div style={{ padding: 40, textAlign: 'center', color: '#8E97AC', fontSize: 13, backgroundColor: '#0D1017', border: '1px dashed #252D3F', borderRadius: 8 }}>
          No events match your filters. Try enabling more impact levels or clearing currency filter.
        </div>
      )}

      {/* Days */}
      {grouped.map((day) => {
        const dayMeta = formatDay(day.date);
        return (
          <div key={day.date} style={{ backgroundColor: '#0D1017', border: '1px solid #1E2839', borderRadius: 9, overflow: 'hidden' }}>
            {/* Day header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '12px 16px',
                backgroundColor: dayMeta.isToday ? 'rgba(0,196,122,0.06)' : '#0A0D14',
                borderBottom: '1px solid #1E2839',
                borderLeft: dayMeta.isToday ? '3px solid #00C47A' : undefined,
              }}
            >
              <div style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                <div style={{ fontSize: 10, color: dayMeta.isToday ? '#00C47A' : '#4A5368', fontWeight: 600, letterSpacing: '0.08em' }}>
                  {dayMeta.dayName.toUpperCase()}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: dayMeta.isToday ? '#EEF0F6' : '#C8CDD8' }}>{dayMeta.dayNum}</span>
                  <span style={{ fontSize: 11, color: '#8E97AC' }}>{dayMeta.month}</span>
                </div>
              </div>
              {dayMeta.isToday && (
                <span style={{ fontSize: 10, color: '#00C47A', fontWeight: 700, padding: '3px 8px', backgroundColor: 'rgba(0,196,122,0.12)', borderRadius: 3, letterSpacing: '0.06em' }}>
                  TODAY
                </span>
              )}
              <div style={{ marginLeft: 'auto', fontSize: 11, color: '#4A5368', fontFamily: '"JetBrains Mono", monospace' }}>
                {day.events.length} event{day.events.length !== 1 ? 's' : ''}
                {' · '}
                {day.events.filter((e) => e.impact === 'High').length} high
              </div>
            </div>

            {/* Events list */}
            <div>
              {day.events.map((e) => {
                const color = impactColor(e.impact);
                const past = dayMeta.isPast || (dayMeta.isToday && new Date(e.date).getTime() < Date.now());
                return (
                  <div
                    key={e.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '50px 50px 1fr' : '60px 60px 1fr auto',
                      alignItems: 'center',
                      gap: isMobile ? 10 : 14,
                      padding: isMobile ? '10px 12px' : '10px 16px',
                      borderBottom: '1px solid #181E2C',
                      opacity: past ? 0.55 : 1,
                    }}
                  >
                    {/* Time */}
                    <div style={{ fontSize: 12, color: '#C8CDD8', fontFamily: '"JetBrains Mono", monospace', fontWeight: 500 }}>
                      {formatTime(e.date)}
                    </div>

                    {/* Currency + impact dot */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, flexShrink: 0, boxShadow: `0 0 6px ${color}80` }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#EEF0F6', fontFamily: '"JetBrains Mono", monospace' }}>{e.country}</span>
                    </div>

                    {/* Title */}
                    <div style={{ fontSize: 12, color: '#EEF0F6', lineHeight: 1.4, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {e.title}
                    </div>

                    {/* Values (desktop only) */}
                    {!isMobile && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, fontFamily: '"JetBrains Mono", monospace', flexShrink: 0 }}>
                        {e.actual && (
                          <span title="Actual" style={{ color: '#00C47A', fontWeight: 600 }}>
                            A {e.actual}
                          </span>
                        )}
                        {e.forecast && (
                          <span title="Forecast" style={{ color: '#8E97AC' }}>
                            F {e.forecast}
                          </span>
                        )}
                        {e.previous && (
                          <span title="Previous" style={{ color: '#4A5368' }}>
                            P {e.previous}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Legend / source */}
      <div style={{ marginTop: 4, padding: '8px 12px', fontSize: 10, color: '#2E3A52', textAlign: 'center', fontFamily: '"JetBrains Mono", monospace' }}>
        A = Actual · F = Forecast · P = Previous · Source: Forex Factory · Auto-refresh every 1h
      </div>
    </div>
  );
}
