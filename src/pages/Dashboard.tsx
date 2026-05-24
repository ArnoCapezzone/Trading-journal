import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTradesStore } from '../store/tradesStore';
import { useSettingsStore } from '../store/settingsStore';
import {
  calculateDashboardKPIs,
  calculateEquityCurve,
  calculateByInstrument,
  calculateBySetup,
  calculateHeatmap,
  calculateCalendar,
  calculateTrade,
} from '../utils/calculations';
import KPICards from '../components/dashboard/KPICards';
import EquityCurve from '../components/dashboard/EquityCurve';
import PerformanceCharts from '../components/dashboard/PerformanceCharts';
import HeatmapHour from '../components/dashboard/HeatmapHour';
import CalendarView from '../components/dashboard/CalendarView';
import BehavioralInsights from '../components/dashboard/BehavioralInsights';
import ActiveGoals from '../components/dashboard/ActiveGoals';
import { format } from 'date-fns';

type Period = 'today' | 'week' | 'month' | '3months' | 'all';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: '3months', label: '3 Months' },
  { value: 'all', label: 'All Time' },
];

export default function Dashboard() {
  const { selectedPeriod, setSelectedPeriod, getPeriodTrades, trades } = useTradesStore();
  const { accountBalance, currency } = useSettingsStore();
  const c = currency === 'EUR' ? '€' : '$';

  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  const periodTrades = getPeriodTrades();
  const pendingCount = trades.filter((t) => t.status === 'PENDING_REVIEW').length;

  const kpis = useMemo(
    () => calculateDashboardKPIs(periodTrades, accountBalance),
    [periodTrades, accountBalance]
  );
  const equityCurve = useMemo(() => calculateEquityCurve(periodTrades), [periodTrades]);
  const byInstrument = useMemo(() => calculateByInstrument(periodTrades), [periodTrades]);
  const bySetup = useMemo(() => calculateBySetup(periodTrades), [periodTrades]);
  const heatmap = useMemo(() => calculateHeatmap(periodTrades), [periodTrades]);
  const calendar = useMemo(() => calculateCalendar(trades, calYear, calMonth), [trades, calYear, calMonth]);

  const last10 = useMemo(
    () =>
      [...periodTrades]
        .sort((a, b) => new Date(b.exitTime).getTime() - new Date(a.exitTime).getTime())
        .slice(0, 10),
    [periodTrades]
  );

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Pending alert */}
      {pendingCount > 0 && (
        <Link
          to="/journal?filter=pending"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 16px',
            backgroundColor: 'rgba(240,160,48,0.07)',
            border: '1px solid rgba(240,160,48,0.22)',
            borderLeft: '3px solid #F0A030',
            borderRadius: 7,
            textDecoration: 'none',
            color: '#F0A030',
            fontSize: 12,
            fontWeight: 500,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(240,160,48,0.12)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(240,160,48,0.07)')}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#F0A030" strokeWidth="1.5" strokeLinecap="round">
            <path d="M8 2L14.5 13H1.5L8 2z" />
            <line x1="8" y1="7" x2="8" y2="10" />
            <circle cx="8" cy="12" r="0.5" fill="#F0A030" />
          </svg>
          <span>
            <strong>{pendingCount} trade{pendingCount !== 1 ? 's' : ''}</strong> pending review
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.6 }}>View →</span>
        </Link>
      )}

      {/* Period selector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, color: '#4A5368', fontWeight: 500 }}>
          {periodTrades.length} trade{periodTrades.length !== 1 ? 's' : ''} in period
        </div>
        <div style={{ display: 'flex', gap: 2, backgroundColor: '#0D1017', border: '1px solid #1E2839', borderRadius: 7, padding: 3 }}>
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setSelectedPeriod(p.value)}
              style={{
                padding: '4px 12px',
                borderRadius: 5,
                border: 'none',
                backgroundColor: selectedPeriod === p.value ? '#19202F' : 'transparent',
                color: selectedPeriod === p.value ? '#EEF0F6' : '#4A5368',
                fontSize: 11,
                fontWeight: selectedPeriod === p.value ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.12s',
                boxShadow: selectedPeriod === p.value ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (selectedPeriod !== p.value) e.currentTarget.style.color = '#8E97AC';
              }}
              onMouseLeave={(e) => {
                if (selectedPeriod !== p.value) e.currentTarget.style.color = '#4A5368';
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <KPICards kpis={kpis} currency={currency} />

      {/* Goals & Milestones — Phase 4 */}
      <ActiveGoals trades={trades} accountBalance={accountBalance} currency={currency} />

      {/* Behavioral Insights — Phase 7 */}
      <BehavioralInsights trades={periodTrades} accountBalance={accountBalance} currency={currency} />

      {/* Equity Curve */}
      <EquityCurve data={equityCurve} currency={currency} />

      {/* Performance Charts */}
      <PerformanceCharts byInstrument={byInstrument} bySetup={bySetup} currency={currency} />

      {/* Bottom row: Heatmap + Calendar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
        <HeatmapHour data={heatmap} currency={currency} />
        <CalendarView
          data={calendar}
          year={calYear}
          month={calMonth}
          onMonthChange={(y, m) => { setCalYear(y); setCalMonth(m); }}
          currency={currency}
        />
      </div>

      {/* Last 10 trades */}
      <div style={{ backgroundColor: '#0D1017', border: '1px solid #252D3F', borderRadius: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #252D3F' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#8E97AC', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Recent Trades
          </div>
          <Link to="/journal" style={{ fontSize: 11, color: '#3D8EF0', textDecoration: 'none' }}>See all →</Link>
        </div>
        {last10.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#8E97AC', fontSize: 13 }}>
            No trades in selected period. <Link to="/journal/new" style={{ color: '#3D8EF0' }}>Add your first trade</Link>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Date', 'Instrument', 'L/S', 'Entry', 'Exit', 'P&L $', 'Setup', 'Status'].map((h) => (
                  <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10, color: '#8E97AC', textTransform: 'uppercase', borderBottom: '1px solid #252D3F' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {last10.map((trade) => {
                const calc = calculateTrade(trade, accountBalance);
                return (
                  <tr key={trade.id} style={{ borderBottom: '1px solid #0D1017', backgroundColor: calc.isWin ? 'rgba(0,209,122,0.03)' : 'rgba(255,77,77,0.03)' }}>
                    <td style={{ padding: '6px 12px', fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: '#8E97AC' }}>
                      {format(new Date(trade.exitTime), 'dd/MM/yy HH:mm')}
                    </td>
                    <td style={{ padding: '6px 12px', fontWeight: 600, fontFamily: '"JetBrains Mono", monospace', color: '#EEF0F6' }}>{trade.instrument}</td>
                    <td style={{ padding: '6px 12px' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: trade.direction === 'LONG' ? '#00C47A' : '#F04848' }}>
                        {trade.direction === 'LONG' ? '▲' : '▼'} {trade.direction === 'LONG' ? 'L' : 'S'}
                      </span>
                    </td>
                    <td style={{ padding: '6px 12px', fontFamily: '"JetBrains Mono", monospace', color: '#EEF0F6', fontSize: 11 }}>{trade.entryPrice.toFixed(5)}</td>
                    <td style={{ padding: '6px 12px', fontFamily: '"JetBrains Mono", monospace', color: '#EEF0F6', fontSize: 11 }}>{trade.exitPrice.toFixed(5)}</td>
                    <td style={{ padding: '6px 12px', fontFamily: '"JetBrains Mono", monospace', fontWeight: 600, color: calc.isWin ? '#00C47A' : '#F04848' }}>
                      {calc.pnlDollar >= 0 ? '+' : ''}{c}{calc.pnlDollar.toFixed(2)}
                    </td>
                    <td style={{ padding: '6px 12px', color: '#8E97AC', fontSize: 11 }}>{trade.setup ?? '—'}</td>
                    <td style={{ padding: '6px 12px', fontSize: 10, color: trade.status === 'COMPLETE' ? '#00C47A' : '#F0A030' }}>
                      {trade.status === 'COMPLETE' ? '✓' : '⚠'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
