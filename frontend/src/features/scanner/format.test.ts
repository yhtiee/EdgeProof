import { describe, expect, it } from 'vitest'
import type { PairRow } from './api'
import { barGeometry, describeFactor, filterPairs, formatPeriod, formatPrint, formatScore, ordinal, parseStale, sortByBias } from './format'

describe('scanner format', () => {
  it('formats scores with a real minus and one decimal', () => {
    expect(formatScore(6.24)).toBe('+6.2')
    expect(formatScore(-5.75)).toBe('−5.8')
    expect(formatScore(-0.01)).toBe('0.0')
    expect(formatScore(null)).toBe('—')
  })

  it('draws the diverging bar from zero', () => {
    expect(barGeometry(5)).toEqual({ left: 50, width: 25 })
    expect(barGeometry(-10)).toEqual({ left: 0, width: 50 })
    expect(barGeometry(14)).toEqual({ left: 50, width: 50 })
  })

  it('names periods by frequency', () => {
    expect(formatPeriod('2026-04-01', 'Q')).toBe('Q2 2026')
    expect(formatPeriod('2026-08-01', 'M')).toBe('Aug 2026')
    expect(formatPeriod('2026-10-13', 'W')).toBe('13 Oct 2026')
  })

  it('describes raw factor values in words', () => {
    const v = (raw: number | null, detail: Record<string, unknown>) => ({ score: 1, raw, stale: false, detail, source: '' })
    expect(describeFactor('inflation', v(3.3, { target: 2, rising: true }))).toBe('3.3% vs 2.0% target, rising')
    expect(describeFactor('labour', v(-0.2, { rate: 4.1 }))).toBe('4.1% unemployment, −0.2 pts in 3 months')
    expect(describeFactor('trend', v(1.3, { above_20: true, above_50: false, above_200: true, slope_50_up: false }))).toBe('2 of 4 trend signals up')
    expect(describeFactor('retail', v(41, { sample: 24017 }))).toBe('41% of retail traders long · 24,017 traders')
    expect(describeFactor('cot', { score: null, raw: null, stale: false, detail: { reason: 'fewer than 10 weekly reports' }, source: '' })).toBe(
      'fewer than 10 weekly reports',
    )
  })

  it('writes ordinals', () => {
    expect(['1', '2', '3', '11', '12', '74', '100'].map((n) => ordinal(Number(n)))).toEqual(['1st', '2nd', '3rd', '11th', '12th', '74th', '100th'])
  })

  it('orders pairs from Very Bullish to Very Bearish, unscored last', () => {
    const row = (symbol: string, score: number | null) => ({ symbol, score }) as PairRow
    expect(sortByBias([row('A', -7), row('B', null), row('C', 2.5), row('D', 6.1), row('E', -3)]).map((p) => p.symbol)).toEqual(['D', 'C', 'E', 'A', 'B'])
  })

  it('formats official prints in their own units', () => {
    const p = (value: number, extra = {}) => ({ period: '2026-10-13', freq: 'W', value, released: '2026-10-16', estimated_release: false, ...extra })
    expect(formatPrint('cot', p(-106964, { long: 44185, short: 151149 }))).toEqual({ value: 'Net short 106,964', note: '44,185 long · 151,149 short contracts' })
    expect(formatPrint('rates', p(3.75, { change: -0.25 }))).toEqual({ value: '3.75%', note: 'Cut by 0.25 points' })
    expect(formatPrint('growth', p(-0.1)).value).toBe('−0.10%')
    expect(formatPrint('business', p(101.4)).note).toBe('above the long-run average')
  })

  it('splits stale entries', () => {
    expect(parseStale('JPY:inflation')).toEqual({ subject: 'JPY', factor: 'inflation' })
  })

  it('filters pairs by label, currency and strength', () => {
    const row = (symbol: string, label: PairRow['label']): PairRow => ({
      symbol, base: symbol.slice(0, 3), quote: symbol.slice(3), score: 0, label, label_text: '', rank: 1, change_wow: 0, agreement: null, stale_factors: [],
    })
    const rows = [row('EURUSD', 'very_bearish'), row('USDJPY', 'bullish'), row('GBPCHF', 'neutral')]
    expect(filterPairs(rows, { label: '', currency: 'USD', strong: false }).map((p) => p.symbol)).toEqual(['EURUSD', 'USDJPY'])
    expect(filterPairs(rows, { label: '', currency: '', strong: true }).map((p) => p.symbol)).toEqual(['EURUSD'])
    expect(filterPairs(rows, { label: 'neutral', currency: '', strong: false }).map((p) => p.symbol)).toEqual(['GBPCHF'])
  })
})
