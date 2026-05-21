import { useState } from 'react';
import { format, getDaysInMonth, getDay, addMonths, subMonths } from 'date-fns';

interface DayData {
  date: number;
  pnl: number;
  count: number;
}

interface Props {
  data: DayData[];
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
  currency?: string;
}

export default function CalendarView({ data, year, month, onMonthChange, currency = 'USD' }: Props) {
  const c = currency === 'EUR' ? '€' : '$';
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const dataMap = new Map(data.map((d) => [d.date, d]));
  const daysInMonth = getDaysInMonth(new Date(year, month, 1));

  // Day of week for the 1st (0=Sun→adjust to Mon=0)
  const firstDayJs = getDay(new Date(year, month, 1));
  const startOffset = firstDayJs === 0 ? 6 : firstDayJs - 1;

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  function handlePrev() {
    const d = subMonths(new Date(year, month, 1), 1);
    onMonthChange(d.getFullYear(), d.getMonth());
  }

  function handleNext() {
    const d = addMonths(new Date(year, month, 1), 1);
    onMonthChange(d.getFullYear(), d.getMonth());
  }

  function getDayBg(day: number): string {
    const d = dataMap.get(day);
    if (!d) return 'transparent';
    if (d.pnl > 0) return 'rgba(0, 209, 122, 0.2)';
    if (d.pnl < 0) return 'rgba(255, 77, 77, 0.2)';
    return 'rgba(77, 158, 255, 0.1)';
  }

  function getDayBorder(day: number): string {
    const d = dataMap.get(day);
    if (!d) return 'transparent';
    if (d.pnl > 0) return '#00C47A';
    if (d.pnl < 0) return '#F04848';
    return '#3D8EF0';
  }

  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div
      style={{
        backgroundColor: '#0D1017',
        border: '1px solid #252D3F',
        borderRadius: 8,
        padding: '16px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#8E97AC', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Calendar
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handlePrev}
            style={{ background: 'none', border: 'none', color: '#8E97AC', cursor: 'pointer', fontSize: 14, padding: '2px 6px' }}
          >
            ‹
          </button>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#EEF0F6', fontFamily: '"JetBrains Mono", monospace', minWidth: 100, textAlign: 'center' }}>
            {format(new Date(year, month, 1), 'MMMM yyyy')}
          </span>
          <button
            onClick={handleNext}
            style={{ background: 'none', border: 'none', color: '#8E97AC', cursor: 'pointer', fontSize: 14, padding: '2px 6px' }}
          >
            ›
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {WEEKDAYS.map((d) => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, color: '#8E97AC', fontWeight: 600, padding: '2px 0' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} />;
          const dayData = dataMap.get(day);
          const isHovered = hoveredDay === day;

          return (
            <div
              key={day}
              style={{
                position: 'relative',
                backgroundColor: getDayBg(day),
                border: `1px solid ${dayData ? getDayBorder(day) : '#252D3F'}`,
                borderRadius: 5,
                padding: '5px 4px',
                minHeight: 42,
                cursor: dayData ? 'pointer' : 'default',
                transition: 'opacity 0.15s',
                opacity: isHovered ? 0.8 : 1,
              }}
              onMouseEnter={() => dayData && setHoveredDay(day)}
              onMouseLeave={() => setHoveredDay(null)}
            >
              <div style={{ fontSize: 10, color: '#8E97AC', fontFamily: '"JetBrains Mono", monospace' }}>
                {day}
              </div>
              {dayData && (
                <div
                  style={{
                    fontSize: 9,
                    marginTop: 2,
                    color: dayData.pnl >= 0 ? '#00C47A' : '#F04848',
                    fontFamily: '"JetBrains Mono", monospace',
                    lineHeight: 1.3,
                  }}
                >
                  {dayData.pnl >= 0 ? '+' : ''}{c}{Math.abs(dayData.pnl) >= 1000 ? (dayData.pnl / 1000).toFixed(1) + 'k' : dayData.pnl.toFixed(0)}
                </div>
              )}

              {/* Hover tooltip */}
              {isHovered && dayData && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '110%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: '#141823',
                    border: '1px solid #252D3F',
                    borderRadius: 6,
                    padding: '8px 10px',
                    fontSize: 11,
                    color: '#EEF0F6',
                    whiteSpace: 'nowrap',
                    zIndex: 200,
                    fontFamily: '"JetBrains Mono", monospace',
                    pointerEvents: 'none',
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 3 }}>
                    {format(new Date(year, month, day), 'dd MMM yyyy')}
                  </div>
                  <div>
                    P&L:{' '}
                    <span style={{ color: dayData.pnl >= 0 ? '#00C47A' : '#F04848' }}>
                      {dayData.pnl >= 0 ? '+' : ''}{c}{dayData.pnl.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ color: '#8E97AC' }}>{dayData.count} trade{dayData.count !== 1 ? 's' : ''}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
