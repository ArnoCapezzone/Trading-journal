// Advanced behavioral and edge metrics
import type { Trade } from '../types/trade';
import { calculateTrade } from './calculations';

export interface RevengeTradingImpact {
  count: number;        // Number of revenge trades detected
  netPnl: number;       // Total $ from revenge trades
  winRate: number;      // WR of revenge trades vs normal
  avgGap: number;       // Average minutes between losing trade exit and next entry
}

export interface DisciplineScore {
  score: number;        // 0..100
  totalTrades: number;
  withNotes: number;
  withSetup: number;
  withTimeframe: number;
  withinAvgSize: number;  // Trades within 1.5x avg size
  completed: number;      // Not pending review
}

export interface TiltDay {
  date: string;          // YYYY-MM-DD
  trades: number;
  consecutiveLosses: number;
  sizingVarianceFactor: number;  // max/avg lot
  netPnl: number;
  tiltScore: number;     // 0..100 (higher = more tilted)
}

export interface HourPerformance {
  hour: number;          // 0..23
  trades: number;
  avgPnl: number;
  totalPnl: number;
  winRate: number;
}

export interface DayPerformance {
  day: number;           // 0=Mon, 6=Sun
  dayName: string;
  trades: number;
  avgPnl: number;
  totalPnl: number;
  winRate: number;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ── Revenge Trading Impact ───────────────────────────────────────
// A revenge trade is one opened within 15 minutes after a losing trade exit
export function calculateRevengeTradingImpact(
  trades: Trade[],
  accountBalance: number,
  gapMinutesMax = 15
): RevengeTradingImpact {
  if (trades.length < 2) {
    return { count: 0, netPnl: 0, winRate: 0, avgGap: 0 };
  }

  const calculated = trades.map((t) => ({ trade: t, calc: calculateTrade(t, accountBalance) }));
  const sorted = [...calculated].sort(
    (a, b) => new Date(a.trade.entryTime).getTime() - new Date(b.trade.entryTime).getTime()
  );

  const revenge: { calc: ReturnType<typeof calculateTrade>; gap: number }[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const gapMs = new Date(curr.trade.entryTime).getTime() - new Date(prev.trade.exitTime).getTime();
    const gapMin = gapMs / 60000;
    if (!prev.calc.isWin && gapMin >= 0 && gapMin <= gapMinutesMax) {
      revenge.push({ calc: curr.calc, gap: gapMin });
    }
  }

  if (revenge.length === 0) {
    return { count: 0, netPnl: 0, winRate: 0, avgGap: 0 };
  }

  const netPnl = revenge.reduce((sum, r) => sum + r.calc.pnlDollar, 0);
  const wins = revenge.filter((r) => r.calc.isWin).length;
  const avgGap = revenge.reduce((sum, r) => sum + r.gap, 0) / revenge.length;

  return {
    count: revenge.length,
    netPnl,
    winRate: wins / revenge.length,
    avgGap,
  };
}

// ── Discipline Score (0..100) ────────────────────────────────────
// Composite of: notes coverage, setup tagging, timeframe tagging,
// consistent sizing, and completion status
export function calculateDisciplineScore(
  trades: Trade[],
  accountBalance: number
): DisciplineScore {
  if (trades.length === 0) {
    return {
      score: 0,
      totalTrades: 0,
      withNotes: 0,
      withSetup: 0,
      withTimeframe: 0,
      withinAvgSize: 0,
      completed: 0,
    };
  }

  const withNotes = trades.filter((t) => t.notes && t.notes.trim().length >= 10).length;
  const withSetup = trades.filter((t) => t.setup).length;
  const withTimeframe = trades.filter((t) => t.timeframe).length;
  const completed = trades.filter((t) => t.status === 'COMPLETE').length;

  const lots = trades.map((t) => t.lotSize);
  const avgLot = lots.reduce((a, b) => a + b, 0) / lots.length;
  const withinAvgSize = trades.filter((t) => t.lotSize <= avgLot * 1.5).length;

  // Weighted score (notes are most important)
  const total = trades.length;
  const score = Math.round(
    ((withNotes / total) * 30 +
      (withSetup / total) * 20 +
      (withTimeframe / total) * 15 +
      (withinAvgSize / total) * 20 +
      (completed / total) * 15) *
      1.0
  );

  // Use accountBalance just to silence unused param (kept for future risk-per-trade scoring)
  void accountBalance;

  return {
    score: Math.min(100, score),
    totalTrades: total,
    withNotes,
    withSetup,
    withTimeframe,
    withinAvgSize,
    completed,
  };
}

// ── Daily Tilt Score ─────────────────────────────────────────────
// Composite score per day measuring emotional discipline
export function calculateTiltDays(
  trades: Trade[],
  accountBalance: number,
  topN = 7
): TiltDay[] {
  if (trades.length === 0) return [];

  const calculated = trades.map((t) => ({ trade: t, calc: calculateTrade(t, accountBalance) }));

  // Group by date
  const groups = new Map<string, typeof calculated>();
  for (const item of calculated) {
    const dt = new Date(item.trade.entryTime);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  const allLots = trades.map((t) => t.lotSize);
  const overallAvgLot = allLots.reduce((a, b) => a + b, 0) / allLots.length;

  const days: TiltDay[] = [];
  for (const [date, items] of groups) {
    if (items.length < 2) continue;

    // Sort by entry time
    items.sort((a, b) => new Date(a.trade.entryTime).getTime() - new Date(b.trade.entryTime).getTime());

    // Max consecutive losses
    let maxConsec = 0;
    let cur = 0;
    for (const it of items) {
      if (!it.calc.isWin) {
        cur++;
        if (cur > maxConsec) maxConsec = cur;
      } else cur = 0;
    }

    // Sizing variance for the day
    const lots = items.map((i) => i.trade.lotSize);
    const maxLot = Math.max(...lots);
    const sizingFactor = overallAvgLot > 0 ? maxLot / overallAvgLot : 1;

    const netPnl = items.reduce((s, i) => s + i.calc.pnlDollar, 0);

    // Tilt score formula:
    // overtrading (>3 trades): +30
    // consecutive losses: +10 per loss above 1 (max 30)
    // sizing >2x avg: +20
    // negative day: +20
    let tilt = 0;
    if (items.length > 3) tilt += 30;
    if (maxConsec > 1) tilt += Math.min(30, (maxConsec - 1) * 10);
    if (sizingFactor > 2) tilt += 20;
    if (netPnl < 0) tilt += 20;

    days.push({
      date,
      trades: items.length,
      consecutiveLosses: maxConsec,
      sizingVarianceFactor: sizingFactor,
      netPnl,
      tiltScore: Math.min(100, tilt),
    });
  }

  return days.sort((a, b) => b.tiltScore - a.tiltScore).slice(0, topN);
}

// ── Hour-of-day performance ──────────────────────────────────────
export function calculateByHour(
  trades: Trade[],
  accountBalance: number
): HourPerformance[] {
  const buckets = new Map<number, { count: number; total: number; wins: number }>();

  for (const t of trades) {
    const calc = calculateTrade(t, accountBalance);
    const hour = new Date(t.entryTime).getHours();
    const b = buckets.get(hour) ?? { count: 0, total: 0, wins: 0 };
    b.count++;
    b.total += calc.pnlDollar;
    if (calc.isWin) b.wins++;
    buckets.set(hour, b);
  }

  return Array.from(buckets.entries())
    .map(([hour, b]) => ({
      hour,
      trades: b.count,
      avgPnl: b.count > 0 ? b.total / b.count : 0,
      totalPnl: b.total,
      winRate: b.count > 0 ? b.wins / b.count : 0,
    }))
    .sort((a, b) => a.hour - b.hour);
}

// ── Day-of-week performance ──────────────────────────────────────
export function calculateByDayOfWeek(
  trades: Trade[],
  accountBalance: number
): DayPerformance[] {
  const buckets = new Map<number, { count: number; total: number; wins: number }>();

  for (const t of trades) {
    const calc = calculateTrade(t, accountBalance);
    const js = new Date(t.entryTime).getDay();
    const day = js === 0 ? 6 : js - 1; // 0=Mon..6=Sun
    const b = buckets.get(day) ?? { count: 0, total: 0, wins: 0 };
    b.count++;
    b.total += calc.pnlDollar;
    if (calc.isWin) b.wins++;
    buckets.set(day, b);
  }

  const result: DayPerformance[] = [];
  for (let d = 0; d < 7; d++) {
    const b = buckets.get(d);
    result.push({
      day: d,
      dayName: DAY_NAMES[d],
      trades: b?.count ?? 0,
      avgPnl: b && b.count > 0 ? b.total / b.count : 0,
      totalPnl: b?.total ?? 0,
      winRate: b && b.count > 0 ? b.wins / b.count : 0,
    });
  }
  return result;
}
