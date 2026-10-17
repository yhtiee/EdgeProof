import type { ConditionType, CostRow, Rules, RiskPlan, Session, Timeframe, VersionDoc, Weekday, Zone } from './types'

/**
 * The rulebook vocabulary, mirroring backend/apps/strategy/vocabulary.py:
 * blocks, parameter ranges, options and defaults. Labels and groups for the
 * builder live here too.
 */
export const TIMEFRAMES: Timeframe[] = ['M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1']
export const TF_RANK = Object.fromEntries(TIMEFRAMES.map((t, i) => [t, i])) as Record<Timeframe, number>
export const SESSIONS: Session[] = ['asia', 'london', 'new_york']
export const ZONES: Zone[] = ['Europe/London', 'America/New_York', 'Asia/Tokyo', 'UTC']
export const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri']
export const MAJORS = new Set(['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD'])
export const SESSION_HOURS: Record<Session, [number, number]> = { asia: [0, 9], london: [7, 16], new_york: [12, 21] }
export const ZONE_OFFSETS: Record<Zone, [number, number]> = {
  'Europe/London': [0, 1], 'America/New_York': [-5, -4], 'Asia/Tokyo': [9, 9], UTC: [0, 0],
}

export type Spec =
  | { kind: 'enum'; values: readonly string[] }
  | { kind: 'int' | 'num'; min: number; max: number }
  | { kind: 'distance' }
  | { kind: 'time' }
  | { kind: 'days' }
  | { kind: 'text'; min: number; max: number }

const e = (...values: string[]): Spec => ({ kind: 'enum', values })
const int = (min: number, max: number): Spec => ({ kind: 'int', min, max })
const num = (min: number, max: number): Spec => ({ kind: 'num', min, max })
const DIST: Spec = { kind: 'distance' }
const TIME: Spec = { kind: 'time' }
const MA = e('sma', 'ema')

export const DISTANCE_LIMITS = { pips: [0, 500], atr: [0, 10] } as const

export const CONDITIONS: Record<ConditionType, Record<string, Spec>> = {
  price_vs_ma: { ma: MA, period: int(2, 400), relation: e('above', 'below') },
  ma_cross: { ma: MA, fast: int(2, 200), slow: int(3, 400), direction: e('bullish', 'bearish'), within_bars: int(1, 20) },
  ma_order: { ma: MA, fast: int(2, 200), slow: int(3, 400), relation: e('above', 'below') },
  structure: { pattern: e('higher_highs_lows', 'lower_highs_lows', 'break_up', 'break_down'), strength: int(2, 10) },
  level: {
    level: e('prior_day_high', 'prior_day_low', 'prior_week_high', 'prior_week_low', 'swing_high', 'swing_low', 'round_number'),
    event: e('within', 'closes_above', 'closes_below'),
    tolerance: DIST,
    strength: int(2, 10),
  },
  candle_pattern: {
    pattern: e('bullish_engulfing', 'bearish_engulfing', 'bullish_pin_bar', 'bearish_pin_bar', 'inside_bar'),
    ratio: num(1, 2),
    wick_ratio: num(2, 5),
    min_range_atr: num(0.3, 2),
  },
  rsi: { period: int(2, 50), relation: e('above', 'below', 'crosses_above', 'crosses_below'), value: num(1, 99) },
  macd: {
    fast: int(2, 50), slow: int(3, 100), signal: int(2, 50),
    event: e('line_above_signal', 'line_below_signal', 'crosses_above_signal', 'crosses_below_signal', 'histogram_above_zero', 'histogram_below_zero'),
  },
  atr: { period: int(2, 50), relation: e('above', 'below'), value: num(0.1, 1000) },
  distance: {
    to: e('ma', 'prior_day_high', 'prior_day_low'), ma: MA, period: int(2, 400),
    relation: e('within', 'beyond'), unit: e('pips', 'atr'), value: num(0.1, 1000),
  },
  time_window: { from: TIME, to: TIME, zone: e(...ZONES), days: { kind: 'days' } },
  candle_size: { measure: e('range', 'body'), relation: e('above', 'below'), unit: e('pips', 'atr'), value: num(0.1, 1000) },
  free_text: { text: { kind: 'text', min: 15, max: 280 } },
}
export const OPTIONAL_PARAMS: Partial<Record<ConditionType, Set<string>>> = {
  level: new Set(['tolerance', 'strength']),
  candle_pattern: new Set(['ratio', 'wick_ratio', 'min_range_atr']),
  distance: new Set(['ma', 'period']),
}
export const NO_TRADE_OTHER_TYPES = new Set<ConditionType>(['time_window', 'free_text'])

