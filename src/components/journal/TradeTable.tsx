import { useState } from 'react';
import type { Trade } from '../../types/trade';
import { calculateTrade } from '../../utils/calculations';
import { format } from 'date-fns';

interface Props {
  trades: Trade[];
  onView: (trade: Trade) => void;
  onEdit: (trade: Trade) => void;
  onDelete: (id: string) => void;
}

type SortKey = 'exitTime' | 'instrument' | 'direction' | 'pnlDollar' | 'pnlPips' | 'lotSize' | 'duration' | 'setup';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 25;

function IconButton({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: 'none',
        border: '1px solid var(--border-default)',
        borderRadius: 4,
        color: 'var(--text-tertiary)',
        cursor: 'pointer',
        padding: '3px 5px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s',
        lineHeight: 1,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
        (e.currentTarget as HTMLButtonElement).style.borderColor = '#3D8EF0';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-tertiary)';
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-default)';
      }}
    >
      {children}
    </button>
  );
}

function fmtDuration(min: number): string {
  if (!min) return '—';
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ''}`;
}

export default function TradeTable({ trades, onView, onEdit, onDelete }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('exitTime');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(0);
  }

  const calculated = trades.map((t) => ({ trade: t, calc: calculateTrade(t) }));

  const sorted = [...calculated].sort((a, b) => {
    let aVal: number | string = 0;
    let bVal: number | string = 0;
    switch (sortKey) {
      case 'exitTime':
        aVal = new Date(a.trade.exitTime).getTime();
        bVal = new Date(b.trade.exitTime).getTime();
        break;
      case 'instrument':
        aVal = a.trade.instrument;
        bVal = b.trade.instrument;
        break;
      case 'direction':
        aVal = a.trade.direction;
        bVal = b.trade.direction;
        break;
      case 'pnlDollar':
        aVal = a.calc.pnlDollar;
        bVal = b.calc.pnlDollar;
        break;
      case 'pnlPips':
        aVal = a.calc.pnlPips;
        bVal = b.calc.pnlPips;
        break;
      case 'lotSize':
        aVal = a.trade.lotSize;
        bVal = b.trade.lotSize;
        break;
      case 'duration':
        aVal = a.calc.durationMinutes;
        bVal = b.calc.durationMinutes;
        break;
      case 'setup':
        aVal = a.trade.setup ?? '';
        bVal = b.trade.setup ?? '';
        break;
    }
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortDir === 'asc'
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function SortHeader({ col, label }: { col: SortKey; label: string }) {
    const active = sortKey === col;
    return (
      <th
        onClick={() => handleSort(col)}
        style={{
          padding: '8px 10px',
          textAlign: 'left',
          fontSize: 10,
          fontWeight: 600,
          color: active ? '#3D8EF0' : 'var(--text-tertiary)',
          cursor: 'pointer',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          borderBottom: '1px solid var(--border-default)',
          whiteSpace: 'nowrap',
          userSelect: 'none',
        }}
      >
        {label} {active ? (sortDir === 'asc' ? '↑' : '↓') : ''}
      </th>
    );
  }

  if (trades.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '60px 24px',
          color: 'var(--text-tertiary)',
          fontSize: 14,
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>No trades found</div>
        <div>Add a trade manually or import from MT5 to get started.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-app)' }}>
              <SortHeader col="exitTime" label="Date / Time" />
              <SortHeader col="instrument" label="Instrument" />
              <SortHeader col="direction" label="L/S" />
              <th style={{ padding: '8px 10px', fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', borderBottom: '1px solid var(--border-default)', textAlign: 'right' }}>Entry</th>
              <th style={{ padding: '8px 10px', fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', borderBottom: '1px solid var(--border-default)', textAlign: 'right' }}>Exit</th>
              <SortHeader col="duration" label="Duration" />
              <SortHeader col="pnlPips" label="Pips" />
              <SortHeader col="pnlDollar" label="P&L $" />
              <th style={{ padding: '8px 10px', fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', borderBottom: '1px solid var(--border-default)', textAlign: 'right' }}>P&L %</th>
              <SortHeader col="setup" label="Setup" />
              <th style={{ padding: '8px 10px', fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', borderBottom: '1px solid var(--border-default)' }}>TF</th>
              <th style={{ padding: '8px 10px', fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', borderBottom: '1px solid var(--border-default)' }}>Status</th>
              <th style={{ padding: '8px 10px', fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', borderBottom: '1px solid var(--border-default)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map(({ trade, calc }) => {
              const rowBg = calc.isWin
                ? 'rgba(0, 209, 122, 0.04)'
                : 'rgba(255, 77, 77, 0.04)';

              return (
                <tr
                  key={trade.id}
                  style={{ backgroundColor: rowBg, borderBottom: '1px solid var(--border-default)' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.backgroundColor = calc.isWin
                      ? 'rgba(0, 209, 122, 0.08)'
                      : 'rgba(255, 77, 77, 0.08)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.backgroundColor = rowBg;
                  }}
                >
                  <td style={{ padding: '7px 10px', fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                    {format(new Date(trade.exitTime), 'dd/MM/yy HH:mm')}
                  </td>
                  <td style={{ padding: '7px 10px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: '"JetBrains Mono", monospace' }}>
                    {trade.instrument}
                  </td>
                  <td style={{ padding: '7px 10px' }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: 3,
                        fontSize: 10,
                        fontWeight: 700,
                        fontFamily: '"JetBrains Mono", monospace',
                        backgroundColor: trade.direction === 'LONG' ? 'rgba(0, 209, 122, 0.15)' : 'rgba(255, 77, 77, 0.15)',
                        color: trade.direction === 'LONG' ? '#00C47A' : '#F04848',
                      }}
                    >
                      {trade.direction === 'LONG' ? 'L' : 'S'}
                    </span>
                  </td>
                  <td style={{ padding: '7px 10px', fontFamily: '"JetBrains Mono", monospace', fontSize: 11, textAlign: 'right', color: 'var(--text-primary)' }}>
                    {trade.entryPrice.toFixed(5)}
                  </td>
                  <td style={{ padding: '7px 10px', fontFamily: '"JetBrains Mono", monospace', fontSize: 11, textAlign: 'right', color: 'var(--text-primary)' }}>
                    {trade.exitPrice.toFixed(5)}
                  </td>
                  <td style={{ padding: '7px 10px', fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {fmtDuration(calc.durationMinutes)}
                  </td>
                  <td
                    style={{
                      padding: '7px 10px',
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 11,
                      textAlign: 'right',
                      color: calc.pnlPips >= 0 ? '#00C47A' : '#F04848',
                    }}
                  >
                    {calc.pnlPips >= 0 ? '+' : ''}{calc.pnlPips.toFixed(1)}
                  </td>
                  <td
                    style={{
                      padding: '7px 10px',
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 12,
                      fontWeight: 600,
                      textAlign: 'right',
                      color: calc.pnlDollar >= 0 ? '#00C47A' : '#F04848',
                    }}
                  >
                    {calc.pnlDollar >= 0 ? '+' : ''}${calc.pnlDollar.toFixed(2)}
                  </td>
                  <td
                    style={{
                      padding: '7px 10px',
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 11,
                      textAlign: 'right',
                      color: calc.pnlPercent !== null ? (calc.pnlPercent >= 0 ? '#00C47A' : '#F04848') : 'var(--text-tertiary)',
                    }}
                  >
                    {calc.pnlPercent !== null ? `${calc.pnlPercent >= 0 ? '+' : ''}${calc.pnlPercent.toFixed(2)}%` : '—'}
                  </td>
                  <td style={{ padding: '7px 10px', fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {trade.setup ?? '—'}
                  </td>
                  <td style={{ padding: '7px 10px', fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {trade.timeframe ?? '—'}
                  </td>
                  <td style={{ padding: '7px 10px' }}>
                    {trade.status === 'COMPLETE' ? (
                      <span style={{ color: '#00C47A', fontSize: 10, fontWeight: 600 }}>✓ Complete</span>
                    ) : (
                      <span style={{ color: '#F0A030', fontSize: 10, fontWeight: 600 }}>⚠ Review</span>
                    )}
                  </td>
                  <td style={{ padding: '7px 10px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <IconButton onClick={() => onView(trade)} title="View">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3">
                          <circle cx="6" cy="6" r="2.5" />
                          <path d="M1 6c1.4-3 8.6-3 10 0C9.6 9 2.4 9 1 6z" />
                        </svg>
                      </IconButton>
                      <IconButton onClick={() => onEdit(trade)} title="Edit">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3">
                          <path d="M8.5 1.5l2 2-7 7H1.5v-2l7-7z" />
                        </svg>
                      </IconButton>
                      {confirmDelete === trade.id ? (
                        <>
                          <IconButton onClick={() => { onDelete(trade.id); setConfirmDelete(null); }} title="Confirm Delete">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#F04848" strokeWidth="1.5">
                              <path d="M2 2l8 8M10 2L2 10" />
                            </svg>
                          </IconButton>
                          <IconButton onClick={() => setConfirmDelete(null)} title="Cancel">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#8E97AC" strokeWidth="1.5">
                              <path d="M2 6h8" />
                            </svg>
                          </IconButton>
                        </>
                      ) : (
                        <IconButton onClick={() => setConfirmDelete(trade.id)} title="Delete">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3">
                            <path d="M1.5 3h9M4 3V2h4v1M2.5 3l.7 7h5.6l.7-7" />
                          </svg>
                        </IconButton>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderTop: '1px solid var(--border-default)',
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {sorted.length} trades — page {page + 1} of {totalPages}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{
                padding: '4px 10px',
                backgroundColor: 'var(--bg-surface-2)',
                border: '1px solid var(--border-default)',
                borderRadius: 4,
                color: page === 0 ? 'var(--border-default)' : 'var(--text-tertiary)',
                cursor: page === 0 ? 'not-allowed' : 'pointer',
                fontSize: 12,
              }}
            >
              ‹ Prev
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = Math.max(0, Math.min(totalPages - 5, page - 2)) + i;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: page === pageNum ? '#3D8EF0' : 'var(--bg-surface-2)',
                    border: `1px solid ${page === pageNum ? '#3D8EF0' : 'var(--border-default)'}`,
                    borderRadius: 4,
                    color: page === pageNum ? 'var(--bg-app)' : 'var(--text-tertiary)',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontFamily: '"JetBrains Mono", monospace',
                  }}
                >
                  {pageNum + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              style={{
                padding: '4px 10px',
                backgroundColor: 'var(--bg-surface-2)',
                border: '1px solid var(--border-default)',
                borderRadius: 4,
                color: page === totalPages - 1 ? 'var(--border-default)' : 'var(--text-tertiary)',
                cursor: page === totalPages - 1 ? 'not-allowed' : 'pointer',
                fontSize: 12,
              }}
            >
              Next ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
