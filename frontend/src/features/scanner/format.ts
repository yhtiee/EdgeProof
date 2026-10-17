import type { Factor, FactorValue, Label, PairRow, Print } from './api'

/** Display helpers for the scanner. Pure, so they're unit-tested. */

const MINUS = '−'

/** "+6.2", "−3.1", "0.0" or "—". Real minus sign, one decimal (spec examples). */
export function formatScore(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined) return '—'
  const s = Math.abs(n).toFixed(digits)
  if (Number(s) === 0) return (0).toFixed(digits)
  return `${n > 0 ? '+' : MINUS}${s}`
}

/**
 * The diverging bar: where the fill starts and how wide it is, as percentages of a
 * −limit…+limit track with zero in the middle.
 */
export function barGeometry(score: number, limit = 10): { left: number; width: number } {
  const v = Math.max(-limit, Math.min(limit, score))
  const half = (Math.abs(v) / limit) * 50
  return v >= 0 ? { left: 50, width: half } : { left: 50 - half, width: half }
}

export const LABEL_ORDER: Exclude<Label, 'insufficient'>[] = ['very_bullish', 'bullish', 'neutral', 'bearish', 'very_bearish']

export const LABEL_TEXT: Record<Label, string> = {
  very_bullish: 'Very Bullish',
  bullish: 'Bullish',
  neutral: 'Neutral',
  bearish: 'Bearish',
  very_bearish: 'Very Bearish',
  insufficient: 'Insufficient data',
}

/** Score bands, matching the server's label rules (≥6, ≥2, >−2, >−6). */
export const BANDS: { label: Exclude<Label, 'insufficient'>; from: number; to: number }[] = [
  { label: 'very_bullish', from: 6, to: 10 },
  { label: 'bullish', from: 2, to: 6 },
  { label: 'neutral', from: -2, to: 2 },
  { label: 'bearish', from: -6, to: -2 },
  { label: 'very_bearish', from: -10, to: -6 },
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** The period a value describes: "Aug 2026", "Q2 2026" or "13 Oct 2026". */
export function formatPeriod(iso: string | undefined, freq: string | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  if (freq === 'Q') return `Q${Math.floor((m - 1) / 3) + 1} ${y}`
  if (freq === 'M') return `${MONTHS[m - 1]} ${y}`
  return `${d} ${MONTHS[m - 1]} ${y}`
}

export function formatDate(iso: string | null | undefined): string {
  return iso ? formatPeriod(iso.slice(0, 10), 'D') : '—'
}

const num = (v: unknown) => (typeof v === 'number' ? v : null)
const fixed = (v: unknown, digits = 1) => (num(v) === null ? '—' : (v as number).toFixed(digits).replace('-', MINUS))

/** The raw value behind a factor score, in words a learner can check against the source. */
export function describeFactor(factor: Factor, f: FactorValue | undefined): string {
  if (!f || (f.raw === null && f.score === null)) return (f?.detail.reason as string | undefined) ?? 'No data'
  const d = f.detail
  switch (factor) {
    case 'cot':
      return `${ordinal(Math.round(num(d.percentile) ?? 0))} percentile of ${d.weeks ?? 52} weeks`
    case 'rates':
      return `${fixed(d.rate, 2)}% · ${d.cycle ?? ''}`.trim()
    case 'inflation':
      return `${fixed(f.raw)}% vs ${fixed(d.target)}% target, ${d.rising ? 'rising' : 'falling'}`
    case 'growth':
      return `${fixed(f.raw, 2)}% a quarter (2-quarter average)`
    case 'labour': {
      const change = num(f.raw) ?? 0
      return `${fixed(d.rate)}% unemployment, ${change > 0 ? '+' : change < 0 ? MINUS : '±'}${Math.abs(change).toFixed(1)} pts in 3 months`
    }
    case 'business':
      return `${fixed(f.raw)} and ${d.rising ? 'rising' : 'falling'}`
    case 'trend': {
      const up = ['above_20', 'above_50', 'above_200', 'slope_50_up'].filter((k) => d[k] === true).length
      return `${up} of 4 trend signals up`
    }
    case 'retail': {
      const sample = num(d.sample)
      return `${fixed(f.raw, 0)}% of retail traders long${sample !== null ? ` · ${sample.toLocaleString('en-GB')} traders` : ''}`
    }
  }
}

/** 1st, 2nd, 3rd, 11th, 74th. */
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13
  const suffix = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'
  return `${n}${suffix}`
}

/** "EUR:inflation" → { subject: "EUR", factor: "inflation" }. */
export function parseStale(entry: string) {
  const [subject, factor] = entry.split(':')
  return { subject, factor: factor as Factor }
}

/**
 * Bias order: Very Bullish at the top down to Very Bearish, highest score first,
 * so the labels read as bands. Unscored pairs go last.
 */
export function sortByBias(pairs: PairRow[]): PairRow[] {
  return [...pairs].sort((a, b) => (a.score === null ? 1 : 0) - (b.score === null ? 1 : 0) || (b.score ?? 0) - (a.score ?? 0) || a.symbol.localeCompare(b.symbol))
}

/** Pair filters for the rankings: label, either currency, and strong labels only. */
export function filterPairs(pairs: PairRow[], { label, currency, strong }: { label: string; currency: string; strong: boolean }) {
  return pairs.filter(
    (p) =>
      (!label || p.label === label) &&
      (!currency || p.base === currency || p.quote === currency) &&
      (!strong || p.label === 'very_bullish' || p.label === 'very_bearish'),
  )
}

const grouped = (n: number) => Math.round(Math.abs(n)).toLocaleString('en-GB')

/** One official print in the evidence list: the value in its own units, and what changed. */
export function formatPrint(factor: Factor, p: Print): { value: string; note?: string } {
  const v = p.value
  switch (factor) {
    case 'cot':
      return {
        value: `${v >= 0 ? 'Net long' : 'Net short'} ${grouped(v)}`,
        note: p.long != null && p.short != null ? `${grouped(p.long)} long · ${grouped(p.short)} short contracts` : undefined,
      }
    case 'rates':
      return {
        value: `${v.toFixed(2)}%`,
        note: p.change ? `${p.change > 0 ? 'Raised' : 'Cut'} by ${Math.abs(p.change).toFixed(2)} points` : p.change === null ? 'Earliest in our data' : undefined,
      }
    case 'growth':
      return { value: `${v > 0 ? '+' : v < 0 ? MINUS : ''}${Math.abs(v).toFixed(2)}%`, note: 'on the quarter before' }
    case 'inflation':
    case 'labour':
      return { value: `${v.toFixed(1)}%` }
    case 'business':
      return { value: v.toFixed(1), note: v > 100 ? 'above the long-run average' : v < 100 ? 'below the long-run average' : undefined }
    case 'trend':
      return { value: v.toFixed(v >= 20 ? 3 : 5) }
    case 'retail':
      return { value: `${v.toFixed(0)}% long`, note: p.sample != null ? `${p.sample.toLocaleString('en-GB')} traders` : undefined }
  }
}
