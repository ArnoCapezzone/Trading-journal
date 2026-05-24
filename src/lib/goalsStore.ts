// Goals & Milestones — localStorage CRUD + progress calculation
import type { Trade } from '../types/trade';
import { calculateDashboardKPIs } from '../utils/calculations';
import { calculateDisciplineScore } from '../utils/advancedMetrics';

export type GoalType =
  | 'pnl_amount'
  | 'pnl_percent'
  | 'win_rate'
  | 'profit_factor'
  | 'trade_count'
  | 'discipline_score'
  | 'win_streak'
  | 'avg_rr';

export interface Goal {
  id: string;
  type: GoalType;
  title: string;
  target: number;
  scope: 'all' | 'period';  // 'all' = all trades, 'period' = since createdAt
  deadline?: number;         // timestamp ms, optional
  createdAt: number;
  achievedAt?: number;       // set when first reached
}

const STORAGE_KEY = 'tj_goals_v1';

// ── CRUD ────────────────────────────────────────────────────────
function readAll(): Goal[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAll(goals: Goal[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
  } catch (e) {
    console.error('Failed to save goals', e);
  }
}

export function listGoals(): Goal[] {
  return readAll().sort((a, b) => b.createdAt - a.createdAt);
}

export function saveGoal(goal: Goal) {
  const all = readAll();
  const idx = all.findIndex((g) => g.id === goal.id);
  if (idx >= 0) all[idx] = goal;
  else all.push(goal);
  writeAll(all);
}

export function deleteGoal(id: string) {
  writeAll(readAll().filter((g) => g.id !== id));
}

export function createGoal(input: Omit<Goal, 'id' | 'createdAt'>): Goal {
  return {
    ...input,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
}

// ── Progress calculation ─────────────────────────────────────────
export interface GoalProgress {
  current: number;
  target: number;
  percent: number;          // 0..100 (capped)
  achieved: boolean;
  unit: string;             // display unit ($, %, etc.)
  formatted: { current: string; target: string };
}

const GOAL_LABELS: Record<GoalType, string> = {
  pnl_amount: 'P&L Amount',
  pnl_percent: 'P&L %',
  win_rate: 'Win Rate',
  profit_factor: 'Profit Factor',
  trade_count: 'Trade Count',
  discipline_score: 'Discipline Score',
  win_streak: 'Win Streak',
  avg_rr: 'Avg R:R',
};

export function getGoalTypeLabel(type: GoalType): string {
  return GOAL_LABELS[type];
}

export function computeGoalProgress(
  goal: Goal,
  trades: Trade[],
  accountBalance: number,
  currency: string
): GoalProgress {
  const c = currency === 'EUR' ? '€' : '$';

  // Filter trades based on scope
  const scoped = goal.scope === 'period'
    ? trades.filter((t) => new Date(t.createdAt).getTime() >= goal.createdAt)
    : trades;

  const kpis = calculateDashboardKPIs(scoped, accountBalance);
  const discipline = calculateDisciplineScore(scoped, accountBalance);

  let current = 0;
  let unit = '';
  let formattedCurrent = '';
  let formattedTarget = '';

  switch (goal.type) {
    case 'pnl_amount':
      current = kpis.totalPnlDollar;
      unit = c;
      formattedCurrent = `${current >= 0 ? '+' : ''}${current.toFixed(2)} ${c}`;
      formattedTarget = `${goal.target.toFixed(2)} ${c}`;
      break;
    case 'pnl_percent':
      current = kpis.totalPnlPercent ?? 0;
      unit = '%';
      formattedCurrent = `${current >= 0 ? '+' : ''}${current.toFixed(2)}%`;
      formattedTarget = `${goal.target.toFixed(2)}%`;
      break;
    case 'win_rate':
      current = kpis.winRate * 100;
      unit = '%';
      formattedCurrent = `${current.toFixed(1)}%`;
      formattedTarget = `${goal.target.toFixed(1)}%`;
      break;
    case 'profit_factor':
      current = kpis.profitFactor ?? 0;
      formattedCurrent = current.toFixed(2);
      formattedTarget = goal.target.toFixed(2);
      break;
    case 'trade_count':
      current = kpis.totalTrades;
      formattedCurrent = String(current);
      formattedTarget = String(goal.target);
      break;
    case 'discipline_score':
      current = discipline.score;
      formattedCurrent = `${current}/100`;
      formattedTarget = `${goal.target}/100`;
      break;
    case 'win_streak':
      current = kpis.maxWinStreak;
      formattedCurrent = String(current);
      formattedTarget = String(goal.target);
      break;
    case 'avg_rr':
      current = kpis.avgRR ?? 0;
      formattedCurrent = current.toFixed(2);
      formattedTarget = goal.target.toFixed(2);
      break;
  }

  const percent = goal.target > 0 ? Math.max(0, Math.min(100, (current / goal.target) * 100)) : 0;
  const achieved = current >= goal.target && goal.target > 0;

  return {
    current,
    target: goal.target,
    percent,
    achieved,
    unit,
    formatted: { current: formattedCurrent, target: formattedTarget },
  };
}

// ── Default title generator ──────────────────────────────────────
export function suggestTitle(type: GoalType, target: number, currency: string): string {
  const c = currency === 'EUR' ? '€' : '$';
  switch (type) {
    case 'pnl_amount':       return `Reach ${target} ${c} in profit`;
    case 'pnl_percent':      return `Reach ${target}% return`;
    case 'win_rate':         return `Maintain ${target}% win rate`;
    case 'profit_factor':    return `Reach profit factor of ${target}`;
    case 'trade_count':      return `Log ${target} trades`;
    case 'discipline_score': return `Reach ${target}/100 discipline`;
    case 'win_streak':       return `Achieve ${target} win streak`;
    case 'avg_rr':           return `Reach ${target}:1 avg R:R`;
  }
}
