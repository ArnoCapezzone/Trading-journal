// AI Mentor — Groq client with streaming
import type { Trade } from '../types/trade';
import {
  calculateDashboardKPIs,
  calculateByInstrument,
  calculateBySetup,
  calculateTrade,
} from '../utils/calculations';
import {
  calculateRevengeTradingImpact,
  calculateDisciplineScore,
  calculateByHour,
  calculateByDayOfWeek,
} from './../utils/advancedMetrics';
import { listGoals, computeGoalProgress, getGoalTypeLabel } from './goalsStore';
import { format } from 'date-fns';

const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY as string | undefined;

// Use the larger versatile model for high-quality mentor responses
const MODEL = 'llama-3.3-70b-versatile';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

// ── System prompt builder ───────────────────────────────────────
export function buildSystemPrompt(
  trades: Trade[],
  accountBalance: number,
  currency: string
): string {
  if (trades.length === 0) {
    return `You are an expert trading mentor and behavioral coach. The user has no trades logged yet in their journal.

Your role:
- Welcome them warmly
- Explain how you can help once they log trades (import via CSV/MT5 or use voice dictation)
- Provide general trading wisdom if asked
- Respond in the language the user writes in (FR or EN)
- Use markdown for clarity (headings, bullets, bold)`;
  }

  const kpis = calculateDashboardKPIs(trades, accountBalance);
  const byInstr = calculateByInstrument(trades).slice(0, 8);
  const bySetup = calculateBySetup(trades).slice(0, 6);

  // Last 30 trades sorted by exit time desc
  const recent = [...trades]
    .sort((a, b) => new Date(b.exitTime).getTime() - new Date(a.exitTime).getTime())
    .slice(0, 30);

  const tradeLines = recent.map((t, i) => {
    const calc = calculateTrade(t, accountBalance);
    const sign = calc.pnlDollar >= 0 ? '+' : '';
    return `${String(i + 1).padStart(2)}. ${format(new Date(t.entryTime), 'MM-dd HH:mm')} ${t.instrument} ${t.direction} ${t.lotSize}lot @ ${t.entryPrice}→${t.exitPrice} | ${sign}${calc.pnlDollar.toFixed(2)} ${currency}${t.setup ? ` | ${t.setup}` : ''}${t.timeframe ? ` | ${t.timeframe}` : ''}${calc.rrRatio !== null ? ` | RR:${calc.rrRatio.toFixed(2)}` : ''}${t.notes ? ` | "${t.notes.slice(0, 80)}"` : ''}`;
  });

  // Behavioral pattern detection
  const issues = detectIssues(trades, accountBalance);

  // Advanced behavioral metrics
  const revenge = calculateRevengeTradingImpact(trades, accountBalance);
  const discipline = calculateDisciplineScore(trades, accountBalance);
  const byHour = calculateByHour(trades, accountBalance).filter((h) => h.trades >= 2);
  const byDay = calculateByDayOfWeek(trades, accountBalance).filter((d) => d.trades >= 2);
  const bestHour = byHour.length > 0 ? byHour.reduce((a, b) => (a.avgPnl > b.avgPnl ? a : b)) : null;
  const worstHour = byHour.length > 0 ? byHour.reduce((a, b) => (a.avgPnl < b.avgPnl ? a : b)) : null;
  const bestDay = byDay.length > 0 ? byDay.reduce((a, b) => (a.avgPnl > b.avgPnl ? a : b)) : null;
  const worstDay = byDay.length > 0 ? byDay.reduce((a, b) => (a.avgPnl < b.avgPnl ? a : b)) : null;

  // Active goals
  const goals = listGoals().map((g) => {
    const p = computeGoalProgress(g, trades, accountBalance, currency);
    return { goal: g, progress: p };
  });

  return `You are an elite trading mentor and behavioral coach with deep expertise in psychology, risk management, and statistical edge analysis. You have FULL access to the trader's journal data below. Be direct, specific, and reference actual data — no generic advice.

═══════════════════════════════════════════
TRADER PROFILE
═══════════════════════════════════════════
Account balance: ${accountBalance} ${currency}
Total trades logged: ${trades.length}

═══════════════════════════════════════════
PERFORMANCE METRICS
═══════════════════════════════════════════
Win rate:        ${(kpis.winRate * 100).toFixed(1)}%
Profit factor:   ${kpis.profitFactor !== null ? kpis.profitFactor.toFixed(2) : 'N/A'}
Expectancy:      ${kpis.expectancy.toFixed(2)} ${currency}/trade
Total P&L:       ${kpis.totalPnlDollar >= 0 ? '+' : ''}${kpis.totalPnlDollar.toFixed(2)} ${currency} (${kpis.totalPnlPercent !== null ? kpis.totalPnlPercent.toFixed(2) + '%' : '—'})
Avg win:         +${kpis.avgWin.toFixed(2)} ${currency}
Avg loss:        -${kpis.avgLoss.toFixed(2)} ${currency}
Avg R:R:         ${kpis.avgRR !== null ? kpis.avgRR.toFixed(2) : 'N/A'}
Max drawdown:    ${kpis.maxDrawdown.toFixed(2)} ${currency} (${kpis.maxDrawdownPercent !== null ? kpis.maxDrawdownPercent.toFixed(2) + '%' : '—'})
Best trade:      +${kpis.bestTrade.toFixed(2)} ${currency}
Worst trade:     ${kpis.worstTrade.toFixed(2)} ${currency}
Win streak:      ${kpis.maxWinStreak}
Loss streak:     ${kpis.maxLossStreak}

═══════════════════════════════════════════
BY INSTRUMENT (top 8)
═══════════════════════════════════════════
${byInstr.map((i) => `${i.instrument.padEnd(8)} | ${String(i.count).padStart(3)} trades | P&L: ${i.pnl >= 0 ? '+' : ''}${i.pnl.toFixed(2)}`).join('\n')}

═══════════════════════════════════════════
BY SETUP
═══════════════════════════════════════════
${bySetup.map((s) => `${s.setup.padEnd(22)} | ${String(s.count).padStart(3)} trades | WR: ${(s.winRate * 100).toFixed(0)}% | P&L: ${s.pnl >= 0 ? '+' : ''}${s.pnl.toFixed(2)}`).join('\n')}

═══════════════════════════════════════════
LAST 30 TRADES
═══════════════════════════════════════════
${tradeLines.join('\n')}

═══════════════════════════════════════════
BEHAVIORAL METRICS
═══════════════════════════════════════════
Discipline Score: ${discipline.score}/100 (${discipline.withNotes}/${discipline.totalTrades} with notes, ${discipline.withSetup}/${discipline.totalTrades} tagged setup)
Revenge Trading: ${revenge.count} trades (net ${revenge.netPnl >= 0 ? '+' : ''}${revenge.netPnl.toFixed(2)} ${currency}, WR ${(revenge.winRate * 100).toFixed(0)}%, avg gap ${revenge.avgGap.toFixed(0)}min)
Best hour: ${bestHour ? `${String(bestHour.hour).padStart(2, '0')}:00 (avg ${bestHour.avgPnl >= 0 ? '+' : ''}${bestHour.avgPnl.toFixed(2)} ${currency} over ${bestHour.trades} trades)` : 'insufficient data'}
Worst hour: ${worstHour ? `${String(worstHour.hour).padStart(2, '0')}:00 (avg ${worstHour.avgPnl.toFixed(2)} ${currency} over ${worstHour.trades} trades)` : 'insufficient data'}
Best day: ${bestDay ? `${bestDay.dayName} (avg ${bestDay.avgPnl >= 0 ? '+' : ''}${bestDay.avgPnl.toFixed(2)} ${currency})` : 'insufficient data'}
Worst day: ${worstDay ? `${worstDay.dayName} (avg ${worstDay.avgPnl.toFixed(2)} ${currency})` : 'insufficient data'}

${goals.length > 0 ? `═══════════════════════════════════════════
ACTIVE GOALS
═══════════════════════════════════════════
${goals.map((g) => `${g.progress.achieved ? '✓' : '○'} ${g.goal.title} — ${g.progress.formatted.current} / ${g.progress.formatted.target} (${g.progress.percent.toFixed(0)}%)${g.goal.deadline ? ` · deadline ${new Date(g.goal.deadline).toISOString().slice(0, 10)}` : ''} [${getGoalTypeLabel(g.goal.type)}]`).join('\n')}

` : ''}${issues.length > 0 ? `═══════════════════════════════════════════
AUTO-DETECTED BEHAVIORAL PATTERNS
═══════════════════════════════════════════
${issues.map((e, i) => `${i + 1}. ${e}`).join('\n')}

` : ''}═══════════════════════════════════════════
YOUR ROLE
═══════════════════════════════════════════
- Answer based on the EXACT data above — cite specific trades, numbers, dates
- Be honest: identify what's working AND what's harmful
- Behave like a strict but supportive mentor (not a cheerleader)
- If the user asks something vague, give them a sharp, focused answer
- Use markdown: ## headings, **bold** for key numbers, bullet lists, code blocks for data
- Respond in the SAME LANGUAGE the user writes in (French or English)
- Keep responses focused — avoid generic platitudes
- When suggesting actions, be concrete (e.g. "stop trading XAUUSD until you log 10 paper trades with a clear plan")`;
}

