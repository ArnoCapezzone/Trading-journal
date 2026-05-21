import { useState } from 'react';
import { useTradesStore } from '../../store/tradesStore';
import { useSettingsStore } from '../../store/settingsStore';
import {
  calculateTrade,
  calculateDashboardKPIs,
  calculateByInstrument,
  calculateBySetup,
} from '../../utils/calculations';
import { format } from 'date-fns';

function fmt(n: number, decimals = 2) {
  return n.toFixed(decimals);
}

function fmtDuration(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

function detectRecurringErrors(trades: import('../../types/trade').Trade[], accountBalance: number) {
  const errors: string[] = [];

  const calculated = trades.map((t) => ({ trade: t, calc: calculateTrade(t, accountBalance) }));

  // 1. Trades closed at a loss with no notes
  const lossesNoNotes = calculated.filter(
    (x) => !x.calc.isWin && (!x.trade.notes || x.trade.notes.trim().length === 0)
  );
  if (lossesNoNotes.length > 0) {
    errors.push(
      `${lossesNoNotes.length} losing trades have no notes/post-trade review — lack of journaling on losses makes it harder to identify patterns.`
    );
  }

  // 2. Trades with RR < 0.5 (exiting way before target)
  const badRR = calculated.filter((x) => x.calc.rrRatio !== null && x.calc.rrRatio < 0.5);
  if (badRR.length > trades.length * 0.2) {
    errors.push(
      `${badRR.length} trades (${fmt((badRR.length / trades.length) * 100, 0)}%) closed with R:R < 0.5 — possible early exits or moving SL against the position.`
    );
  }

  // 3. Overtrading days: >3 trades in a single day
  const tradesByDay = new Map<string, number>();
  for (const { trade } of calculated) {
    const key = format(new Date(trade.entryTime), 'yyyy-MM-dd');
    tradesByDay.set(key, (tradesByDay.get(key) ?? 0) + 1);
  }
  const overtradingDays = [...tradesByDay.entries()].filter(([, count]) => count > 3);
  if (overtradingDays.length > 0) {
    const worstDay = overtradingDays.sort((a, b) => b[1] - a[1])[0];
    errors.push(
      `Overtrading detected on ${overtradingDays.length} day(s) (max: ${worstDay[1]} trades on ${worstDay[0]}).`
    );
  }

  // 4. Consistently losing on a specific instrument
  const byInstrument = calculateByInstrument(trades);
  const losingInstruments = byInstrument.filter((i) => i.pnl < 0 && i.count >= 3);
  for (const inst of losingInstruments) {
    errors.push(
      `${inst.instrument}: net loss of ${fmt(inst.pnl)} over ${inst.count} trades — consider if this instrument fits your edge.`
    );
  }

  // 5. Consistently losing on a specific setup
  const bySetup = calculateBySetup(trades);
  const losingSetups = bySetup.filter((s) => s.pnl < 0 && s.count >= 3);
  for (const setup of losingSetups) {
    errors.push(
      `Setup "${setup.setup}": win rate ${fmt(setup.winRate * 100, 0)}% over ${setup.count} trades, net ${fmt(setup.pnl)} — underperforming setup.`
    );
  }

  // 6. Revenge trading: loss followed immediately by another trade within 15 min
  const sorted = [...calculated].sort(
    (a, b) => new Date(a.trade.entryTime).getTime() - new Date(b.trade.entryTime).getTime()
  );
  let revengeCount = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const gap =
      (new Date(curr.trade.entryTime).getTime() - new Date(prev.trade.exitTime).getTime()) / 60000;
    if (!prev.calc.isWin && gap >= 0 && gap <= 15) revengeCount++;
  }
  if (revengeCount >= 2) {
    errors.push(
      `${revengeCount} possible revenge trades detected (new trade opened within 15min of a losing trade).`
    );
  }

  // 7. Large variance in lot sizing
  const lots = trades.map((t) => t.lotSize);
  const avgLot = lots.reduce((a, b) => a + b, 0) / lots.length;
  const maxLot = Math.max(...lots);
  if (maxLot > avgLot * 3) {
    errors.push(
      `Inconsistent position sizing: average lot ${fmt(avgLot, 2)}, max ${fmt(maxLot, 2)} — ${fmt((maxLot / avgLot) * 100, 0)}% above average. Risk is not uniform across trades.`
    );
  }

  return errors;
}

