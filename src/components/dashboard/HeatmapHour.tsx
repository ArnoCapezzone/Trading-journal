import { useState } from 'react';

interface Cell {
  day: number;
  hour: number;
  avgPnl: number;
  count: number;
}

interface Props {
  data: Cell[][];
  currency?: string;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getCellColor(avgPnl: number, count: number, maxAbs: number): string {
  if (count === 0) return 'var(--bg-surface-2)';
  if (maxAbs === 0) return 'var(--bg-surface-2)';
  const intensity = Math.min(1, Math.abs(avgPnl) / maxAbs);
  if (avgPnl > 0) {
    const r = Math.round(0 + intensity * 0);
    const g = Math.round(80 + intensity * 129);
    const b = Math.round(50 + intensity * 72);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    const r = Math.round(100 + intensity * 155);
    const g = Math.round(30 + intensity * 17);
    const b = Math.round(30 + intensity * 17);
    return `rgb(${r}, ${g}, ${b})`;
  }
}

export default function HeatmapHour({ data, currency = 'USD' }: Props) {
  const c = currency === 'EUR' ? '€' : '$';
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    cell: Cell;
  } | null>(null);

  const allCells = data.flat();
  const maxAbs = Math.max(1, ...allCells.filter((c) => c.count > 0).map((c) => Math.abs(c.avgPnl)));

  const hours = Array.from({ length: 24 }, (_, i) => i);

  if (allCells.every((c) => c.count === 0)) {
    return (
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 8,
          padding: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 160,
          color: 'var(--text-tertiary)',
          fontSize: 13,
        }}
      >
        No trade timing data available
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 8,
        padding: '16px 16px 12px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Trade Timing Heatmap (Avg P&L by Hour)
      </div>

      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 600 }}>
          {/* Hour labels */}
          <div style={{ display: 'flex', marginLeft: 40 }}>
            {hours.map((h) => (
              <div
                key={h}
                style={{
                  width: 24,
                  textAlign: 'center',
                  fontSize: 9,
                  color: 'var(--text-tertiary)',
                  fontFamily: '"JetBrains Mono", monospace',
                  flexShrink: 0,
                }}
              >
                {h % 3 === 0 ? h : ''}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          {data.map((row, dayIdx) => (
            <div key={dayIdx} style={{ display: 'flex', alignItems: 'center', marginTop: 3 }}>
              <div
                style={{
                  width: 36,
                  fontSize: 10,
                  color: 'var(--text-tertiary)',
                  textAlign: 'right',
                  paddingRight: 6,
                  fontFamily: '"JetBrains Mono", monospace',
                  flexShrink: 0,
                }}
              >
                {DAY_LABELS[dayIdx]}
              </div>
              {row.map((cell) => (
                <div
                  key={cell.hour}
                  style={{
                    width: 24,
                    height: 18,
                    borderRadius: 2,
                    backgroundColor: getCellColor(cell.avgPnl, cell.count, maxAbs),
                    cursor: cell.count > 0 ? 'pointer' : 'default',
                    flexShrink: 0,
                    margin: '0 1px',
                    transition: 'opacity 0.1s',
                  }}
                  onMouseEnter={(e) => {
                    if (cell.count > 0) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const containerRect = e.currentTarget.closest('[data-heatmap]')?.getBoundingClientRect();
                      setTooltip({
                        x: rect.left - (containerRect?.left ?? 0) + 12,
                        y: rect.top - (containerRect?.top ?? 0) - 10,
                        cell,
                      });
                    }
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  data-heatmap="true"
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Loss</div>
        {[-1, -0.5, 0, 0.5, 1].map((v) => (
          <div
            key={v}
            style={{
              width: 16,
              height: 10,
              borderRadius: 2,
              backgroundColor: v === 0 ? 'var(--bg-surface-2)' : v > 0 ? getCellColor(v, 1, 1) : getCellColor(v, 1, 1),
            }}
          />
        ))}
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Win</div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 8 }}>| Gray = no trades</div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'absolute',
            left: tooltip.x,
            top: tooltip.y,
            backgroundColor: 'var(--bg-surface-2)',
            border: '1px solid var(--border-default)',
            borderRadius: 6,
            padding: '8px 12px',
            fontSize: 12,
            color: 'var(--text-primary)',
            pointerEvents: 'none',
            zIndex: 100,
            whiteSpace: 'nowrap',
            transform: 'translate(-50%, -100%)',
            fontFamily: '"JetBrains Mono", monospace',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {DAY_LABELS[tooltip.cell.day]} {tooltip.cell.hour}:00
          </div>
          <div>
            Avg P&L:{' '}
            <span style={{ color: tooltip.cell.avgPnl >= 0 ? '#00C47A' : '#F04848' }}>
              {tooltip.cell.avgPnl >= 0 ? '+' : ''}{c}{tooltip.cell.avgPnl.toFixed(2)}
            </span>
          </div>
          <div style={{ color: 'var(--text-tertiary)' }}>{tooltip.cell.count} trades</div>
        </div>
      )}
    </div>
  );
}
