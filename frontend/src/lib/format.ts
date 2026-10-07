/**
 * One place for number formatting (DESIGN.md §2, §13): explicit signs,
 * a true minus sign (U+2212), units always attached.
 */

export const MINUS = '−'

function signed(value: number, digits: number, forceSign: boolean): string {
  const abs = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  // Avoid "−0.00": a value that rounds to zero carries no sign.
  if (Number(abs.replace(/,/g, '')) === 0) return abs
  if (value < 0) return `${MINUS}${abs}`
  return forceSign ? `+${abs}` : abs
}

/** R-multiple, always signed: +0.21R, −1.00R */
export function formatR(value: number, digits = 2): string {
  return `${signed(value, digits, true)}R`
}

/** Percentage. Signed only when it is a change: 2.4%, +1.3% */
export function formatPct(value: number, { digits = 1, signed: s = false } = {}): string {
  return `${signed(value, digits, s)}%`
}

const CURRENCY_SYMBOL: Record<string, string> = { NGN: '₦', USD: '$', GBP: '£', EUR: '€' }

/** Money: ₦25,000 · $150.00 · −$42.50 */
export function formatMoney(
  value: number,
  currency = 'USD',
  { digits, signed: s = false }: { digits?: number; signed?: boolean } = {},
): string {
  const symbol = CURRENCY_SYMBOL[currency] ?? `${currency} `
  const d = digits ?? (currency === 'NGN' ? 0 : 2)
  const body = signed(value, d, false)
  if (value < 0 && body.startsWith(MINUS)) return `${MINUS}${symbol}${body.slice(1)}`
  return `${s && value > 0 ? '+' : ''}${symbol}${body}`
}

/** Counts with units: "54 trades", "1 trade" */
export function formatCount(n: number, unit: string, plural = `${unit}s`): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? unit : plural}`
}

/** Tone for colouring a signed figure. Colour is never the only signal. */
export function tone(value: number): 'gain' | 'loss' | 'neutral' {
  if (value > 0) return 'gain'
  if (value < 0) return 'loss'
  return 'neutral'
}
