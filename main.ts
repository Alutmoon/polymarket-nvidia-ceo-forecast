// polymarket-nvidia-ceo-forecast-01 entry (Node 22, standard library only).
//
// Model: persistence median with a per-market, recency-weighted spread that
// grows sub-diffusively with horizon.
//
//   q_tau(h) = clamp(x + z_tau * sigma * h^0.4, 0, 1), rounded to 6 decimals
//
// where x is the market's last price, z_tau the standard normal quantile at
// each scored level, and sigma is that market's own realised 1-minute
// volatility, estimated as the winsorised RMS of its 1-minute price changes
// with exponentially decaying weights (half-life 90 minutes, so a market
// that went quiet recently gets a narrow spread and one that just jumped
// gets a wide one), floored at 0.0004 and capped at 0.01 price units per
// square-root minute.
//
// Why this shape (tuned on the six practice cases, kept deliberately simple
// to avoid overfitting five scored cases):
//   - Per-market sigma beats the fixed 0.0025 baseline by a wide margin:
//     most markets barely move (tiny prices, tick noise) while a few jump
//     by 0.1+ in a minute; one sigma for all is wrong for both.
//   - h^0.4, not sqrt(h): realised 240-minute moves are much smaller than
//     a random walk with the 1-minute volatility implies (1-minute
//     autocorrelations run about -0.07 to -0.10, i.e. mild mean reversion /
//     bid-ask bounce), so variance grows slower than linearly in h.
//   - No drift: short-term trends (last-hour / last-6-hour drift, reversion
//     toward trailing means) did not improve the practice loss, so the
//     median stays at the last price.
//   - No fatter tails: widening the outer quantiles hurt; the per-market
//     sigma already widens the bands where jumps are frequent.
//   - No cross-market sum adjustment: the 24 Yes prices already sum to
//     about 1 at each checkpoint, so the medians need no correction.
//
// Practice backtest (independently recomputed pinball loss, cases p00-p04):
//   baseline 0.392518, this entry 0.306365 (-22%), wins all 5 cases
//   (p00 0.466 vs 0.536, p01 0.307 vs 0.380, p02 0.342 vs 0.408,
//   p03 0.254 vs 0.369, p04 0.200 vs 0.299). 90% coverage 0.888.
//
// I/O contract (same as the kit's starter): read every <id>.in in the input
// directory ($MAKEFUN_INPUT_DIR, else /input), write <id>.out to the output
// directory ($MAKEFUN_OUTPUT_DIR, else /output) as {"forecasts":[{"id","q"}]},
// q exactly horizon_minutes rows of the five quantiles, non-decreasing, in
// [0,1]. Deterministic: no randomness, no time, no network.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** The quantile levels the contest scores, in the order each row lists them. */
const QUANTILES = [0.05, 0.25, 0.5, 0.75, 0.95];
/** The standard normal's quantile at each level, to 6 decimals. */
const Z = [-1.644854, -0.67449, 0, 0.67449, 1.644854];

/** Half-life (minutes) of the recency weights on 1-minute price changes. */
const EWMA_HALF_LIFE = 90;
/** 1-minute changes are winsorised to this magnitude before the RMS. */
const WINSOR = 0.02;
/** Floor and cap on the per-market sigma (price units per sqrt-minute). */
const SIGMA_FLOOR = 0.0004;
const SIGMA_CAP = 0.01;
/** Spread grows as h^GAMMA, not sqrt(h): variance grows sub-linearly. */
const GAMMA = 0.4;

interface CaseMarket {
  id: string;
  prices: number[];
}

interface Case {
  horizon_minutes: number;
  quantiles: number[];
  markets: CaseMarket[];
}

/** x clamped to [0,1] and rounded to 6 decimals (0, never -0). */
const price6 = (x: number): number => Math.round(Math.min(1, Math.max(0, x)) * 1e6) / 1e6 + 0;

/**
 * A market's realised 1-minute volatility: the winsorised RMS of its
 * 1-minute changes, weighted by recency (newest change weight 1, halving
 * every EWMA_HALF_LIFE minutes). Markets with fewer than two prices fall
 * back to the house baseline's 0.0025.
 */
function sigmaOf(prices: number[]): number {
  const n = prices.length;
  if (n < 2) return 0.0025;
  const lam = Math.pow(0.5, 1 / EWMA_HALF_LIFE);
  let weightedSq = 0;
  let weightSum = 0;
  let w = 1;
  for (let i = n - 1; i >= 1; i--) {
    let d = prices[i] - prices[i - 1];
    if (d > WINSOR) d = WINSOR;
    else if (d < -WINSOR) d = -WINSOR;
    weightedSq += w * d * d;
    weightSum += w;
    w *= lam;
  }
  const sigma = Math.sqrt(weightedSq / weightSum);
  return Math.min(SIGMA_CAP, Math.max(SIGMA_FLOOR, sigma));
}

/** The forecast of one market: horizon rows of the five quantiles. */
function forecast(m: CaseMarket, horizon: number): number[][] {
  if (m.prices.length === 0) throw new Error(`market ${m.id} has no prices`);
  const x = m.prices[m.prices.length - 1] as number;
  const sigma = sigmaOf(m.prices);
  const rows: number[][] = [];
  for (let h = 1; h <= horizon; h++) {
    const spread = sigma * Math.pow(h, GAMMA);
    const row = Z.map((z) => price6(x + z * spread));
    // Rounding/clamping cannot break monotonicity here (z is increasing),
    // but enforce it so the output is valid by construction.
    for (let j = 1; j < row.length; j++) {
      if ((row[j] as number) < (row[j - 1] as number)) row[j] = row[j - 1] as number;
    }
    rows.push(row);
  }
  return rows;
}

mkdirSync(OUTPUT_DIR, { recursive: true });
// Every case file, in name order, so two runs write the same bytes.
const inputs = readdirSync(INPUT_DIR).filter((f) => f.endsWith('.in')).sort();
for (const file of inputs) {
  const id = file.slice(0, -'.in'.length);
  const c = JSON.parse(readFileSync(join(INPUT_DIR, file), 'utf8')) as Case;
  if (c.quantiles.length !== QUANTILES.length || c.quantiles.some((t, j) => t !== QUANTILES[j])) throw new Error(`${file} asks for quantiles ${JSON.stringify(c.quantiles)}, not ${JSON.stringify(QUANTILES)}`);
  const forecasts = c.markets.map((m) => ({ id: m.id, q: forecast(m, c.horizon_minutes) }));
  writeFileSync(join(OUTPUT_DIR, `${id}.out`), `${JSON.stringify({ forecasts })}\n`);
}
