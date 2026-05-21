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
  '#4d9eff',
  '#00d17a',
  '#ff9a3c',
  '#ff4d4d',
  '#a78bfa',
  '#f472b6',
  '#34d399',
];

const EMPTY_MSG_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 180,
  color: '#8892a4',
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
        borderColor: byInstrument.map((d) => (d.pnl >= 0 ? '#00d17a' : '#ff4d4d')),
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
        backgroundColor: '#22263a',
        borderColor: '#2d3148',
        borderWidth: 1,
        titleColor: '#8892a4',
        bodyColor: '#e8eaf0',
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
        grid: { color: '#2d3148' },
        ticks: {
          color: '#8892a4',
          font: { size: 10, family: '"JetBrains Mono", monospace' },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          callback: (val: any) => `${c}${Number(val).toFixed(0)}`,
        },
      },
      y: {
        grid: { display: false },
        ticks: {
          color: '#e8eaf0',
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
          color: '#8892a4',
          font: { size: 10, family: '"JetBrains Mono", monospace' },
          padding: 8,
          boxWidth: 10,
        },
      },
      tooltip: {
        backgroundColor: '#22263a',
        borderColor: '#2d3148',
        borderWidth: 1,
        titleColor: '#8892a4',
        bodyColor: '#e8eaf0',
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
          backgroundColor: '#1a1d27',
          border: '1px solid #2d3148',
          borderRadius: 8,
          padding: '16px 16px 12px',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: '#8892a4', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
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
          backgroundColor: '#1a1d27',
          border: '1px solid #2d3148',
          borderRadius: 8,
          padding: '16px 16px 12px',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: '#8892a4', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
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
