import type { Trade } from '../types/trade';
import { differenceInMinutes } from 'date-fns';

export interface CalculatedTrade {
  pnlPips: number;
  pnlDollar: number;
  pnlPercent: number | null;
  durationMinutes: number;
  rrRatio: number | null;
  isWin: boolean;
}

export interface DashboardKPIs {
  totalTrades: number;
  winRate: number;
  totalPnlDollar: number;
  totalPnlPercent: number | null;
  profitFactor: number | null;
  expectancy: number;
  maxDrawdown: number;
  maxDrawdownPercent: number | null;
  avgWin: number;
  avgLoss: number;
  avgRR: number | null;
  avgDurationMinutes: number;
  bestTrade: number;
  worstTrade: number;
  maxWinStreak: number;
  maxLossStreak: number;
}

// Pip values per 1 lot per 1 pip move in USD
const PIP_VALUES: Record<string, { pipSize: number; pipValue: number }> = {
  EURUSD: { pipSize: 0.0001, pipValue: 10 },
  GBPUSD: { pipSize: 0.0001, pipValue: 10 },
  NZDUSD: { pipSize: 0.0001, pipValue: 10 },
  AUDUSD: { pipSize: 0.0001, pipValue: 10 },
  USDCAD: { pipSize: 0.0001, pipValue: 7.7 },
  USDCHF: { pipSize: 0.0001, pipValue: 10 },
  USDJPY: { pipSize: 0.01, pipValue: 9.1 },
  GBPJPY: { pipSize: 0.01, pipValue: 9.1 },
  EURJPY: { pipSize: 0.01, pipValue: 9.1 },
  NAS100: { pipSize: 1, pipValue: 1 },
  US500: { pipSize: 0.25, pipValue: 12.5 },
  XAUUSD: { pipSize: 0.1, pipValue: 1 },
};

function getInstrumentConfig(instrument: string): { pipSize: number; pipValue: number } {
  const upper = instrument.toUpperCase().replace(/[^A-Z0-9]/g, '');
  // Try direct match first
  if (PIP_VALUES[upper]) return PIP_VALUES[upper];
  // Try partial match
  for (const key of Object.keys(PIP_VALUES)) {
    if (upper.includes(key) || key.includes(upper)) return PIP_VALUES[key];
  }
  // Default fallback: treat as forex with 4-decimal pip
  return { pipSize: 0.0001, pipValue: 10 };
}

export function calculateTrade(trade: Trade, accountBalance?: number): CalculatedTrade {
  const config = getInstrumentConfig(trade.instrument);

  const priceDiff =
    trade.direction === 'LONG'
      ? trade.exitPrice - trade.entryPrice
      : trade.entryPrice - trade.exitPrice;

  const pnlPips = priceDiff / config.pipSize;
  const commission = trade.commission ?? 0;
  const swap = trade.swap ?? 0;

  // Use MT5's authoritative profit when available (handles exotic instruments,
  // account currency conversion, and broker-specific contract sizes).
  // mt5Profit is the raw trade profit from the broker (before commission/swap).
  const pnlDollar =
    trade.mt5Profit !== undefined
      ? trade.mt5Profit - commission + swap
      : pnlPips * config.pipValue * trade.lotSize - commission + swap;

  const balance = accountBalance ?? trade.accountBalanceAtEntry ?? null;
  const pnlPercent = balance && balance > 0 ? (pnlDollar / balance) * 100 : null;

  const durationMinutes = Math.abs(
    differenceInMinutes(new Date(trade.exitTime), new Date(trade.entryTime))
  );

  let rrRatio: number | null = null;
  if (trade.stopLoss && trade.entryPrice && trade.stopLoss !== trade.entryPrice) {
    const risk = Math.abs(trade.entryPrice - trade.stopLoss);
    const reward = Math.abs(trade.exitPrice - trade.entryPrice);
    rrRatio = risk > 0 ? reward / risk : null;
  }

  const isWin = pnlDollar > 0;

  return { pnlPips, pnlDollar, pnlPercent, durationMinutes, rrRatio, isWin };
}

