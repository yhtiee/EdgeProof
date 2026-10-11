/**
 * Maths for the Level 1–7 simulators. Pure functions shared with tests.
 * Pip values assume a USD account and a USD-quoted pair ($10 per pip per
 * standard lot), which is how the lessons introduce them.
 */

export const PIP_VALUE_USD = 10

/** Seeded PRNG so a simulation can be replayed. */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Leverage and margin (L1). */
export function leverageMargin({ balance, leverage, positionValue }: { balance: number; leverage: number; positionValue: number }) {
  const margin = positionValue / leverage
  const effectiveLeverage = positionValue / balance
  // % adverse move that loses the whole balance
  const wipeMovePct = (balance / positionValue) * 100
  // % adverse move until equity = 50% of margin (ESMA/FCA close-out level)
  const closeOutMovePct = Math.max(0, ((balance - margin * 0.5) / positionValue) * 100)
  return { margin, marginPctOfBalance: (margin / balance) * 100, effectiveLeverage, wipeMovePct, closeOutMovePct, canOpen: margin <= balance }
}

/** Pip value and profit or loss (L1). */
export function pipMoney({ lots, pips }: { lots: number; pips: number }) {
  const perPip = lots * PIP_VALUE_USD
  return { perPip, money: perPip * pips, units: lots * 100_000 }
}

/** Cost of a round trip, in money and as a share of the risk (R). */
export function tradingCost({ spreadPips, commissionPerLot, slippagePips, stopPips }: { spreadPips: number; commissionPerLot: number; slippagePips: number; stopPips: number }) {
  const costPerLot = (spreadPips + slippagePips) * PIP_VALUE_USD + commissionPerLot
  const riskPerLot = stopPips * PIP_VALUE_USD
  return { costPerLot, costInR: costPerLot / riskPerLot, costPips: costPerLot / PIP_VALUE_USD }
}

/** Overnight swap, with the Wednesday triple charge. */
export function swapTotal({ perLotPerNight, lots, nights, wednesdays }: { perLotPerNight: number; lots: number; nights: number; wednesdays: number }) {
  const chargedNights = nights + 2 * Math.min(wednesdays, nights)
  return { chargedNights, total: perLotPerNight * lots * chargedNights }
}

/** Equity curves (in R) of a strategy with a known edge, by chance alone. */
export function equityCurves({ seed, curves, trades, winRate, winR }: { seed: number; curves: number; trades: number; winRate: number; winR: number }) {
  const rand = rng(seed)
  return Array.from({ length: curves }, () => {
    let r = 0
    const path = [0]
    for (let i = 0; i < trades; i++) {
      r += rand() < winRate ? winR : -1
      path.push(r)
    }
    return path
  })
}

/** 90% range for measured expectancy after n trades (normal approximation). */
export function expectancyRange({ winRate, winR, trades }: { winRate: number; winR: number; trades: number }) {
  const mean = winRate * winR - (1 - winRate)
  const sd = Math.sqrt(winRate * (1 - winRate)) * (winR + 1)
  const half = (1.645 * sd) / Math.sqrt(trades)
  return { mean, low: mean - half, high: mean + half, sd }
}

/** Monte Carlo chance of a drawdown at least `ruinPct` deep within `trades` trades. */
export function riskOfRuin({ riskPct, winRate, winR, trades, ruinPct, paths = 2000, seed = 7 }: { riskPct: number; winRate: number; winR: number; trades: number; ruinPct: number; paths?: number; seed?: number }) {
  const rand = rng(seed)
  const r = riskPct / 100
  let ruined = 0
  for (let p = 0; p < paths; p++) {
    let equity = 1
    let peak = 1
    for (let t = 0; t < trades; t++) {
      equity *= rand() < winRate ? 1 + r * winR : 1 - r
      if (equity > peak) peak = equity
      if (1 - equity / peak >= ruinPct / 100) {
        ruined++
        break
      }
    }
  }
  return { probability: ruined / paths }
}

/** Compounding a fixed monthly return. */
export function compound({ monthlyPct, months, start }: { monthlyPct: number; months: number; start: number }) {
  const multiple = Math.pow(1 + monthlyPct / 100, months)
  return { multiple, end: start * multiple, yearlyPct: (Math.pow(1 + monthlyPct / 100, 12) - 1) * 100 }
}

/** A stop that gaps: the loss in R when price opens beyond the stop. */
export function gapLoss({ stopPips, gapBeyondPips }: { stopPips: number; gapBeyondPips: number }) {
  return { lossR: (stopPips + gapBeyondPips) / stopPips, filledPipsAway: stopPips + gapBeyondPips }
}

/** Simple moving average; null until enough data. */
export function sma(values: number[], period: number): (number | null)[] {
  let sum = 0
  return values.map((v, i) => {
    sum += v
    if (i >= period) sum -= values[i - period]
    return i >= period - 1 ? sum / period : null
  })
}

/** A seeded random-walk price series for chart demos. */
export function priceSeries(seed: number, n: number, start = 1.08, step = 0.0012) {
  const rand = rng(seed)
  const out = [start]
  for (let i = 1; i < n; i++) out.push(out[i - 1] + (rand() - 0.5) * 2 * step + (i > n * 0.35 && i < n * 0.7 ? step * 0.35 : 0))
  return out
}

export type Position = { pair: string; side: 'buy' | 'sell'; riskPct: number }

/**
 * Risk per currency (L7): buying EUR/USD is long EUR and short USD. Each
 * position's risk is attributed to both of its currencies.
 */
export function currencyExposure(positions: Position[]) {
  const exp: Record<string, number> = {}
  for (const p of positions) {
    const [base, quote] = p.pair.split('/')
    const sign = p.side === 'buy' ? 1 : -1
    exp[base] = (exp[base] ?? 0) + sign * p.riskPct
    exp[quote] = (exp[quote] ?? 0) - sign * p.riskPct
  }
  return exp
}

/**
 * Overfitting (L6): try `tries` strategies with NO edge, each tested on
 * `trades` in-sample trades; keep the best, then test it on fresh data.
 */
export function overfit({ tries, trades, seed }: { tries: number; trades: number; seed: number }) {
  const rand = rng(seed)
  const trade = () => (rand() < 0.5 ? 1 : -1) // zero edge, ±1R
  let best = -Infinity
  for (let s = 0; s < tries; s++) {
    let sum = 0
    for (let t = 0; t < trades; t++) sum += trade()
    best = Math.max(best, sum / trades)
  }
  let oos = 0
  for (let t = 0; t < trades; t++) oos += trade()
  return { bestInSample: best, outOfSample: oos / trades }
}
