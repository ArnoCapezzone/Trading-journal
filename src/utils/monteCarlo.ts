// Monte Carlo simulation for prop firm challenge probability analysis

export interface MCParams {
  startBalance: number;
  winRate: number;          // 0..1
  rrRatio: number;          // e.g. 1.5
  riskPercent: number;      // 0..1, e.g. 0.01 = 1%
  nbTrades: number;
  profitTargetPct: number;  // 0..1, e.g. 0.08 = 8%
  maxDrawdownPct: number;   // 0..1, e.g. 0.10 = 10%
}

export interface MCRun {
  finalBalance: number;
  maxDrawdownReached: number;  // 0..1
  hitTarget: boolean;
  busted: boolean;
  tradesUntilOutcome: number;  // trade index at which target was hit or busted (-1 if neither)
}

export interface MCResult {
  runs: MCRun[];
  passRate: number;          // 0..1
  bustRate: number;          // 0..1
  expectedReturn: number;    // avg % return
  medianReturn: number;
  bestReturn: number;
  worstReturn: number;
  avgMaxDrawdown: number;    // avg DD % across runs
  expectancyPerTrade: number; // expected $ per trade given params
  rOfRuin: number;            // 0..1 — actual probability of busting before target
  distribution: { bin: string; count: number; pct: number }[];
}

// ── Single simulation run ────────────────────────────────────────
function simulateOne(p: MCParams): MCRun {
  let balance = p.startBalance;
  let peak = balance;
  let maxDDReached = 0;
  const target = p.startBalance * (1 + p.profitTargetPct);
  const bustFloor = p.startBalance * (1 - p.maxDrawdownPct);

  let hitTarget = false;
  let busted = false;
  let tradesUntilOutcome = -1;

  for (let i = 0; i < p.nbTrades; i++) {
    const risk = balance * p.riskPercent;
    const isWin = Math.random() < p.winRate;
    if (isWin) balance += risk * p.rrRatio;
    else balance -= risk;

    if (balance > peak) peak = balance;
    const dd = peak > 0 ? (peak - balance) / peak : 0;
    if (dd > maxDDReached) maxDDReached = dd;

    if (balance >= target && !hitTarget && !busted) {
      hitTarget = true;
      tradesUntilOutcome = i + 1;
    }
    if (balance <= bustFloor && !busted && !hitTarget) {
      busted = true;
      tradesUntilOutcome = i + 1;
    }
  }

  return { finalBalance: balance, maxDrawdownReached: maxDDReached, hitTarget, busted, tradesUntilOutcome };
}

// ── Build histogram bins from final returns ──────────────────────
function buildDistribution(runs: MCRun[], startBalance: number, nbBins = 10) {
  const returns = runs.map((r) => ((r.finalBalance - startBalance) / startBalance) * 100);
  const min = Math.min(...returns);
  const max = Math.max(...returns);
  const range = max - min || 1;
  const step = range / nbBins;

  const buckets: number[] = new Array(nbBins).fill(0);
  for (const r of returns) {
    let idx = Math.floor((r - min) / step);
    if (idx >= nbBins) idx = nbBins - 1;
    if (idx < 0) idx = 0;
    buckets[idx]++;
  }

  return buckets.map((count, i) => {
    const lo = min + i * step;
    const hi = lo + step;
    const sign = lo >= 0 ? '+' : '';
    return {
      bin: `${sign}${lo.toFixed(0)}% to ${hi >= 0 ? '+' : ''}${hi.toFixed(0)}%`,
      count,
      pct: (count / runs.length) * 100,
    };
  });
}

// ── Public API ───────────────────────────────────────────────────
export function runMonteCarlo(params: MCParams, nbSimulations = 1000): MCResult {
  const runs: MCRun[] = [];
  for (let i = 0; i < nbSimulations; i++) runs.push(simulateOne(params));

  const passed = runs.filter((r) => r.hitTarget).length;
  const busted = runs.filter((r) => r.busted).length;

  const returns = runs.map((r) => ((r.finalBalance - params.startBalance) / params.startBalance) * 100);
  const sorted = [...returns].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const avg = returns.reduce((a, b) => a + b, 0) / returns.length;

  const avgDD = runs.reduce((s, r) => s + r.maxDrawdownReached, 0) / runs.length;

  // Per-trade expectancy
  const expectancyPct = params.winRate * params.rrRatio - (1 - params.winRate);
  const expectancyPerTrade = params.startBalance * params.riskPercent * expectancyPct;

  return {
    runs,
    passRate: passed / nbSimulations,
    bustRate: busted / nbSimulations,
    expectedReturn: avg,
    medianReturn: median,
    bestReturn: Math.max(...returns),
    worstReturn: Math.min(...returns),
    avgMaxDrawdown: avgDD,
    expectancyPerTrade,
    rOfRuin: busted / nbSimulations,
    distribution: buildDistribution(runs, params.startBalance),
  };
}