export function calculateDashboardKPIs(trades: Trade[], accountBalance?: number): DashboardKPIs {
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      winRate: 0,
      totalPnlDollar: 0,
      totalPnlPercent: null,
      profitFactor: null,
      expectancy: 0,
      maxDrawdown: 0,
      maxDrawdownPercent: null,
      avgWin: 0,
      avgLoss: 0,
      avgRR: null,
      avgDurationMinutes: 0,
      bestTrade: 0,
      worstTrade: 0,
      maxWinStreak: 0,
      maxLossStreak: 0,
    };
  }

  const calculated = trades.map((t) => calculateTrade(t, accountBalance));
  const pnls = calculated.map((c) => c.pnlDollar);
  const wins = calculated.filter((c) => c.isWin);
  const losses = calculated.filter((c) => !c.isWin);

  const totalPnlDollar = pnls.reduce((a, b) => a + b, 0);
  const winRate = wins.length / trades.length;

  const grossProfit = wins.reduce((a, c) => a + c.pnlDollar, 0);
  const grossLoss = Math.abs(losses.reduce((a, c) => a + c.pnlDollar, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : null;

  const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
  const expectancy = winRate * avgWin - (1 - winRate) * avgLoss;

  const rrValues = calculated.filter((c) => c.rrRatio !== null).map((c) => c.rrRatio as number);
  const avgRR = rrValues.length > 0 ? rrValues.reduce((a, b) => a + b, 0) / rrValues.length : null;

  const avgDurationMinutes =
    calculated.reduce((a, c) => a + c.durationMinutes, 0) / calculated.length;

  const bestTrade = Math.max(...pnls);
  const worstTrade = Math.min(...pnls);

  // Max drawdown from equity curve
  let peak = 0;
  let cumPnl = 0;
  let maxDrawdown = 0;
  for (const pnl of pnls) {
    cumPnl += pnl;
    if (cumPnl > peak) peak = cumPnl;
    const dd = peak - cumPnl;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const totalPnlPercent =
    accountBalance && accountBalance > 0 ? (totalPnlDollar / accountBalance) * 100 : null;
  const maxDrawdownPercent =
    accountBalance && accountBalance > 0 ? (maxDrawdown / accountBalance) * 100 : null;

  // Win/Loss streaks
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let curWin = 0;
  let curLoss = 0;
  for (const c of calculated) {
    if (c.isWin) {
      curWin++;
      curLoss = 0;
      if (curWin > maxWinStreak) maxWinStreak = curWin;
    } else {
      curLoss++;
      curWin = 0;
      if (curLoss > maxLossStreak) maxLossStreak = curLoss;
    }
  }

  return {
    totalTrades: trades.length,
    winRate,
    totalPnlDollar,
    totalPnlPercent,
    profitFactor,
    expectancy,
    maxDrawdown,
    maxDrawdownPercent,
    avgWin,
    avgLoss,
    avgRR,
    avgDurationMinutes,
    bestTrade,
    worstTrade,
    maxWinStreak,
    maxLossStreak,
  };
}

export function calculateEquityCurve(
  trades: Trade[]
): { date: Date; cumPnl: number; tradeIndex: number }[] {
  if (trades.length === 0) return [];

  const sorted = [...trades].sort(
    (a, b) => new Date(a.exitTime).getTime() - new Date(b.exitTime).getTime()
  );

  let cumPnl = 0;
  return sorted.map((trade, i) => {
    const calc = calculateTrade(trade);
    cumPnl += calc.pnlDollar;
    return { date: new Date(trade.exitTime), cumPnl, tradeIndex: i + 1 };
  });
}

export function calculateByInstrument(
  trades: Trade[]
): { instrument: string; pnl: number; count: number }[] {
  const map = new Map<string, { pnl: number; count: number }>();
  for (const trade of trades) {
    const calc = calculateTrade(trade);
    const existing = map.get(trade.instrument) ?? { pnl: 0, count: 0 };
    map.set(trade.instrument, {
      pnl: existing.pnl + calc.pnlDollar,
      count: existing.count + 1,
    });
  }
  return Array.from(map.entries())
    .map(([instrument, data]) => ({ instrument, ...data }))
    .sort((a, b) => b.pnl - a.pnl);
}

export function calculateBySetup(
  trades: Trade[]
): { setup: string; pnl: number; count: number; winRate: number }[] {
  const map = new Map<string, { pnl: number; count: number; wins: number }>();
  for (const trade of trades) {
    const key = trade.setup ?? 'OTHER';
    const calc = calculateTrade(trade);
    const existing = map.get(key) ?? { pnl: 0, count: 0, wins: 0 };
    map.set(key, {
      pnl: existing.pnl + calc.pnlDollar,
      count: existing.count + 1,
      wins: existing.wins + (calc.isWin ? 1 : 0),
    });
  }
  return Array.from(map.entries())
    .map(([setup, data]) => ({
      setup,
      pnl: data.pnl,
      count: data.count,
      winRate: data.count > 0 ? data.wins / data.count : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

export function calculateHeatmap(
  trades: Trade[]
): { day: number; hour: number; avgPnl: number; count: number }[][] {
  // 7 days (0=Mon ... 6=Sun) × 24 hours
  const grid: { sum: number; count: number }[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({ sum: 0, count: 0 }))
  );

  for (const trade of trades) {
    const calc = calculateTrade(trade);
    const dt = new Date(trade.entryTime);
    // getDay() returns 0=Sun..6=Sat; we want 0=Mon..6=Sun
    const jsDay = dt.getDay();
    const day = jsDay === 0 ? 6 : jsDay - 1;
    const hour = dt.getHours();
    grid[day][hour].sum += calc.pnlDollar;
    grid[day][hour].count += 1;
  }

  return grid.map((row, day) =>
    row.map((cell, hour) => ({
      day,
      hour,
      avgPnl: cell.count > 0 ? cell.sum / cell.count : 0,
      count: cell.count,
    }))
  );
}

export function calculateCalendar(
  trades: Trade[],
  year: number,
  month: number
): { date: number; pnl: number; count: number }[] {
  const map = new Map<number, { pnl: number; count: number }>();

  for (const trade of trades) {
    const dt = new Date(trade.exitTime);
    if (dt.getFullYear() !== year || dt.getMonth() !== month) continue;
    const day = dt.getDate();
    const calc = calculateTrade(trade);
    const existing = map.get(day) ?? { pnl: 0, count: 0 };
    map.set(day, { pnl: existing.pnl + calc.pnlDollar, count: existing.count + 1 });
  }

  return Array.from(map.entries()).map(([date, data]) => ({ date, ...data }));
}
