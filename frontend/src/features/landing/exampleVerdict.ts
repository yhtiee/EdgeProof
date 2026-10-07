/**
 * The hero's example verdict. Every number on the panel is computed here
 * from a fixed set of 54 example validation trades (in R), so the page never
 * shows a figure it didn't calculate. It is labelled as an example on the page.
 */

export const EXAMPLE_TRADES_R = [
  -1, 2.1, -1.02, -1.05, 1.8, -0.62, -1, 2, -1.1, -0.98, 1.6, -1, -1.02, 2.2, -1.05, -0.62, 1.9, -1, -1.1, 0.9, 0.05,
  -0.98, 2, -1, -1.02, 1.7, -1.05, -0.62, 2.1, -1, -1.1, 1.5, -0.98, -1, 2, -1.02, -1.05, 1.2, -0.62, -1, 1.9, -0.04,
  -1.1, 2, -0.98, -1, 1.8, -1.02, -1.05, 1.4, -0.62, -1, -1.1, -0.98,
]

export const RESAMPLES = 10_000
const SEED = 20261007
/** A trade with |R| under 0.1 is a breakeven (spec §8). */
const BREAKEVEN = 0.1

/** Small seeded PRNG so the page renders the same numbers every time. */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type ExampleVerdict = {
  trades: number
  expectancy: number
  profitFactor: number
  low: number
  high: number
  /** Resampled means in the order they were drawn (for the animation). */
  resampled: Float64Array
}

export function computeExampleVerdict(trades = EXAMPLE_TRADES_R): ExampleVerdict {
  const n = trades.length
  const expectancy = trades.reduce((s, r) => s + r, 0) / n
  const won = trades.filter((r) => r >= BREAKEVEN).reduce((s, r) => s + r, 0)
  const lost = trades.filter((r) => r <= -BREAKEVEN).reduce((s, r) => s + r, 0)

  const rand = mulberry32(SEED)
  const resampled = new Float64Array(RESAMPLES)
  for (let k = 0; k < RESAMPLES; k++) {
    let sum = 0
    for (let i = 0; i < n; i++) sum += trades[Math.floor(rand() * n)]
    resampled[k] = sum / n
  }
  const sorted = Float64Array.from(resampled).sort()
  return {
    trades: n,
    expectancy,
    profitFactor: won / Math.abs(lost),
    low: sorted[Math.floor(RESAMPLES * 0.05) - 1],
    high: sorted[Math.floor(RESAMPLES * 0.95) - 1],
    resampled,
  }
}
