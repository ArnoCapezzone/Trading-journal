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
  if (val === null || val === 0) return '#e8eaf0';
  return val > 0 ? '#00d17a' : '#ff4d4d';
}

interface KPICardProps {
  title: string;
  value: string;
  subValue?: string;
  color?: string;
  bgAccent?: string;
}

function KPICard({ title, value, subValue, color = '#e8eaf0', bgAccent }: KPICardProps) {
  return (
    <div
      style={{
        backgroundColor: '#1a1d27',
        border: '1px solid #2d3148',
        borderRadius: 8,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        borderLeft: bgAccent ? `3px solid ${bgAccent}` : '1px solid #2d3148',
      }}
    >
      <div style={{ fontSize: 11, color: '#8892a4', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {title}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 600,
          color,
          fontFamily: '"JetBrains Mono", monospace',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {subValue && (
        <div style={{ fontSize: 11, color: '#8892a4', fontFamily: '"JetBrains Mono", monospace' }}>
          {subValue}
        </div>
      )}
    </div>
  );
}

export default function KPICards({ kpis, currency = 'USD' }: Props) {
  const c = currency === 'EUR' ? '€' : '$';
  const totalColor = pnlColor(kpis.totalPnlDollar);
  const winRateColor = kpis.winRate >= 0.5 ? '#00d17a' : kpis.winRate > 0 ? '#ff9a3c' : '#e8eaf0';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: 10,
      }}
    >
      <KPICard
        title="Total Trades"
        value={String(kpis.totalTrades)}
        color="#4d9eff"
        bgAccent="#4d9eff"
      />
      <KPICard
        title="Win Rate"
        value={kpis.totalTrades > 0 ? `${(kpis.winRate * 100).toFixed(1)}%` : '—'}
        color={winRateColor}
        bgAccent={winRateColor}
      />
      <KPICard
        title="Total P&L"
        value={kpis.totalTrades > 0 ? fmt(kpis.totalPnlDollar, 2, c) : '—'}
        subValue={kpis.totalPnlPercent !== null ? `${kpis.totalPnlPercent.toFixed(2)}%` : undefined}
        color={totalColor}
        bgAccent={totalColor}
      />
      <KPICard
        title="Profit Factor"
        value={fmt(kpis.profitFactor, 2)}
        color={kpis.profitFactor !== null && kpis.profitFactor >= 1 ? '#00d17a' : '#ff4d4d'}
      />
      <KPICard
        title="Expectancy"
        value={kpis.totalTrades > 0 ? fmt(kpis.expectancy, 2, c) : '—'}
        color={pnlColor(kpis.expectancy)}
      />
      <KPICard
        title="Max Drawdown"
        value={kpis.totalTrades > 0 ? fmt(kpis.maxDrawdown, 2, c) : '—'}
        subValue={kpis.maxDrawdownPercent !== null ? `${kpis.maxDrawdownPercent.toFixed(2)}%` : undefined}
        color={kpis.maxDrawdown > 0 ? '#ff4d4d' : '#e8eaf0'}
      />
      <KPICard
        title="Avg Win"
        value={kpis.totalTrades > 0 ? fmt(kpis.avgWin, 2, c) : '—'}
        color="#00d17a"
      />
      <KPICard
        title="Avg Loss"
        value={kpis.totalTrades > 0 ? fmt(kpis.avgLoss, 2, c) : '—'}
        color="#ff4d4d"
      />
      <KPICard
        title="Avg R:R"
        value={fmt(kpis.avgRR, 2)}
        color={kpis.avgRR !== null && kpis.avgRR >= 1 ? '#00d17a' : '#e8eaf0'}
      />
      <KPICard
        title="Avg Duration"
        value={fmtDuration(kpis.avgDurationMinutes)}
        color="#e8eaf0"
      />
      <KPICard
        title="Best Trade"
        value={kpis.totalTrades > 0 ? fmt(kpis.bestTrade, 2, c) : '—'}
        color="#00d17a"
      />
      <KPICard
        title="Worst Trade"
        value={kpis.totalTrades > 0 ? fmt(kpis.worstTrade, 2, c) : '—'}
        color="#ff4d4d"
      />
      <KPICard
        title="Max Win Streak"
        value={kpis.totalTrades > 0 ? String(kpis.maxWinStreak) : '—'}
        color="#00d17a"
      />
      <KPICard
        title="Max Loss Streak"
        value={kpis.totalTrades > 0 ? String(kpis.maxLossStreak) : '—'}
        color="#ff4d4d"
      />
    </div>
  );
}
