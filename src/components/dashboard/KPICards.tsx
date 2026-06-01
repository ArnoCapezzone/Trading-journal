import type { DashboardKPIs } from '../../utils/calculations';

interface Props {
  kpis: DashboardKPIs;
  currency?: string;
}

function fmt(val: number | null, decimals = 2, prefix = ''): string {
  if (val === null || val === undefined) return '—';
  if (!isFinite(val)) return '—';
  return `${prefix}${val.toFixed(decimals)}`;
}

function fmtDuration(minutes: number): string {
  if (!minutes || !isFinite(minutes)) return '—';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

function pnlColor(val: number | null): string {
  if (val === null || val === 0) return 'var(--text-primary)';
  return val > 0 ? '#00C47A' : '#F04848';
}

interface KPICardProps {
  title: string;
  value: string;
  subValue?: string;
  valueColor?: string;
  accentColor?: string;
  trend?: 'up' | 'down' | 'neutral';
}

function KPICard({ title, value, subValue, valueColor = 'var(--text-primary)', accentColor }: KPICardProps) {
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-mid)',
        borderTop: accentColor ? `2px solid ${accentColor}` : '2px solid var(--border-default)',
        borderRadius: 8,
        padding: '14px 16px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        transition: 'border-color 0.15s',
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.10em',
          marginBottom: 2,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 21,
          fontWeight: 700,
          color: valueColor,
          fontFamily: '"JetBrains Mono", monospace',
          lineHeight: 1,
          letterSpacing: '-0.02em',
        }}
      >
        {value}
      </div>
      {subValue && (
        <div
          style={{
            fontSize: 10,
            color: valueColor === 'var(--text-primary)' ? 'var(--text-muted)' : valueColor,
            fontFamily: '"JetBrains Mono", monospace',
            opacity: 0.8,
            marginTop: 1,
          }}
        >
          {subValue}
        </div>
      )}
    </div>
  );
}

export default function KPICards({ kpis, currency = 'USD' }: Props) {
  const c = currency === 'EUR' ? '€' : '$';
  const totalColor = pnlColor(kpis.totalPnlDollar);
  const winRateColor =
    kpis.winRate >= 0.55 ? '#00C47A'
    : kpis.winRate >= 0.45 ? '#F0A030'
    : '#F04848';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
        gap: 8,
      }}
    >
      <KPICard
        title="Total Trades"
        value={String(kpis.totalTrades)}
        valueColor="#3D8EF0"
        accentColor="#3D8EF0"
      />
      <KPICard
        title="Win Rate"
        value={kpis.totalTrades > 0 ? `${(kpis.winRate * 100).toFixed(1)}%` : '—'}
        valueColor={winRateColor}
        accentColor={winRateColor}
      />
      <KPICard
        title="Total P&L"
        value={kpis.totalTrades > 0 ? fmt(kpis.totalPnlDollar, 2, c) : '—'}
        subValue={kpis.totalPnlPercent !== null ? `${kpis.totalPnlPercent >= 0 ? '+' : ''}${kpis.totalPnlPercent.toFixed(2)}%` : undefined}
        valueColor={totalColor}
        accentColor={totalColor}
      />
      <KPICard
        title="Profit Factor"
        value={fmt(kpis.profitFactor, 2)}
        valueColor={kpis.profitFactor !== null ? (kpis.profitFactor >= 1.5 ? '#00C47A' : kpis.profitFactor >= 1 ? '#F0A030' : '#F04848') : 'var(--text-primary)'}
        accentColor={kpis.profitFactor !== null ? (kpis.profitFactor >= 1 ? '#00C47A' : '#F04848') : undefined}
      />
      <KPICard
        title="Expectancy"
        value={kpis.totalTrades > 0 ? fmt(kpis.expectancy, 2, c) : '—'}
        valueColor={pnlColor(kpis.expectancy)}
      />
      <KPICard
        title="Max Drawdown"
        value={kpis.totalTrades > 0 ? fmt(kpis.maxDrawdown, 2, c) : '—'}
        subValue={kpis.maxDrawdownPercent !== null ? `${kpis.maxDrawdownPercent.toFixed(2)}%` : undefined}
        valueColor={kpis.maxDrawdown > 0 ? '#F04848' : 'var(--text-primary)'}
        accentColor={kpis.maxDrawdown > 0 ? '#F04848' : undefined}
      />
      <KPICard
        title="Avg Win"
        value={kpis.totalTrades > 0 ? fmt(kpis.avgWin, 2, c) : '—'}
        valueColor="#00C47A"
        accentColor="#00C47A"
      />
      <KPICard
        title="Avg Loss"
        value={kpis.totalTrades > 0 ? fmt(kpis.avgLoss, 2, c) : '—'}
        valueColor="#F04848"
        accentColor="#F04848"
      />
      <KPICard
        title="Avg R:R"
        value={fmt(kpis.avgRR, 2)}
        valueColor={kpis.avgRR !== null ? (kpis.avgRR >= 1.5 ? '#00C47A' : kpis.avgRR >= 1 ? '#F0A030' : 'var(--text-primary)') : 'var(--text-primary)'}
      />
      <KPICard
        title="Avg Duration"
        value={fmtDuration(kpis.avgDurationMinutes)}
        valueColor="#EEF0F6"
      />
      <KPICard
        title="Best Trade"
        value={kpis.totalTrades > 0 ? fmt(kpis.bestTrade, 2, c) : '—'}
        valueColor="#00C47A"
      />
      <KPICard
        title="Worst Trade"
        value={kpis.totalTrades > 0 ? fmt(kpis.worstTrade, 2, c) : '—'}
        valueColor="#F04848"
      />
      <KPICard
        title="Win Streak"
        value={kpis.totalTrades > 0 ? String(kpis.maxWinStreak) : '—'}
        valueColor="#00C47A"
      />
      <KPICard
        title="Loss Streak"
        value={kpis.totalTrades > 0 ? String(kpis.maxLossStreak) : '—'}
        valueColor="#F04848"
      />
    </div>
  );
}
