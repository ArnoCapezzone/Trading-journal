import type { Trade } from '../../types/trade';
import { calculateTrade } from '../../utils/calculations';
import { format } from 'date-fns';
import { useSettingsStore } from '../../store/settingsStore';

interface Props {
  trade: Trade | null;
  onClose: () => void;
  onEdit: (trade: Trade) => void;
}

function Row({ label, value, mono = false, color }: { label: string; value: string | undefined; mono?: boolean; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '7px 0', borderBottom: '1px solid #252D3F' }}>
      <div style={{ fontSize: 11, color: '#8E97AC', minWidth: 140 }}>{label}</div>
      <div style={{ fontSize: 12, color: color ?? '#EEF0F6', textAlign: 'right', fontFamily: mono ? '"JetBrains Mono", monospace' : 'inherit', fontWeight: mono ? 500 : 400 }}>
        {value ?? '—'}
      </div>
    </div>
  );
}

export default function TradeDetail({ trade, onClose, onEdit }: Props) {
  const accountBalance = useSettingsStore((s) => s.accountBalance);
  const currency = useSettingsStore((s) => s.currency);
  const c = currency === 'EUR' ? '€' : '$';

  if (!trade) return null;

  const calc = calculateTrade(trade, accountBalance);

  const overlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(2px)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  };

  const modal: React.CSSProperties = {
    backgroundColor: '#0D1017',
    border: '1px solid #252D3F',
    borderRadius: 10,
    width: '100%',
    maxWidth: 620,
    maxHeight: '90vh',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  };

  function fmtDuration(min: number): string {
    if (!min) return '—';
    if (min < 60) return `${min}m`;
    return `${Math.floor(min / 60)}h ${min % 60}m`;
  }

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #252D3F' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#EEF0F6', fontFamily: '"JetBrains Mono", monospace' }}>{trade.instrument}</span>
            <span style={{
              padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
              backgroundColor: trade.direction === 'LONG' ? 'rgba(0,209,122,0.15)' : 'rgba(255,77,77,0.15)',
              color: trade.direction === 'LONG' ? '#00C47A' : '#F04848',
              fontFamily: '"JetBrains Mono", monospace',
            }}>
              {trade.direction}
            </span>
            <span style={{
              padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
              backgroundColor: calc.isWin ? 'rgba(0,209,122,0.1)' : 'rgba(255,77,77,0.1)',
              color: calc.isWin ? '#00C47A' : '#F04848',
            }}>
              {calc.pnlDollar >= 0 ? '+' : ''}{c}{calc.pnlDollar.toFixed(2)}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => onEdit(trade)}
              style={{ padding: '6px 14px', backgroundColor: '#3D8EF0', border: 'none', borderRadius: 5, color: '#080B12', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Edit
            </button>
            <button
              onClick={onClose}
              style={{ padding: '6px 12px', backgroundColor: 'transparent', border: '1px solid #252D3F', borderRadius: 5, color: '#8E97AC', fontSize: 14, cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
        </div>

        <div style={{ padding: '16px 20px', flex: 1 }}>
          {/* P&L Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'P&L', value: `${calc.pnlDollar >= 0 ? '+' : ''}${c}${calc.pnlDollar.toFixed(2)}`, color: calc.isWin ? '#00C47A' : '#F04848' },
              { label: 'Pips', value: `${calc.pnlPips >= 0 ? '+' : ''}${calc.pnlPips.toFixed(1)}`, color: calc.isWin ? '#00C47A' : '#F04848' },
              { label: 'R:R', value: calc.rrRatio !== null ? `${calc.rrRatio.toFixed(2)}R` : '—', color: '#EEF0F6' },
              { label: 'Duration', value: fmtDuration(calc.durationMinutes), color: '#EEF0F6' },
            ].map((item) => (
              <div key={item.label} style={{ backgroundColor: '#080B12', border: '1px solid #252D3F', borderRadius: 6, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#8E97AC', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: item.color, fontFamily: '"JetBrains Mono", monospace' }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* Trade details */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#3D8EF0', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Details</div>
            <Row label="Entry Time" value={format(new Date(trade.entryTime), 'dd MMM yyyy HH:mm:ss')} mono />
            <Row label="Exit Time" value={format(new Date(trade.exitTime), 'dd MMM yyyy HH:mm:ss')} mono />
            <Row label="Entry Price" value={trade.entryPrice.toString()} mono />
            <Row label="Exit Price" value={trade.exitPrice.toString()} mono />
            <Row label="Lot Size" value={trade.lotSize.toString()} mono />
            <Row label="Stop Loss" value={trade.stopLoss?.toString()} mono />
            <Row label="Take Profit" value={trade.takeProfit?.toString()} mono />
            <Row label="Commission" value={trade.commission !== undefined ? `${c}${trade.commission.toFixed(2)}` : '—'} mono />
            <Row label="Swap" value={trade.swap !== undefined ? `${c}${trade.swap.toFixed(2)}` : '—'} mono />
            <Row label="Timeframe" value={trade.timeframe} />
            <Row label="Setup" value={trade.setup} />
            <Row label="Source" value={trade.source} />
            <Row label="MT5 Ticket" value={trade.mt5TicketId} mono />
            <Row label="Status" value={trade.status === 'COMPLETE' ? '✓ Complete' : '⚠ Pending Review'} color={trade.status === 'COMPLETE' ? '#00C47A' : '#F0A030'} />
          </div>

          {/* Tags */}
          {trade.tags && trade.tags.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#3D8EF0', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Tags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {trade.tags.map((tag) => (
                  <span key={tag} style={{ padding: '3px 8px', backgroundColor: 'rgba(77,158,255,0.12)', border: '1px solid rgba(77,158,255,0.3)', borderRadius: 3, fontSize: 11, color: '#3D8EF0' }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {trade.notes && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#3D8EF0', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Notes</div>
              <div style={{ backgroundColor: '#080B12', border: '1px solid #252D3F', borderRadius: 6, padding: '12px 14px', fontSize: 12, color: '#EEF0F6', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {trade.notes}
              </div>
            </div>
          )}

          {/* Screenshot */}
          {trade.chartImageBase64 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#3D8EF0', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Chart Screenshot</div>
              <img
                src={trade.chartImageBase64}
                alt="Trade chart"
                style={{ width: '100%', borderRadius: 6, border: '1px solid #252D3F', maxHeight: 300, objectFit: 'contain' }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
