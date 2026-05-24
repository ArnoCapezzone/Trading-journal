// Strategy Playbooks — localStorage CRUD + trade assignment
import type { Trade } from '../types/trade';
import { calculateTrade } from '../utils/calculations';

export const PLAYBOOK_COLORS = [
  '#3D8EF0', // blue
  '#00C47A', // green
  '#8B6CF0', // purple
  '#F0A030', // amber
  '#F04848', // red
  '#5AA0F5', // light blue
  '#00BFB3', // teal
  '#FF7AB6', // pink
];

export interface Playbook {
  id: string;
  name: string;
  description: string;
  color: string;
  entryRules: string[];
  exitRules: string[];
  checklist: string[];               // pre-trade validation items
  checklistRequiredCount: number;    // min items to mark trade as compliant
  screenshotBase64?: string;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
}

const PLAYBOOKS_KEY = 'tj_playbooks_v1';
const ASSIGNMENTS_KEY = 'tj_trade_playbooks_v1';

// ── Playbooks CRUD ──────────────────────────────────────────────
function readAll(): Playbook[] {
  try {
    const raw = localStorage.getItem(PLAYBOOKS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAll(items: Playbook[]) {
  try {
    localStorage.setItem(PLAYBOOKS_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to save playbooks', e);
  }
}

export function listPlaybooks(includeArchived = false): Playbook[] {
  const all = readAll();
  return all
    .filter((p) => includeArchived || !p.archived)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getPlaybook(id: string): Playbook | null {
  return readAll().find((p) => p.id === id) ?? null;
}

export function savePlaybook(playbook: Playbook) {
  const all = readAll();
  const idx = all.findIndex((p) => p.id === playbook.id);
  const updated = { ...playbook, updatedAt: Date.now() };
  if (idx >= 0) all[idx] = updated;
  else all.push(updated);
  writeAll(all);
}

export function deletePlaybook(id: string) {
  writeAll(readAll().filter((p) => p.id !== id));
  // Also clean up assignments
  const assigns = readAssignments();
  let changed = false;
  for (const tradeId of Object.keys(assigns)) {
    if (assigns[tradeId] === id) {
      delete assigns[tradeId];
      changed = true;
    }
  }
  if (changed) writeAssignments(assigns);
}

export function createPlaybook(name = 'New Playbook'): Playbook {
  const usedColors = readAll().map((p) => p.color);
  const color = PLAYBOOK_COLORS.find((c) => !usedColors.includes(c)) ?? PLAYBOOK_COLORS[0];
  return {
    id: crypto.randomUUID(),
    name,
    description: '',
    color,
    entryRules: [],
    exitRules: [],
    checklist: [],
    checklistRequiredCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    archived: false,
  };
}

// ── Trade → Playbook assignment ──────────────────────────────────
function readAssignments(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ASSIGNMENTS_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

function writeAssignments(map: Record<string, string>) {
  try {
    localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(map));
  } catch (e) {
    console.error('Failed to save assignments', e);
  }
}

export function getTradePlaybookId(tradeId: string): string | null {
  return readAssignments()[tradeId] ?? null;
}

export function assignPlaybook(tradeId: string, playbookId: string | null) {
  const assigns = readAssignments();
  if (playbookId) assigns[tradeId] = playbookId;
  else delete assigns[tradeId];
  writeAssignments(assigns);
}

export function getAllAssignments(): Record<string, string> {
  return readAssignments();
}

// ── Per-playbook performance stats ──────────────────────────────
export interface PlaybookStats {
  playbookId: string;
  count: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  profitFactor: number | null;
  expectancy: number;
  bestTrade: number;
  worstTrade: number;
}

export function computePlaybookStats(
  trades: Trade[],
  accountBalance: number
): Record<string, PlaybookStats> {
  const assigns = readAssignments();
  const byPlaybook = new Map<string, Trade[]>();

  for (const t of trades) {
    const pid = assigns[t.id];
    if (!pid) continue;
    const arr = byPlaybook.get(pid) ?? [];
    arr.push(t);
    byPlaybook.set(pid, arr);
  }

  const result: Record<string, PlaybookStats> = {};
  for (const [pid, ts] of byPlaybook) {
    const calculated = ts.map((t) => calculateTrade(t, accountBalance));
    const wins = calculated.filter((c) => c.isWin);
    const losses = calculated.filter((c) => !c.isWin);
    const totalPnl = calculated.reduce((s, c) => s + c.pnlDollar, 0);
    const grossProfit = wins.reduce((s, c) => s + c.pnlDollar, 0);
    const grossLoss = Math.abs(losses.reduce((s, c) => s + c.pnlDollar, 0));
    const winRate = ts.length > 0 ? wins.length / ts.length : 0;
    const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
    const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;

    result[pid] = {
      playbookId: pid,
      count: ts.length,
      wins: wins.length,
      losses: losses.length,
      winRate,
      totalPnl,
      avgPnl: totalPnl / ts.length,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
      expectancy: winRate * avgWin - (1 - winRate) * avgLoss,
      bestTrade: calculated.length > 0 ? Math.max(...calculated.map((c) => c.pnlDollar)) : 0,
      worstTrade: calculated.length > 0 ? Math.min(...calculated.map((c) => c.pnlDollar)) : 0,
    };
  }

  return result;
}