export const ENTRY_TRIGGERS: Record<string, Record<string, Spec>> = {
  next_open: {},
  stop_beyond_setup: { buffer: DIST, expiry_bars: int(1, 10) },
  limit_at_ma: { ma: MA, period: int(2, 400), expiry_bars: int(1, 10) },
  limit_retrace: { percent: num(25, 75), expiry_bars: int(1, 10) },
}
export const STOP_RULES: Record<string, Record<string, Spec>> = {
  swing: { strength: int(2, 10), buffer: DIST },
  setup_candle: { buffer: DIST },
  atr: { period: int(2, 50), multiple: num(0.5, 5) },
  fixed: { pips: num(3, 500) },
}
export const TARGETS: Record<string, Record<string, Spec>> = {
  r_multiple: { r: num(0.5, 10) },
  prior_swing: { strength: int(2, 10) },
  prior_day_level: {},
  atr: { period: int(2, 50), multiple: num(0.5, 10) },
  none: {},
}
export const TRAILING: Record<string, Record<string, Spec>> = {
  atr: { period: int(2, 50), multiple: num(0.5, 10) },
  swing: { strength: int(2, 10) },
  ma: { ma: MA, period: int(2, 400) },
}
export const TIME_EXITS: Record<string, Record<string, Spec>> = {
  bars: { bars: int(1, 500) },
  time: { at: TIME, zone: e(...ZONES) },
  before_weekend: {},
}
export const BREAKEVEN = { at_r: num(0.5, 5) }
export const PARTIAL = { at_r: num(0.5, 5), percent: num(10, 90) }

export const RISK: Record<keyof Omit<RiskPlan, 'losing_streak'>, Spec> = {
  risk_pct: num(0.1, 2),
  daily_loss_r: num(1, 10),
  weekly_loss_r: num(1, 20),
  max_drawdown_r: num(5, 50),
  max_open_trades: int(1, 10),
  max_trades_per_day: int(1, 20),
  max_currency_risk_pct: num(0.5, 5),
}
export const STREAK_ACTIONS = ['stop_day', 'halve_risk', 'stop_review'] as const
export const COSTS: Record<keyof Omit<CostRow, 'placeholder'>, Spec> = {
  spread_pips: num(0, 50),
  commission_per_lot: num(0, 50),
  slippage_pips: num(0, 20),
  news_slippage_pips: num(0, 50),
  swap_long: num(-1000, 1000),
  swap_short: num(-1000, 1000),
}

export const DEFAULT_RISK: RiskPlan = {
  risk_pct: 0.5, daily_loss_r: 3, weekly_loss_r: 6, max_drawdown_r: 15, max_open_trades: 2,
  max_trades_per_day: 3, max_currency_risk_pct: 2, losing_streak: { losses: 3, action: 'stop_day' },
}

/** Round placeholders the trader replaces with their broker's figures. */
export function defaultCosts(pair: string): CostRow {
  const major = MAJORS.has(pair)
  return {
    spread_pips: major ? 1 : 2, commission_per_lot: 0, slippage_pips: major ? 0.3 : 1,
    news_slippage_pips: 3, swap_long: 0, swap_short: 0, placeholder: true,
  }
}

export function newDraft(): VersionDoc {
  const rules: Rules = {
    schemaVersion: 1,
    idea: '',
    direction: 'long',
    market: { instruments: [], timeframes: [], sessions: [] },
    setup: { conditions: [] },
    entry: null,
    stop: null,
    exit: null,
    no_trade: { news: { enabled: true, before_min: 30, after_min: 30 }, avoid_rollover: true, no_new_after_friday: '15:00', other: [] },
  }
  return { rules, risk_plan: structuredClone(DEFAULT_RISK), cost_model: {} }
}

/* ---- Builder metadata: groups, names and defaults for each block ---- */

