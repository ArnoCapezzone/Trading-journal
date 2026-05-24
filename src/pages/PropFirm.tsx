import { useState, useMemo } from 'react';
import { runMonteCarlo, type MCParams } from '../utils/monteCarlo';

// ── Reusable form helpers ────────────────────────────────────────
function labelStyle(): React.CSSProperties {
  return {
    display: 'block',
    fontSize: 10,
    color: '#8E97AC',
    fontWeight: 600,
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
  };
}
function inputStyle(): React.CSSProperties {
  return {
    width: '100%',
    padding: '8px 11px',
    backgroundColor: '#080B12',
    border: '1px solid #252D3F',
    borderRadius: 5,
    color: '#EEF0F6',
    fontSize: 13,
    fontFamily: '"JetBrains Mono", monospace',
    outline: 'none',
    boxSizing: 'border-box',
  };
}
function suffixGrid(): React.CSSProperties {
  return { position: 'relative', display: 'flex', alignItems: 'center' };
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
  hint?: string;
}) {
  return (
    <div>
      <label style={labelStyle()}>{label}</label>
      <div style={suffixGrid()}>
        <input
          type="number"
          value={value}
          step={step}
          min={min}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          style={{ ...inputStyle(), paddingRight: suffix ? 28 : 11 }}
        />
        {suffix && (
          <span style={{ position: 'absolute', right: 10, fontSize: 11, color: '#4A5368', fontFamily: '"JetBrains Mono", monospace', pointerEvents: 'none' }}>
            {suffix}
          </span>
        )}
      </div>
      {hint && <div style={{ fontSize: 10, color: '#4A5368', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

// ── Section wrapper ──────────────────────────────────────────────
function Card({ title, accent, children, sub }: { title: string; accent: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: '#0D1017', border: '1px solid #1E2839', borderTop: `2px solid ${accent}`, borderRadius: 9, padding: '18px 20px 20px' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: accent, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>
          {title}
        </div>
        {sub && <div style={{ fontSize: 12, color: '#8E97AC', lineHeight: 1.5 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={{ padding: '10px 12px', backgroundColor: '#080B12', borderRadius: 6, border: '1px solid #181E2C' }}>
      <div style={{ fontSize: 9, color: '#4A5368', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color, fontFamily: '"JetBrains Mono", monospace', lineHeight: 1, letterSpacing: '-0.01em' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#8E97AC', marginTop: 4, fontFamily: '"JetBrains Mono", monospace' }}>{sub}</div>}
    </div>
  );
}

// ── Monte Carlo Section ──────────────────────────────────────────
function MonteCarloSection() {
  const [params, setParams] = useState<MCParams>({
    startBalance: 100000,
    winRate: 50,           // stored as %
    rrRatio: 1.5,
    riskPercent: 1,        // stored as %
    nbTrades: 50,
    profitTargetPct: 8,    // stored as %
    maxDrawdownPct: 5,     // stored as %
  });
  const [seed, setSeed] = useState(0);

  const result = useMemo(() => {
    // Trigger re-compute on seed bump
    void seed;
    return runMonteCarlo({
      startBalance: params.startBalance,
      winRate: params.winRate / 100,
      rrRatio: params.rrRatio,
      riskPercent: params.riskPercent / 100,
      nbTrades: params.nbTrades,
      profitTargetPct: params.profitTargetPct / 100,
      maxDrawdownPct: params.maxDrawdownPct / 100,
    }, 1000);
  }, [params, seed]);

  const passColor = result.passRate >= 0.7 ? '#00C47A' : result.passRate >= 0.4 ? '#F0A030' : '#F04848';
  const bustColor = result.bustRate <= 0.1 ? '#00C47A' : result.bustRate <= 0.3 ? '#F0A030' : '#F04848';

  const maxBin = Math.max(...result.distribution.map((d) => d.pct));

  return (
    <Card title="Monte Carlo Simulator" accent="#8B6CF0" sub="Simulates 1000 scenarios based on your edge to estimate pass probability and risk of ruin.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 18 }}>
        <NumberField label="Start Balance" value={params.startBalance} step={1000} onChange={(v) => setParams({ ...params, startBalance: v })} suffix="$" />
        <NumberField label="Win Rate" value={params.winRate} step={1} onChange={(v) => setParams({ ...params, winRate: Math.min(99, Math.max(1, v)) })} suffix="%" />
        <NumberField label="R:R Ratio" value={params.rrRatio} step={0.1} onChange={(v) => setParams({ ...params, rrRatio: Math.max(0.1, v) })} suffix=":1" />
        <NumberField label="Risk / Trade" value={params.riskPercent} step={0.25} onChange={(v) => setParams({ ...params, riskPercent: Math.max(0.1, v) })} suffix="%" />
        <NumberField label="# of Trades" value={params.nbTrades} step={5} onChange={(v) => setParams({ ...params, nbTrades: Math.max(1, Math.round(v)) })} />
        <NumberField label="Profit Target" value={params.profitTargetPct} step={1} onChange={(v) => setParams({ ...params, profitTargetPct: Math.max(0.1, v) })} suffix="%" />
        <NumberField label="Max Drawdown" value={params.maxDrawdownPct} step={1} onChange={(v) => setParams({ ...params, maxDrawdownPct: Math.max(0.1, v) })} suffix="%" />
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            onClick={() => setSeed(seed + 1)}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'linear-gradient(135deg, #8B6CF0, #6D4FD9)',
              border: 'none',
              borderRadius: 5,
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 12px rgba(139,108,240,0.3)',
            }}
          >
            ↻ Re-run
          </button>
        </div>
      </div>

      {/* Main results */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 18 }}>
        <Stat label="Pass Probability" value={`${(result.passRate * 100).toFixed(1)}%`} color={passColor} sub={`${Math.round(result.passRate * 1000)} of 1000`} />
        <Stat label="Risk of Ruin" value={`${(result.bustRate * 100).toFixed(1)}%`} color={bustColor} sub={`${Math.round(result.bustRate * 1000)} of 1000`} />
        <Stat label="Expected Return" value={`${result.expectedReturn >= 0 ? '+' : ''}${result.expectedReturn.toFixed(1)}%`} color={result.expectedReturn >= 0 ? '#00C47A' : '#F04848'} />
        <Stat label="Median Return" value={`${result.medianReturn >= 0 ? '+' : ''}${result.medianReturn.toFixed(1)}%`} color={result.medianReturn >= 0 ? '#00C47A' : '#F04848'} />
        <Stat label="Best / Worst" value={`+${result.bestReturn.toFixed(0)}% / ${result.worstReturn.toFixed(0)}%`} color="#EEF0F6" sub={`Avg DD ${(result.avgMaxDrawdown * 100).toFixed(1)}%`} />
        <Stat label="Expectancy / Trade" value={`${result.expectancyPerTrade >= 0 ? '+' : ''}${result.expectancyPerTrade.toFixed(2)} $`} color={result.expectancyPerTrade >= 0 ? '#00C47A' : '#F04848'} />
      </div>

      {/* Distribution histogram */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: '#8E97AC', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Final Return Distribution (1000 runs)
          </div>
          <div style={{ fontSize: 10, color: '#4A5368', fontFamily: '"JetBrains Mono", monospace' }}>
            x = % return · y = frequency
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 110, padding: '8px 4px 0', borderTop: '1px solid #181E2C', borderBottom: '1px solid #181E2C' }}>
          {result.distribution.map((d, i) => {
            const isNeg = d.bin.startsWith('-');
            const color = isNeg ? '#F04848' : '#00C47A';
            return (
              <div
                key={i}
                title={`${d.bin} — ${d.count} runs (${d.pct.toFixed(1)}%)`}
                style={{
                  flex: 1,
                  height: `${(d.pct / maxBin) * 100}%`,
                  minHeight: d.count > 0 ? 2 : 0,
                  background: `linear-gradient(180deg, ${color}, ${color}88)`,
                  borderRadius: '2px 2px 0 0',
                  position: 'relative',
                  cursor: 'help',
                  opacity: d.count > 0 ? 1 : 0.15,
                  transition: 'opacity 0.15s',
                }}
              />
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#4A5368', fontFamily: '"JetBrains Mono", monospace', marginTop: 5 }}>
          <span>{result.worstReturn.toFixed(0)}%</span>
          <span style={{ color: '#8E97AC' }}>break-even</span>
          <span>+{result.bestReturn.toFixed(0)}%</span>
        </div>
      </div>
    </Card>
  );
}

// ── Payout Calculator ────────────────────────────────────────────
function PayoutSection() {
  const [grossProfit, setGrossProfit] = useState(10000);
  const [propSplit, setPropSplit] = useState(80);     // % to trader
  const [monthlyFee, setMonthlyFee] = useState(0);
  const [taxRate, setTaxRate] = useState(30);         // %
  const [fxRate, setFxRate] = useState(0.92);         // USD → EUR

  const traderShare = grossProfit * (propSplit / 100);
  const afterFee = traderShare - monthlyFee;
  const tax = afterFee * (taxRate / 100);
  const netUSD = afterFee - tax;
  const netEUR = netUSD * fxRate;

  return (
    <Card title="Payout Calculator" accent="#00C47A" sub="See your real take-home after split, fees, taxes, and currency conversion.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 18 }}>
        <NumberField label="Gross Profit" value={grossProfit} step={500} onChange={setGrossProfit} suffix="$" />
        <NumberField label="Prop Split" value={propSplit} step={5} onChange={(v) => setPropSplit(Math.min(100, Math.max(0, v)))} suffix="%" hint="% to trader" />
        <NumberField label="Monthly Fee" value={monthlyFee} step={10} onChange={setMonthlyFee} suffix="$" />
        <NumberField label="Tax Rate" value={taxRate} step={1} onChange={(v) => setTaxRate(Math.min(100, Math.max(0, v)))} suffix="%" />
        <NumberField label="USD → EUR" value={fxRate} step={0.01} onChange={setFxRate} suffix="" hint="Exchange rate" />
      </div>

      {/* Breakdown waterfall */}
      <div style={{ backgroundColor: '#080B12', border: '1px solid #181E2C', borderRadius: 8, padding: '12px 16px' }}>
        <div style={{ fontSize: 10, color: '#8E97AC', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          Payout Breakdown
        </div>

        <PayoutRow label="Gross Profit" value={grossProfit} color="#EEF0F6" />
        <PayoutRow label={`Prop Split (${propSplit}%)`} value={traderShare} delta={traderShare - grossProfit} color="#EEF0F6" />
        {monthlyFee > 0 && <PayoutRow label="Platform Fee" value={afterFee} delta={-monthlyFee} color="#EEF0F6" />}
        <PayoutRow label={`Tax (${taxRate}%)`} value={netUSD} delta={-tax} color="#EEF0F6" />

        {/* Net result */}
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #181E2C', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <div style={{ fontSize: 11, color: '#8E97AC', fontWeight: 500, marginBottom: 2 }}>Net Take-Home</div>
            <div style={{ fontSize: 10, color: '#4A5368', fontFamily: '"JetBrains Mono", monospace' }}>≈ {netEUR.toFixed(0)} €</div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: netUSD >= 0 ? '#00C47A' : '#F04848', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '-0.02em' }}>
            {netUSD >= 0 ? '+' : ''}{netUSD.toFixed(2)} $
          </div>
        </div>

        <div style={{ marginTop: 12, fontSize: 10, color: '#4A5368', lineHeight: 1.5 }}>
          Effective net rate: <strong style={{ color: '#8E97AC' }}>{((netUSD / grossProfit) * 100).toFixed(1)}%</strong> of gross profit
        </div>
      </div>
    </Card>
  );
}

function PayoutRow({ label, value, delta, color }: { label: string; value: number; delta?: number; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', fontSize: 12 }}>
      <div style={{ color: '#8E97AC' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        {delta !== undefined && (
          <span style={{ fontSize: 10, color: delta < 0 ? '#F04848' : '#00C47A', fontFamily: '"JetBrains Mono", monospace' }}>
            {delta >= 0 ? '+' : ''}{delta.toFixed(2)}
          </span>
        )}
        <span style={{ color, fontWeight: 600, fontFamily: '"JetBrains Mono", monospace' }}>
          {value.toFixed(2)} $
        </span>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────
export default function PropFirm() {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', backgroundColor: 'rgba(139,108,240,0.10)', border: '1px solid rgba(139,108,240,0.3)', borderRadius: 4, fontSize: 10, color: '#8B6CF0', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 10 }}>
          PROP FIRM TOOLS
        </div>
        <div style={{ fontSize: 14, color: '#8E97AC', lineHeight: 1.6, maxWidth: 720 }}>
          Evaluate challenge math, variance, drawdown risk, and net payouts <strong style={{ color: '#EEF0F6' }}>before</strong> emotions or false expectations distort decisions.
        </div>
      </div>

      <MonteCarloSection />
      <PayoutSection />
    </div>
  );
}
