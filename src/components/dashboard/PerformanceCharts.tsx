import {
  Chart as ChartJS,
  BarElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(BarElement, ArcElement, CategoryScale, LinearScale, Tooltip, Legend);

interface InstrumentData {
  instrument: string;
  pnl: number;
  count: number;
}

interface SetupData {
  setup: string;
  pnl: number;
  count: number;
  winRate: number;
}

interface Props {
  byInstrument: InstrumentData[];
  bySetup: SetupData[];
  currency?: string;
}

const SETUP_COLORS = [
  '#3D8EF0',
  '#00C47A',
  '#F0A030',
  '#F04848',
  '#a78bfa',
  '#f472b6',
  '#34d399',
];

const EMPTY_MSG_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 180,
  color: 'var(--text-tertiary)',
  fontSize: 13,
};

export default function PerformanceCharts({ byInstrument, bySetup, currency = 'USD' }: Props) {
  const c = currency === 'EUR' ? '€' : '$';

  const barData = {
    labels: byInstrument.map((d) => d.instrument),
    datasets: [
      {
        label: `P&L (${c})`,
        data: byInstrument.map((d) => d.pnl),
        backgroundColor: byInstrument.map((d) => (d.pnl >= 0 ? 'rgba(0, 209, 122, 0.75)' : 'rgba(255, 77, 77, 0.75)')),
        borderColor: byInstrument.map((d) => (d.pnl >= 0 ? '#00C47A' : '#F04848')),
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const barOptions = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'var(--bg-surface-2)',
        borderColor: 'var(--border-default)',
        borderWidth: 1,
        titleColor: 'var(--text-tertiary)',
        bodyColor: 'var(--text-primary)',
        padding: 10,
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (ctx: any) => {
            const val = ctx.parsed.x;
            return ` ${val >= 0 ? '+' : ''}${c}${val.toFixed(2)}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'var(--border-default)' },
        ticks: {
          color: 'var(--text-tertiary)',
          font: { size: 10, family: '"JetBrains Mono", monospace' },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          callback: (val: any) => `${c}${Number(val).toFixed(0)}`,
        },
      },
      y: {
        grid: { display: false },
        ticks: {
          color: 'var(--text-primary)',
          font: { size: 11, family: '"JetBrains Mono", monospace' },
        },
      },
    },
  };

  const doughnutData = {
    labels: bySetup.map((d) => `${d.setup} (${(d.winRate * 100).toFixed(0)}% WR)`),
    datasets: [
      {
        data: bySetup.map((d) => d.count),
        backgroundColor: bySetup.map((_, i) => SETUP_COLORS[i % SETUP_COLORS.length] + 'bb'),
        borderColor: bySetup.map((_, i) => SETUP_COLORS[i % SETUP_COLORS.length]),
        borderWidth: 2,
        hoverOffset: 4,
      },
    ],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: 'var(--text-tertiary)',
          font: { size: 10, family: '"JetBrains Mono", monospace' },
          padding: 8,
          boxWidth: 10,
        },
      },
      tooltip: {
        backgroundColor: 'var(--bg-surface-2)',
        borderColor: 'var(--border-default)',
        borderWidth: 1,
        titleColor: 'var(--text-tertiary)',
        bodyColor: 'var(--text-primary)',
        padding: 10,
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (ctx: any) => {
            const d = bySetup[ctx.dataIndex as number] ?? bySetup[0];
            return ` ${ctx.label}: ${d?.count ?? 0} trades, P&L: ${c}${d?.pnl.toFixed(2) ?? '0'}`;
          },
        },
      },
    },
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {/* By Instrument */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 8,
          padding: '16px 16px 12px',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          P&L by Instrument
        </div>
        {byInstrument.length === 0 ? (
          <div style={EMPTY_MSG_STYLE}>No data available</div>
        ) : (
          <div style={{ height: 180 }}>
            <Bar data={barData} options={barOptions} />
          </div>
        )}
      </div>

      {/* By Setup */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 8,
          padding: '16px 16px 12px',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Trades by Setup
        </div>
        {bySetup.length === 0 ? (
          <div style={EMPTY_MSG_STYLE}>No data available</div>
        ) : (
          <div style={{ height: 180 }}>
            <Doughnut data={doughnutData} options={doughnutOptions} />
          </div>
        )}
      </div>
    </div>
  );
}
