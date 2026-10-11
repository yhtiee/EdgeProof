/**
 * Maths for the expectancy and drawdown simulators (AC-2). Pure functions so
 * the simulators and their tests share one source.
 */

/** Expectancy per trade in R: p × avgWin − (1 − p) × avgLoss. */
export function expectancy({ winRatePct, avgWinR, avgLossR }: { winRatePct: number; avgWinR: number; avgLossR: number }) {
  const p = winRatePct / 100
  const perTrade = p * avgWinR - (1 - p) * avgLossR
  // The win rate at which this win/loss size pair breaks even.
  const breakevenWinRatePct = (avgLossR / (avgWinR + avgLossR)) * 100
  return { perTrade, per100: perTrade * 100, breakevenWinRatePct }
}

/** Drawdown after a losing streak at a fixed % risk, and the gain needed to recover. */
export function drawdown({ riskPct, losses }: { riskPct: number; losses: number }) {
  const remaining = Math.pow(1 - riskPct / 100, losses)
  const drawdownPct = (1 - remaining) * 100
  const recoveryPct = remaining > 0 ? (1 / remaining - 1) * 100 : Infinity
  return { drawdownPct, recoveryPct, simpleSumPct: riskPct * losses }
}