function generateExport(trades: import('../../types/trade').Trade[], accountBalance: number, currency: string): string {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.exitTime).getTime() - new Date(b.exitTime).getTime()
  );

  const kpis = calculateDashboardKPIs(trades, accountBalance);
  const byInstrument = calculateByInstrument(trades);
  const bySetup = calculateBySetup(trades);
  const errors = detectRecurringErrors(trades, accountBalance);

  const lines: string[] = [];

  // ── HEADER ──────────────────────────────────────────────────────
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('  TRADING JOURNAL EXPORT — AI ANALYSIS REQUEST');
  lines.push(`  Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')} | Account: ${accountBalance} ${currency}`);
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');
  lines.push('Please analyze my trading journal below and provide:');
  lines.push('1. An honest assessment of my strengths and weaknesses');
  lines.push('2. The main behavioral patterns you observe (positive and negative)');
  lines.push('3. Specific, actionable recommendations to improve my performance');
  lines.push('4. Your view on which setups/instruments I should focus on or avoid');
  lines.push('');

  // ── GLOBAL KPIs ─────────────────────────────────────────────────
  lines.push('───────────────────────────────────────────────────────────');
  lines.push('  GLOBAL STATISTICS');
  lines.push('───────────────────────────────────────────────────────────');
  lines.push(`Total Trades     : ${kpis.totalTrades}`);
  lines.push(`Win Rate         : ${fmt(kpis.winRate * 100)}%`);
  lines.push(`Total P&L        : ${fmt(kpis.totalPnlDollar)} ${currency}${kpis.totalPnlPercent !== null ? ` (${fmt(kpis.totalPnlPercent)}%)` : ''}`);
  lines.push(`Profit Factor    : ${kpis.profitFactor !== null ? fmt(kpis.profitFactor) : 'N/A'}`);
  lines.push(`Expectancy       : ${fmt(kpis.expectancy)} ${currency}/trade`);
  lines.push(`Avg Win          : ${fmt(kpis.avgWin)} ${currency}`);
  lines.push(`Avg Loss         : -${fmt(kpis.avgLoss)} ${currency}`);
  lines.push(`Avg R:R          : ${kpis.avgRR !== null ? fmt(kpis.avgRR) : 'N/A'}`);
  lines.push(`Max Drawdown     : ${fmt(kpis.maxDrawdown)} ${currency}${kpis.maxDrawdownPercent !== null ? ` (${fmt(kpis.maxDrawdownPercent)}%)` : ''}`);
  lines.push(`Best Trade       : +${fmt(kpis.bestTrade)} ${currency}`);
  lines.push(`Worst Trade      : ${fmt(kpis.worstTrade)} ${currency}`);
  lines.push(`Max Win Streak   : ${kpis.maxWinStreak}`);
  lines.push(`Max Loss Streak  : ${kpis.maxLossStreak}`);
  lines.push(`Avg Duration     : ${fmtDuration(kpis.avgDurationMinutes)}`);
  lines.push('');

  // ── BY INSTRUMENT ───────────────────────────────────────────────
  if (byInstrument.length > 0) {
    lines.push('───────────────────────────────────────────────────────────');
    lines.push('  PERFORMANCE BY INSTRUMENT');
    lines.push('───────────────────────────────────────────────────────────');
    for (const inst of byInstrument) {
      const instTrades = trades.filter((t) => t.instrument === inst.instrument);
      const wins = instTrades.filter((t) => calculateTrade(t, accountBalance).isWin).length;
      const wr = instTrades.length > 0 ? (wins / instTrades.length) * 100 : 0;
      lines.push(
        `${inst.instrument.padEnd(10)} | ${String(inst.count).padStart(3)} trades | WR: ${fmt(wr, 0).padStart(3)}% | P&L: ${fmt(inst.pnl)} ${currency}`
      );
    }
    lines.push('');
  }

  // ── BY SETUP ────────────────────────────────────────────────────
  if (bySetup.length > 0) {
    lines.push('───────────────────────────────────────────────────────────');
    lines.push('  PERFORMANCE BY SETUP');
    lines.push('───────────────────────────────────────────────────────────');
    for (const s of bySetup) {
      lines.push(
        `${s.setup.padEnd(22)} | ${String(s.count).padStart(3)} trades | WR: ${fmt(s.winRate * 100, 0).padStart(3)}% | P&L: ${fmt(s.pnl)} ${currency}`
      );
    }
    lines.push('');
  }

  // ── RECURRING ERRORS ────────────────────────────────────────────
  lines.push('───────────────────────────────────────────────────────────');
  lines.push('  AUTOMATICALLY DETECTED ISSUES');
  lines.push('───────────────────────────────────────────────────────────');
  if (errors.length === 0) {
    lines.push('No major recurring issues detected automatically.');
  } else {
    for (let i = 0; i < errors.length; i++) {
      lines.push(`${i + 1}. ${errors[i]}`);
    }
  }
  lines.push('');

  // ── TRADE LOG ───────────────────────────────────────────────────
  lines.push('───────────────────────────────────────────────────────────');
  lines.push('  FULL TRADE LOG');
  lines.push('───────────────────────────────────────────────────────────');

  for (let i = 0; i < sorted.length; i++) {
    const trade = sorted[i];
    const calc = calculateTrade(trade, accountBalance);
    const sign = calc.pnlDollar >= 0 ? '+' : '';
    lines.push(`#${String(i + 1).padStart(3)}  ${format(new Date(trade.entryTime), 'yyyy-MM-dd HH:mm')} → ${format(new Date(trade.exitTime), 'HH:mm')}  |  ${trade.instrument.padEnd(8)} ${trade.direction.padEnd(5)}  |  ${trade.lotSize} lot  |  ${fmt(trade.entryPrice)} → ${fmt(trade.exitPrice)}  |  P&L: ${sign}${fmt(calc.pnlDollar)} ${currency}  |  ${fmtDuration(calc.durationMinutes)}${trade.setup ? `  |  ${trade.setup}` : ''}${trade.timeframe ? `  |  ${trade.timeframe}` : ''}${calc.rrRatio !== null ? `  |  R:R ${fmt(calc.rrRatio)}` : ''}${trade.notes ? `\n       Notes: ${trade.notes}` : ''}`);
  }

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('  END OF EXPORT');
  lines.push('═══════════════════════════════════════════════════════════');

  return lines.join('\n');
}