// ── Internal pattern detection ───────────────────────────────────
function detectIssues(trades: Trade[], accountBalance: number): string[] {
  const issues: string[] = [];
  const calculated = trades.map((t) => ({ trade: t, calc: calculateTrade(t, accountBalance) }));

  const lossesNoNotes = calculated.filter(
    (x) => !x.calc.isWin && (!x.trade.notes || x.trade.notes.trim().length === 0)
  );
  if (lossesNoNotes.length > 3) {
    issues.push(`${lossesNoNotes.length} losing trades have no notes — no post-trade learning happening on losses.`);
  }

  // Revenge trades
  const sorted = [...calculated].sort(
    (a, b) => new Date(a.trade.entryTime).getTime() - new Date(b.trade.entryTime).getTime()
  );
  let revenge = 0;
  let revengePnl = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const gap =
      (new Date(curr.trade.entryTime).getTime() - new Date(prev.trade.exitTime).getTime()) / 60000;
    if (!prev.calc.isWin && gap >= 0 && gap <= 15) {
      revenge++;
      revengePnl += curr.calc.pnlDollar;
    }
  }
  if (revenge >= 2) {
    issues.push(`${revenge} revenge trades detected (opened <15min after a loss). Net P&L from revenge trades: ${revengePnl.toFixed(2)}.`);
  }

  // Overtrading
  const byDay = new Map<string, number>();
  for (const { trade } of calculated) {
    const key = format(new Date(trade.entryTime), 'yyyy-MM-dd');
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  const overdays = [...byDay.entries()].filter(([, c]) => c > 3);
  if (overdays.length > 0) {
    issues.push(`Overtrading: ${overdays.length} days with >3 trades.`);
  }

  // Sizing variance
  const lots = trades.map((t) => t.lotSize);
  if (lots.length >= 5) {
    const avg = lots.reduce((a, b) => a + b, 0) / lots.length;
    const max = Math.max(...lots);
    if (max > avg * 3) {
      issues.push(`Inconsistent sizing: avg lot ${avg.toFixed(2)}, max ${max.toFixed(2)} (${((max / avg) * 100).toFixed(0)}% above avg).`);
    }
  }

  // Losing instruments
  const byInstr = calculateByInstrument(trades);
  for (const i of byInstr.filter((x) => x.pnl < 0 && x.count >= 3)) {
    issues.push(`${i.instrument}: net loss of ${i.pnl.toFixed(2)} over ${i.count} trades.`);
  }

  return issues;
}

// ── Streaming chat ───────────────────────────────────────────────
export async function* streamChat(
  systemPrompt: string,
  history: Message[],
  userMessage: string,
  signal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
  if (!GROQ_KEY) throw new Error('VITE_GROQ_API_KEY not configured');

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: true,
      temperature: 0.6,
      max_tokens: 1800,
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    throw new Error(`Groq error ${res.status}: ${await res.text()}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        /* malformed chunk, skip */
      }
    }
  }
}
