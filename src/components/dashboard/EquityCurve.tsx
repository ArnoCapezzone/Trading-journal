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
          backgroundColor: '#1a1d27',
          border: '1px solid #2d3148',
          borderRadius: 8,
          padding: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 220,
          color: '#8892a4',
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
        borderColor: values[values.length - 1] >= 0 ? '#00d17a' : '#ff4d4d',
        borderWidth: 2,
        fill: true,
        backgroundColor: 'rgba(0, 209, 122, 0.1)',
        tension: 0.3,
        pointRadius: data.length > 50 ? 0 : 3,
        pointHoverRadius: 5,
        pointBackgroundColor: '#4d9eff',
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
        backgroundColor: '#22263a',
        borderColor: '#2d3148',
        borderWidth: 1,
        titleColor: '#8892a4',
        bodyColor: '#e8eaf0',
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
        grid: { color: '#2d3148' },
        ticks: {
          color: '#8892a4',
          font: { size: 10, family: '"JetBrains Mono", monospace' },
          maxTicksLimit: 12,
        },
      },
      y: {
        grid: { color: '#2d3148' },
        ticks: {
          color: '#8892a4',
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
        backgroundColor: '#1a1d27',
        border: '1px solid #2d3148',
        borderRadius: 8,
        padding: '16px 16px 12px',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: '#8892a4', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Equity Curve
      </div>
      <div style={{ height: 200 }}>
        <Line data={chartData} options={options} plugins={[createGradientPlugin]} />
      </div>
    </div>
  );
}