export default function ClaudeAnalysis() {
  const { trades } = useTradesStore();
  const { accountBalance, currency } = useSettingsStore();

  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  function handleGenerate() {
    const text = generateExport(trades, accountBalance, currency);
    setPreview(text);
  }

  async function handleCopy() {
    if (!preview) return;
    await navigator.clipboard.writeText(preview);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function handleDownload() {
    if (!preview) return;
    const blob = new Blob([preview], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trading-journal-analysis-${format(new Date(), 'yyyy-MM-dd')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const noTrades = trades.length === 0;

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      {/* Header card */}
      <div
        style={{
          backgroundColor: '#1a1d27',
          border: '1px solid #2d3148',
          borderRadius: 10,
          padding: '24px 28px',
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 36 }}>🤖</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#e8eaf0', marginBottom: 6 }}>
              Claude AI Analysis Export
            </div>
            <div style={{ fontSize: 12, color: '#8892a4', lineHeight: 1.7 }}>
              Generates a structured text export of your entire trading journal — optimized to be pasted
              directly into <strong style={{ color: '#4d9eff' }}>claude.ai</strong> for a deep behavioral
              and statistical analysis.
            </div>
          </div>
        </div>

        {/* Feature chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
          {[
            '📊 Global KPIs',
            '📈 By instrument & setup',
            '⚠️ Auto-detected errors',
            '📋 Full trade log with notes',
            '🧠 Behavioral patterns',
          ].map((label) => (
            <span
              key={label}
              style={{
                fontSize: 11,
                color: '#8892a4',
                backgroundColor: '#0f1117',
                border: '1px solid #2d3148',
                borderRadius: 4,
                padding: '3px 10px',
              }}
            >
              {label}
            </span>
          ))}
        </div>

        {/* Generate button */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={handleGenerate}
            disabled={noTrades}
            style={{
              padding: '10px 22px',
              backgroundColor: noTrades ? '#22263a' : '#4d9eff',
              border: 'none',
              borderRadius: 6,
              color: noTrades ? '#8892a4' : '#0f1117',
              fontSize: 13,
              fontWeight: 700,
              cursor: noTrades ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            ⚡ Generate Export ({trades.length} trades)
          </button>

          {preview && (
            <>
              <button
                onClick={handleCopy}
                style={{
                  padding: '10px 18px',
                  backgroundColor: copied ? 'rgba(0,209,122,0.15)' : '#22263a',
                  border: `1px solid ${copied ? '#00d17a' : '#2d3148'}`,
                  borderRadius: 6,
                  color: copied ? '#00d17a' : '#e8eaf0',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {copied ? '✓ Copied!' : '📋 Copy to Clipboard'}
              </button>
              <button
                onClick={handleDownload}
                style={{
                  padding: '10px 18px',
                  backgroundColor: '#22263a',
                  border: '1px solid #2d3148',
                  borderRadius: 6,
                  color: '#e8eaf0',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                💾 Download .txt
              </button>
            </>
          )}
        </div>

        {noTrades && (
          <div style={{ marginTop: 12, fontSize: 11, color: '#ff4d4d' }}>
            Import trades first to generate an analysis export.
          </div>
        )}
      </div>

      {/* Instructions */}
      {!preview && (
        <div
          style={{
            backgroundColor: '#1a1d27',
            border: '1px solid #2d3148',
            borderRadius: 10,
            padding: '20px 24px',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: '#4d9eff', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
            How to use
          </div>
          <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              'Click "Generate Export" to build the structured text file from your journal',
              'Click "Copy to Clipboard" then open claude.ai in a new tab',
              'Paste the export and hit Send — Claude will analyze your patterns, errors, and opportunities',
              'For deeper analysis, add a personal question after the export (e.g. "Why do I perform better on Tuesdays?")',
            ].map((step, i) => (
              <li key={i} style={{ fontSize: 12, color: '#8892a4', lineHeight: 1.6 }}>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div
          style={{
            backgroundColor: '#0f1117',
            border: '1px solid #2d3148',
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              borderBottom: '1px solid #2d3148',
              backgroundColor: '#1a1d27',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Export Preview — {preview.length.toLocaleString()} characters
            </span>
            <button
              onClick={() => setPreview(null)}
              style={{
                background: 'none',
                border: 'none',
                color: '#8892a4',
                fontSize: 16,
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
          <pre
            style={{
              margin: 0,
              padding: '16px',
              fontSize: 11,
              fontFamily: '"JetBrains Mono", monospace',
              color: '#c8cdd8',
              lineHeight: 1.65,
              overflowX: 'auto',
              maxHeight: 480,
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {preview}
          </pre>
        </div>
      )}
    </div>
  );
}
