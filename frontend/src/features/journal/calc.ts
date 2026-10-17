/**
 * Live trade maths for the form and for trades still waiting to sync.
 * Mirrors apps/testing/services.derive on the server, which stays the
 * source of truth: R = net P&L ÷ initial risk, both in account currency
 * (JR-4). Money is computed from prices only when the pair's quote currency
 * is the account currency; otherwise the trader enters it.
 */
export const CONTRACT_SIZE = 100_000
export const BREAKEVEN_R = 0.1

export type Side = 'buy' | 'sell'

export type CalcInput = {
  instrument: string
  side: Side
  entry: number | null
  stop: number | null
  exit: number | null
  size: number | null // lots
  accountCurrency: string
  riskCcy?: number | null // entered when the quote currency differs
  grossPnl?: number | null
  fees?: number | null
  swap?: number | null
  balance?: number | null
}

export type CalcResult = {
  sameCurrency: boolean
  stopError: string | null
  stopPips: number | null
  riskCcy: number | null
  riskPct: number | null
  grossPnl: number | null
  pnl: number | null
  r: number | null
  rEstimated: boolean
  outcome: 'open' | 'win' | 'loss' | 'breakeven'
}

export const quoteCurrency = (instrument: string) => instrument.replace('/', '').slice(-3).toUpperCase()
export const pipSize = (instrument: string) => (quoteCurrency(instrument) === 'JPY' ? 0.01 : 0.0001)

const round2 = (n: number) => Math.round(n * 100) / 100

export function calcTrade(i: CalcInput): CalcResult {
  const d = i.side === 'buy' ? 1 : -1
  const sameCurrency = !!i.instrument && quoteCurrency(i.instrument) === i.accountCurrency.toUpperCase()
  const units = (i.size ?? 0) * CONTRACT_SIZE
  const fees = i.fees ?? 0
  const swap = i.swap ?? 0

  let stopError: string | null = null
  let stopPips: number | null = null
  let riskCcy: number | null = sameCurrency ? null : (i.riskCcy ?? null)
  if (i.entry !== null && i.stop !== null) {
    const distance = (i.entry - i.stop) * d
    if (distance <= 0) stopError = `For a ${i.side}, the stop goes ${d === 1 ? 'below' : 'above'} the entry.`
    else {
      stopPips = distance / pipSize(i.instrument)
      if (sameCurrency && units) riskCcy = round2(distance * units)
    }
  }

  let grossPnl: number | null = sameCurrency ? null : (i.grossPnl ?? null)
  let pnl: number | null = null
  let r: number | null = null
  let rEstimated = false
  if (i.exit !== null && i.entry !== null) {
    const move = (i.exit - i.entry) * d
    if (sameCurrency && units) grossPnl = round2(move * units)
    if (grossPnl !== null) pnl = round2(grossPnl - fees + swap)
    if (pnl !== null && riskCcy) r = pnl / riskCcy
    else if (i.stop !== null && !stopError) {
      r = move / ((i.entry - i.stop) * d)
      rEstimated = true
    }
  }

  let outcome: CalcResult['outcome'] = 'open'
  if (i.exit !== null) {
    const v = r ?? pnl ?? 0
    const threshold = r !== null ? BREAKEVEN_R : 0
    outcome = v === 0 || Math.abs(v) < threshold ? 'breakeven' : v > 0 ? 'win' : 'loss'
  }

  const riskPct = riskCcy !== null && i.balance ? (riskCcy / i.balance) * 100 : null
  return { sameCurrency, stopError, stopPips, riskCcy, riskPct, grossPnl, pnl, r, rEstimated, outcome }
}

/** Lots that risk a given amount, when the money can be computed from prices. */
export function sizeForRisk(entry: number, stop: number, riskCcy: number): number | null {
  const distance = Math.abs(entry - stop)
  if (!distance || !riskCcy) return null
  // Round down to 0.01 lots; the epsilon absorbs float error (0.005 is stored as 0.0050000000000000044).
  return Math.floor((riskCcy / (distance * CONTRACT_SIZE)) * 100 + 1e-9) / 100
}
