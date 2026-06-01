import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { format } from 'date-fns';

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend);

interface DataPoint {
  date: Date;
  cumPnl: number;
  tradeIndex: number;
}

interface Props {
  data: DataPoint[];
  currency?: string;
}

export default function EquityCurve({ data, currency = 'USD' }: Props) {
  const c = currency === 'EUR' ? '€' : '$';

  if (data.length === 0) {
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
          height: 220,
          color: 'var(--text-tertiary)',
          fontSize: 13,
        }}
      >
        No trades to display equity curve
      </div>
    );
  }

  const labels = data.map((d) => format(new Date(d.date), 'dd MMM'));
  const values = data.map((d) => d.cumPnl);
  const maxAbs = Math.max(1, ...values.map(Math.abs));

  // Build gradient plugin inline
  const createGradientPlugin = {
    id: 'equityGradient',
    beforeDatasetsDraw(chart: ChartJS) {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea) return;
      const zeroY = scales.y.getPixelForValue(0);
      const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
      const topRatio = Math.max(0, Math.min(1, (zeroY - chartArea.top) / chartArea.height));

      gradient.addColorStop(0, 'rgba(0, 209, 122, 0.25)');
      gradient.addColorStop(topRatio, 'rgba(0, 209, 122, 0.05)');
      gradient.addColorStop(topRatio, 'rgba(255, 77, 77, 0.05)');
      gradient.addColorStop(1, 'rgba(255, 77, 77, 0.25)');

      const dataset = chart.data.datasets[0] as { backgroundColor?: CanvasGradient };
      dataset.backgroundColor = gradient;
    },
  };

  const chartData = {
    labels,
    datasets: [
      {
        label: `Cumulative P&L (${c})`,
        data: values,
        borderColor: values[values.length - 1] >= 0 ? '#00C47A' : '#F04848',
        borderWidth: 2,
        fill: true,
        backgroundColor: 'rgba(0, 209, 122, 0.1)',
        tension: 0.3,
        pointRadius: data.length > 50 ? 0 : 3,
        pointHoverRadius: 5,
        pointBackgroundColor: '#3D8EF0',
        pointBorderColor: 'transparent',
      },
    ],
  };

  const options = {
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
            const val = ctx.parsed.y;
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
          maxTicksLimit: 12,
        },
      },
      y: {
        grid: { color: 'var(--border-default)' },
        ticks: {
          color: 'var(--text-tertiary)',
          font: { size: 10, family: '"JetBrains Mono", monospace' },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          callback: (val: any) => `${c}${Number(val).toFixed(0)}`,
        },
        min: -maxAbs * 1.1,
        max: maxAbs * 1.1,
      },
    },
    interaction: { mode: 'index' as const, intersect: false },
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 8,
        padding: '16px 16px 12px',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Equity Curve
      </div>
      <div style={{ height: 200 }}>
        <Line data={chartData} options={options} plugins={[createGradientPlugin]} />
      </div>
    </div>
  );
}
