import { useState } from 'react';
import type { TradeFilters as TF, SetupType } from '../../types/trade';

interface Props {
  filters: TF;
  onFiltersChange: (f: Partial<TF>) => void;
  onClear: () => void;
  availableInstruments: string[];
}

const SETUPS: SetupType[] = ['BREAKOUT', 'REVERSAL', 'SUPPORT_RESISTANCE', 'TREND_FOLLOWING', 'RANGE', 'NEWS', 'OTHER'];

function activeCount(f: TF): number {
  let n = 0;
  if (f.instruments.length > 0) n++;
  if (f.direction !== 'ALL') n++;
  if (f.status !== 'ALL') n++;
  if (f.setups.length > 0) n++;
  if (f.source !== 'ALL') n++;
  if (f.dateFrom) n++;
  if (f.dateTo) n++;
  return n;
}

function toDateInput(d?: Date): string {
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}

export default function TradeFilters({ filters, onFiltersChange, onClear, availableInstruments }: Props) {
  const [instrOpen, setInstrOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const active = activeCount(filters);

  function toggleInstr(instr: string) {
    const set = new Set(filters.instruments);
    if (set.has(instr)) set.delete(instr); else set.add(instr);
    onFiltersChange({ instruments: Array.from(set) });
  }

  function toggleSetup(setup: SetupType) {
    const set = new Set(filters.setups);
    if (set.has(setup)) set.delete(setup); else set.add(setup);
    onFiltersChange({ setups: Array.from(set) });
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    color: 'var(--text-tertiary)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 4,
  };

  const radioGroupStyle: React.CSSProperties = {
    display: 'flex',
    gap: 4,
  };

  function RadioBtn({ value, current, onChange, label }: { value: string; current: string; onChange: (v: string) => void; label: string }) {
    const active = current === value;
    return (
      <button
        onClick={() => onChange(value)}
        style={{
          padding: '4px 10px',
          borderRadius: 4,
          border: `1px solid ${active ? '#3D8EF0' : 'var(--border-default)'}`,
          backgroundColor: active ? 'rgba(77, 158, 255, 0.15)' : 'transparent',
          color: active ? '#3D8EF0' : 'var(--text-tertiary)',
          fontSize: 11,
          fontWeight: active ? 600 : 400,
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 8,
        padding: '14px 16px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        alignItems: 'flex-end',
      }}
    >
      {/* Instruments */}
      <div style={{ position: 'relative', minWidth: 120 }}>
        <div style={labelStyle}>Instrument</div>
        <button
          onClick={() => setInstrOpen((o) => !o)}
          style={{
            padding: '5px 10px',
            backgroundColor: 'var(--bg-surface-2)',
            border: `1px solid ${filters.instruments.length > 0 ? '#3D8EF0' : 'var(--border-default)'}`,
            borderRadius: 4,
            color: filters.instruments.length > 0 ? '#3D8EF0' : 'var(--text-tertiary)',
            fontSize: 11,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            minWidth: 120,
          }}
        >
          {filters.instruments.length > 0 ? `${filters.instruments.length} selected` : 'All instruments'}
          <span>▾</span>
        </button>
        {instrOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              backgroundColor: 'var(--bg-surface-2)',
              border: '1px solid var(--border-default)',
              borderRadius: 6,
              zIndex: 100,
              minWidth: 150,
              overflow: 'hidden',
            }}
          >
            {availableInstruments.length === 0 && (
              <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-tertiary)' }}>No instruments</div>
            )}
            {availableInstruments.map((instr) => (
              <div
                key={instr}
                onClick={() => toggleInstr(instr)}
                style={{
                  padding: '7px 12px',
                  fontSize: 12,
                  fontFamily: '"JetBrains Mono", monospace',
                  color: filters.instruments.includes(instr) ? '#3D8EF0' : 'var(--text-primary)',
                  cursor: 'pointer',
                  backgroundColor: filters.instruments.includes(instr) ? 'rgba(77,158,255,0.1)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onMouseEnter={(e) => { if (!filters.instruments.includes(instr)) (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = filters.instruments.includes(instr) ? 'rgba(77,158,255,0.1)' : 'transparent'; }}
              >
                <span>{filters.instruments.includes(instr) ? '✓' : '○'}</span>
                {instr}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Direction */}
      <div>
        <div style={labelStyle}>Direction</div>
        <div style={radioGroupStyle}>
          {(['ALL', 'LONG', 'SHORT'] as const).map((v) => (
            <RadioBtn key={v} value={v} current={filters.direction} onChange={(val) => onFiltersChange({ direction: val as TF['direction'] })} label={v === 'ALL' ? 'All' : v} />
          ))}
        </div>
      </div>

      {/* Status */}
      <div>
        <div style={labelStyle}>Status</div>
        <div style={radioGroupStyle}>
          <RadioBtn value="ALL" current={filters.status} onChange={(v) => onFiltersChange({ status: v as TF['status'] })} label="All" />
          <RadioBtn value="COMPLETE" current={filters.status} onChange={(v) => onFiltersChange({ status: v as TF['status'] })} label="Complete" />
          <RadioBtn value="PENDING_REVIEW" current={filters.status} onChange={(v) => onFiltersChange({ status: v as TF['status'] })} label="Pending" />
        </div>
      </div>

      {/* Setup multiselect */}
      <div style={{ position: 'relative' }}>
        <div style={labelStyle}>Setup</div>
        <button
          onClick={() => setSetupOpen((o) => !o)}
          style={{
            padding: '5px 10px',
            backgroundColor: 'var(--bg-surface-2)',
            border: `1px solid ${filters.setups.length > 0 ? '#3D8EF0' : 'var(--border-default)'}`,
            borderRadius: 4,
            color: filters.setups.length > 0 ? '#3D8EF0' : 'var(--text-tertiary)',
            fontSize: 11,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            minWidth: 110,
          }}
        >
          {filters.setups.length > 0 ? `${filters.setups.length} selected` : 'All setups'}
          <span>▾</span>
        </button>
        {setupOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              backgroundColor: 'var(--bg-surface-2)',
              border: '1px solid var(--border-default)',
              borderRadius: 6,
              zIndex: 100,
              minWidth: 160,
              overflow: 'hidden',
            }}
          >
            {SETUPS.map((s) => (
              <div
                key={s}
                onClick={() => toggleSetup(s)}
                style={{
                  padding: '7px 12px',
                  fontSize: 11,
                  color: filters.setups.includes(s) ? '#3D8EF0' : 'var(--text-primary)',
                  cursor: 'pointer',
                  backgroundColor: filters.setups.includes(s) ? 'rgba(77,158,255,0.1)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>{filters.setups.includes(s) ? '✓' : '○'}</span>
                {s}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Source */}
      <div>
        <div style={labelStyle}>Source</div>
        <div style={radioGroupStyle}>
          {(['ALL', 'MANUAL', 'MT5_IMPORT'] as const).map((v) => (
            <RadioBtn key={v} value={v} current={filters.source} onChange={(val) => onFiltersChange({ source: val as TF['source'] })} label={v === 'ALL' ? 'All' : v === 'MANUAL' ? 'Manual' : 'MT5'} />
          ))}
        </div>
      </div>

      {/* Date range */}
      <div>
        <div style={labelStyle}>From</div>
        <input
          type="date"
          value={toDateInput(filters.dateFrom)}
          onChange={(e) => onFiltersChange({ dateFrom: e.target.value ? new Date(e.target.value) : undefined })}
          style={{
            padding: '5px 8px',
            backgroundColor: 'var(--bg-surface-2)',
            border: '1px solid var(--border-default)',
            borderRadius: 4,
            color: 'var(--text-primary)',
            fontSize: 11,
            fontFamily: '"JetBrains Mono", monospace',
          }}
        />
      </div>
      <div>
        <div style={labelStyle}>To</div>
        <input
          type="date"
          value={toDateInput(filters.dateTo)}
          onChange={(e) => onFiltersChange({ dateTo: e.target.value ? new Date(e.target.value) : undefined })}
          style={{
            padding: '5px 8px',
            backgroundColor: 'var(--bg-surface-2)',
            border: '1px solid var(--border-default)',
            borderRadius: 4,
            color: 'var(--text-primary)',
            fontSize: 11,
            fontFamily: '"JetBrains Mono", monospace',
          }}
        />
      </div>

      {/* Clear */}
      {active > 0 && (
        <button
          onClick={onClear}
          style={{
            padding: '5px 12px',
            backgroundColor: 'transparent',
            border: '1px solid #F04848',
            borderRadius: 4,
            color: '#F04848',
            fontSize: 11,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 14,
          }}
        >
          ✕ Clear ({active})
        </button>
      )}
    </div>
  );
}