export type BlockInfo = { type: ConditionType; name: string; group: string; keywords: string; defaults: Record<string, unknown> }

export const GROUPS = [
  { key: 'trend', name: 'Trend and averages', description: 'Moving averages: price above or below, crosses, order.' },
  { key: 'structure', name: 'Structure and levels', description: 'Swing highs and lows, breaks, prior-day and round-number levels.' },
  { key: 'candles', name: 'Candles', description: 'Engulfing, pin bar and inside bar, defined exactly.' },
  { key: 'momentum', name: 'Momentum', description: 'RSI and MACD thresholds and crosses.' },
  { key: 'volatility', name: 'Volatility and distance', description: 'ATR, candle size and distance from an average or level.' },
  { key: 'time', name: 'Time', description: 'A time window in a named time zone.' },
  { key: 'own', name: 'Write my own', description: 'A rule in your own words. It makes the strategy discretionary unless it becomes a building block.' },
] as const

export const BLOCKS: BlockInfo[] = [
  { type: 'price_vs_ma', name: 'Price above or below an average', group: 'trend', keywords: 'trend ema sma moving average', defaults: { ma: 'ema', period: 50, relation: 'above' } },
  { type: 'ma_cross', name: 'Moving average cross', group: 'trend', keywords: 'trend cross crossover golden', defaults: { ma: 'ema', fast: 20, slow: 50, direction: 'bullish', within_bars: 3 } },
  { type: 'ma_order', name: 'One average above another', group: 'trend', keywords: 'trend order stack', defaults: { ma: 'ema', fast: 50, slow: 200, relation: 'above' } },
  { type: 'structure', name: 'Swing structure', group: 'structure', keywords: 'trend higher highs lows break of structure swing', defaults: { pattern: 'higher_highs_lows', strength: 3 } },
  { type: 'level', name: 'Price level', group: 'structure', keywords: 'support resistance level prior day high low round number swing', defaults: { level: 'prior_day_low', event: 'within', tolerance: { unit: 'pips', value: 5 } } },
  { type: 'candle_pattern', name: 'Candle pattern', group: 'candles', keywords: 'engulfing pin bar inside bar candle pattern rejection', defaults: { pattern: 'bullish_engulfing', ratio: 1.2 } },
  { type: 'rsi', name: 'RSI', group: 'momentum', keywords: 'rsi momentum oversold overbought', defaults: { period: 14, relation: 'crosses_above', value: 30 } },
  { type: 'macd', name: 'MACD', group: 'momentum', keywords: 'macd momentum histogram', defaults: { fast: 12, slow: 26, signal: 9, event: 'crosses_above_signal' } },
  { type: 'atr', name: 'ATR (volatility)', group: 'volatility', keywords: 'atr volatility quiet busy range', defaults: { period: 14, relation: 'above', value: 8 } },
  { type: 'candle_size', name: 'Candle size', group: 'volatility', keywords: 'big small candle range body size', defaults: { measure: 'range', relation: 'above', unit: 'atr', value: 1.2 } },
  { type: 'distance', name: 'Distance from an average or level', group: 'volatility', keywords: 'pullback distance near far extended', defaults: { to: 'ma', ma: 'ema', period: 20, relation: 'within', unit: 'atr', value: 1 } },
  { type: 'time_window', name: 'Time window', group: 'time', keywords: 'time session open hours london new york', defaults: { from: '07:00', to: '10:00', zone: 'Europe/London', days: [...WEEKDAYS] } },
  { type: 'free_text', name: 'Rule in my own words', group: 'own', keywords: 'free text own words discretionary', defaults: { text: '' } },
]
export const BLOCK = Object.fromEntries(BLOCKS.map((b) => [b.type, b])) as Record<ConditionType, BlockInfo>

/** Pattern-specific defaults when the candle pattern changes. */
export const PATTERN_DEFAULTS: Record<string, Record<string, unknown>> = {
  bullish_engulfing: { ratio: 1.2 },
  bearish_engulfing: { ratio: 1.2 },
  bullish_pin_bar: { wick_ratio: 2, min_range_atr: 0.5 },
  bearish_pin_bar: { wick_ratio: 2, min_range_atr: 0.5 },
  inside_bar: {},
}
