import type { Condition } from './types'

/**
 * Short-side mirror of a long-side rule (rulebook-builder.md §2.1): above ↔
 * below, bullish ↔ bearish, high ↔ low, threshold x ↔ 100 − x for RSI.
 * Mirroring twice gives the original rule back.
 */
const SWAP: Record<string, string> = {
  above: 'below', below: 'above',
  crosses_above: 'crosses_below', crosses_below: 'crosses_above',
  bullish: 'bearish', bearish: 'bullish',
  higher_highs_lows: 'lower_highs_lows', lower_highs_lows: 'higher_highs_lows',
  break_up: 'break_down', break_down: 'break_up',
  prior_day_high: 'prior_day_low', prior_day_low: 'prior_day_high',
  prior_week_high: 'prior_week_low', prior_week_low: 'prior_week_high',
  swing_high: 'swing_low', swing_low: 'swing_high',
  closes_above: 'closes_below', closes_below: 'closes_above',
  bullish_engulfing: 'bearish_engulfing', bearish_engulfing: 'bullish_engulfing',
  bullish_pin_bar: 'bearish_pin_bar', bearish_pin_bar: 'bullish_pin_bar',
  line_above_signal: 'line_below_signal', line_below_signal: 'line_above_signal',
  crosses_above_signal: 'crosses_below_signal', crosses_below_signal: 'crosses_above_signal',
  histogram_above_zero: 'histogram_below_zero', histogram_below_zero: 'histogram_above_zero',
}
// Keys whose values describe direction. Volatility and size relations don't flip.
const DIRECTIONAL: Partial<Record<Condition['type'], string[]>> = {
  price_vs_ma: ['relation'],
  ma_cross: ['direction'],
  ma_order: ['relation'],
  structure: ['pattern'],
  level: ['level', 'event'],
  candle_pattern: ['pattern'],
  rsi: ['relation'],
  macd: ['event'],
  distance: ['to'],
}

export function mirror(c: Condition): Condition {
  const keys = DIRECTIONAL[c.type]
  if (!keys) return c
  const params = { ...c.params }
  for (const k of keys) {
    const v = params[k]
    if (typeof v === 'string' && SWAP[v]) params[k] = SWAP[v]
  }
  if (c.type === 'rsi' && typeof params.value === 'number') params.value = 100 - params.value
  return { ...c, params }
}

/** Whether a rule reads differently for shorts (time windows and volatility filters don't). */
export const isDirectional = (c: Condition) => {
  const m = mirror(c)
  return JSON.stringify(m.params) !== JSON.stringify(c.params)
}
