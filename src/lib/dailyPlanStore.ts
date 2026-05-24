// Daily Trading Plan — pre-market plan + end-of-day review (localStorage)

export type Bias = 'LONG' | 'SHORT' | 'NEUTRAL';

export interface DailyPlan {
  date: string;            // YYYY-MM-DD
  bias: Bias;
  keyLevels: string;       // free-text or "EURUSD 1.0850 / NAS100 19500"
  setupsToWatch: string;   // strategies to deploy
  maxTrades: number;       // discipline cap
  maxRiskPct: number;      // daily risk cap %
  preNotes: string;        // free notes morning
  preMood: number;         // 1..10
  preMoodTags: string[];   // ["focused", "tired", "anxious"]

  // End-of-day review (filled later)
  reviewed: boolean;
  followedPlan: 'yes' | 'partial' | 'no' | null;
  bestDecision: string;
  worstDecision: string;
  lesson: string;
  postMood: number;        // 1..10 (0 = not set)
  postMoodTags: string[];

  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'tj_daily_plans_v1';

function readAll(): DailyPlan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAll(plans: DailyPlan[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  } catch (e) {
    console.error('Failed to save daily plans', e);
  }
}

export function todayKey(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function listPlans(): DailyPlan[] {
  return readAll().sort((a, b) => b.date.localeCompare(a.date));
}

export function getPlan(date: string): DailyPlan | null {
  return readAll().find((p) => p.date === date) ?? null;
}

export function getTodayPlan(): DailyPlan | null {
  return getPlan(todayKey());
}

export function savePlan(plan: DailyPlan) {
  const all = readAll();
  const idx = all.findIndex((p) => p.date === plan.date);
  const updated = { ...plan, updatedAt: Date.now() };
  if (idx >= 0) all[idx] = updated;
  else all.push(updated);
  writeAll(all);
}

export function deletePlan(date: string) {
  writeAll(readAll().filter((p) => p.date !== date));
}

export function createPlan(date: string): DailyPlan {
  return {
    date,
    bias: 'NEUTRAL',
    keyLevels: '',
    setupsToWatch: '',
    maxTrades: 3,
    maxRiskPct: 2,
    preNotes: '',
    preMood: 5,
    preMoodTags: [],
    reviewed: false,
    followedPlan: null,
    bestDecision: '',
    worstDecision: '',
    lesson: '',
    postMood: 0,
    postMoodTags: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ── Mood tag library ─────────────────────────────────────────────
export const MOOD_TAGS_POSITIVE = ['focused', 'calm', 'confident', 'rested', 'patient', 'disciplined'];
export const MOOD_TAGS_NEGATIVE = ['tired', 'anxious', 'distracted', 'fomo', 'rushed', 'overconfident', 'revenge', 'frustrated'];
export const ALL_MOOD_TAGS = [...MOOD_TAGS_POSITIVE, ...MOOD_TAGS_NEGATIVE];

// ── Stats / streaks ──────────────────────────────────────────────
export interface PlanStats {
  total: number;
  reviewed: number;
  reviewRate: number;          // 0..1
  followedYes: number;
  followedRate: number;        // 0..1 of reviewed
  avgPreMood: number;
  avgPostMood: number;
  consecutiveDays: number;     // current planning streak
}

export function computePlanStats(): PlanStats {
  const plans = listPlans();
  if (plans.length === 0) {
    return { total: 0, reviewed: 0, reviewRate: 0, followedYes: 0, followedRate: 0, avgPreMood: 0, avgPostMood: 0, consecutiveDays: 0 };
  }

  const reviewed = plans.filter((p) => p.reviewed);
  const followedYes = reviewed.filter((p) => p.followedPlan === 'yes').length;
  const followedPartial = reviewed.filter((p) => p.followedPlan === 'partial').length;
  const avgPreMood = plans.reduce((s, p) => s + p.preMood, 0) / plans.length;
  const postMoods = plans.filter((p) => p.postMood > 0);
  const avgPostMood = postMoods.length > 0 ? postMoods.reduce((s, p) => s + p.postMood, 0) / postMoods.length : 0;

  // Consecutive days streak (going back from today)
  const dates = new Set(plans.map((p) => p.date));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const pad = (n: number) => String(n).padStart(2, '0');
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (dates.has(key)) streak++;
    else if (i > 0) break;  // allow skipping today (you might not have planned yet)
  }

  return {
    total: plans.length,
    reviewed: reviewed.length,
    reviewRate: reviewed.length / plans.length,
    followedYes,
    followedRate: reviewed.length > 0 ? (followedYes + 0.5 * followedPartial) / reviewed.length : 0,
    avgPreMood,
    avgPostMood,
    consecutiveDays: streak,
  };
}
