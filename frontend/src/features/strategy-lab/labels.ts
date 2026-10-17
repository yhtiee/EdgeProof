import type { StepKey, Timeframe } from './types'

/** Plain-language labels for every option value in the builder. */
export const OPTION: Record<string, string> = {
  sma: 'Simple (SMA)', ema: 'Exponential (EMA)',
  above: 'Above', below: 'Below', crosses_above: 'Crosses above', crosses_below: 'Crosses below',
  bullish: 'Crosses up', bearish: 'Crosses down',
  higher_highs_lows: 'Higher highs and higher lows', lower_highs_lows: 'Lower highs and lower lows',
  break_up: 'Closes above the last swing high', break_down: 'Closes below the last swing low',
  prior_day_high: "Yesterday's high", prior_day_low: "Yesterday's low", prior_week_high: "Last week's high",
  prior_week_low: "Last week's low", swing_high: 'Latest swing high', swing_low: 'Latest swing low', round_number: 'Round number (…00)',
  within: 'Comes within', closes_above: 'Closes above', closes_below: 'Closes below', beyond: 'Is more than',
  bullish_engulfing: 'Bullish engulfing', bearish_engulfing: 'Bearish engulfing', bullish_pin_bar: 'Bullish pin bar',
  bearish_pin_bar: 'Bearish pin bar', inside_bar: 'Inside bar',
  line_above_signal: 'Line above signal line', line_below_signal: 'Line below signal line',
  crosses_above_signal: 'Line crosses above signal line', crosses_below_signal: 'Line crosses below signal line',
  histogram_above_zero: 'Histogram above zero', histogram_below_zero: 'Histogram below zero',
  ma: 'A moving average', range: 'Range (high to low)', body: 'Body (open to close)', pips: 'Pips', atr: '× ATR(14)',
  'Europe/London': 'London time', 'America/New_York': 'New York time', 'Asia/Tokyo': 'Tokyo time', UTC: 'UTC',
  next_open: 'At the next candle’s open (market order)', stop_beyond_setup: 'Stop order beyond the setup candle',
  limit_at_ma: 'Limit order at a moving average', limit_retrace: 'Limit order at part of the setup candle',
  swing: 'Beyond the latest swing', setup_candle: 'Beyond the setup candle', fixed: 'Fixed distance in pips',
  r_multiple: 'A multiple of the risk (R)', prior_swing: 'The previous swing', prior_day_level: 'Yesterday’s high (or low for sells)',
  none: 'No fixed target', bars: 'After a number of candles', time: 'At a set time', before_weekend: 'Before the weekend',
  stop_day: 'Stop for the day', halve_risk: 'Halve the risk per trade', stop_review: 'Stop and review',
  long: 'Buys only', short: 'Sells only', both: 'Both (sells mirror buys)',
}

export const PARAM_LABEL: Record<string, string> = {
  ma: 'Average type', period: 'Period', relation: 'Relation', fast: 'Fast period', slow: 'Slow period',
  direction: 'Direction', within_bars: 'Within the last … candles', pattern: 'Pattern', strength: 'Swing strength (candles each side)',
  level: 'Level', event: 'What happens', tolerance: 'Tolerance', ratio: 'Body at least … × previous body',
  wick_ratio: 'Wick at least … × body', min_range_atr: 'Range at least … × ATR(14)', value: 'Value', signal: 'Signal period',
  to: 'Measured to', unit: 'Unit', from: 'From', zone: 'Time zone', days: 'Days', measure: 'Measure',
  buffer: 'Buffer', expiry_bars: 'Cancel after … candles', percent: '% of the setup candle’s range', multiple: 'ATR multiple',
  pips: 'Stop distance (pips)', r: 'Target (R)', at_r: 'At (R)', bars: 'Candles',
}

export const TF_LABEL: Record<Timeframe, string> = {
  M5: '5 min', M15: '15 min', M30: '30 min', H1: '1 hour', H4: '4 hours', D1: 'Daily', W1: 'Weekly',
}
export const SESSION_LABEL: Record<string, string> = { asia: 'Asia', london: 'London', new_york: 'New York' }
export const DAY_LABEL: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri' }

export const STEPS: { key: StepKey | 'check'; title: string; why: string }[] = [
  { key: 'name', title: 'Name and idea', why: 'The idea is for you. The rules come next, in parts a computer could follow.' },
  { key: 'market', title: 'Market', why: 'Which pairs, which charts and which hours. Fewer pairs are easier to test.' },
  { key: 'setup', title: 'Setup', why: 'Everything that must be true before a trade. All conditions must be true at once.' },
  { key: 'entry', title: 'Entry', why: 'How the trade opens once the setup is true.' },
  { key: 'stop', title: 'Stop', why: 'Where the trade is wrong. It’s set before entry and never moved further away.' },
  { key: 'exit', title: 'Exit', why: 'How winning trades close. Management rules change your results, so they’re part of the test.' },
  { key: 'risk', title: 'Risk', why: 'Limits you set while calm, for when you aren’t.' },
  { key: 'costs', title: 'Costs', why: 'Spread, commission, slippage and swap for each pair. Tests without costs show results no account gets.' },
  { key: 'no_trade', title: 'No-trade rules', why: 'Times and conditions when no new trade opens.' },
  { key: 'examples', title: 'Examples', why: 'One chart where each condition is true and one where it’s false, so the rule means the same thing every time.' },
  { key: 'check', title: 'Check', why: 'Every check, in one list. When they all pass, this version can be locked for testing.' },
]
export const STEP_INDEX = Object.fromEntries(STEPS.map((s, i) => [s.key, i])) as Record<string, number>
