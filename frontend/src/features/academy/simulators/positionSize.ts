/**
 * Position-size maths for the Level 1 simulator (AC-2).
 * Pure functions so the simulator and its tests share one source.
 *
 * Simplification for teaching: the account is in USD and the pair is quoted
 * in USD (EUR/USD, GBP/USD), so one pip on one standard lot is worth $10.
 */
export const PIP_VALUE_PER_LOT_USD = 10

export type PositionSizeInput = {
  balance: number
  riskPct: number
  stopPips: number
}

export type PositionSizeResult = {
  riskAmount: number
  /** Exact lots before rounding to what a broker accepts. */
  lotsExact: number
  /** Rounded down to 0.01 lots (a micro lot) so risk never exceeds the plan. */
  lots: number
  /** Risk actually taken after rounding. */
  actualRisk: number
  actualRiskPct: number
}

export function positionSize({ balance, riskPct, stopPips }: PositionSizeInput): PositionSizeResult | null {
  if (!(balance > 0) || !(riskPct > 0) || !(stopPips > 0)) return null
  const riskAmount = (balance * riskPct) / 100
  const lotsExact = riskAmount / (stopPips * PIP_VALUE_PER_LOT_USD)
  const lots = Math.floor(lotsExact * 100 + 1e-9) / 100
  const actualRisk = lots * stopPips * PIP_VALUE_PER_LOT_USD
  return { riskAmount, lotsExact, lots, actualRisk, actualRiskPct: (actualRisk / balance) * 100 }
}
