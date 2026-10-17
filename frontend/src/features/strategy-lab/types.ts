/**
 * The rulebook version document (docs/strategy-lab/rulebook-builder.md §3.2).
 * Mirrors backend/apps/strategy/schema/rulebook.v1.json; the fixtures test
 * both sides. Drafts may be incomplete, so most values can be missing.
 */
export type Timeframe = 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'D1' | 'W1'
export type Session = 'asia' | 'london' | 'new_york'
export type Zone = 'Europe/London' | 'America/New_York' | 'Asia/Tokyo' | 'UTC'
export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri'
export type Distance = { unit: 'pips' | 'atr'; value: number }
export type Ma = 'sma' | 'ema'

export type ConditionType =
  | 'price_vs_ma' | 'ma_cross' | 'ma_order' | 'structure' | 'level' | 'candle_pattern'
  | 'rsi' | 'macd' | 'atr' | 'distance' | 'time_window' | 'candle_size' | 'free_text'

/** Params are a loose record: the vocabulary says what each type needs, and the clarity engine checks it. */
export type Params = Record<string, unknown> & { override?: { reason: string; recorded_at?: string } | null }

export type Condition = { id: string; type: ConditionType; timeframe: Timeframe | null; params: Params }

export type EntryTrigger = { type: 'next_open' | 'stop_beyond_setup' | 'limit_at_ma' | 'limit_retrace' } & Record<string, unknown>
export type StopRule = { type: 'swing' | 'setup_candle' | 'atr' | 'fixed' } & Record<string, unknown>
export type Target = { type: 'r_multiple' | 'prior_swing' | 'prior_day_level' | 'atr' | 'none' } & Record<string, unknown>
export type Trailing = { type: 'atr' | 'swing' | 'ma' } & Record<string, unknown>
export type TimeExit = { type: 'bars' | 'time' | 'before_weekend' } & Record<string, unknown>

export type Rules = {
  schemaVersion: 1
  idea: string
  direction: 'long' | 'short' | 'both'
  market: { instruments: string[]; timeframes: Timeframe[]; sessions: Session[] }
  setup: { conditions: Condition[] }
  entry: { timeframe: Timeframe | null; trigger: EntryTrigger } | null
  stop: { rule: StopRule; skip_if_wider_than?: Distance | null } | null
  exit: {
    target: Target
    breakeven?: { at_r: number } | null
    partial?: { at_r: number; percent: number } | null
    trailing?: Trailing | null
    time_exit?: TimeExit | null
  } | null
  no_trade: {
    news: { enabled: boolean; before_min?: number | null; after_min?: number | null }
    max_spread_pips?: number | null
    avoid_rollover: boolean
    no_new_after_friday?: string | null
    other: Condition[]
  }
}

export type RiskPlan = {
  risk_pct: number
  daily_loss_r: number
  weekly_loss_r: number
  max_drawdown_r: number
  max_open_trades: number
  max_trades_per_day: number
  max_currency_risk_pct: number
  losing_streak: { losses: number; action: 'stop_day' | 'halve_risk' | 'stop_review' }
}

export type CostRow = {
  spread_pips: number
  commission_per_lot: number
  slippage_pips: number
  news_slippage_pips: number
  swap_long: number
  swap_short: number
  placeholder: boolean
}

export type VersionDoc = { rules: Rules; risk_plan: RiskPlan; cost_model: Record<string, CostRow> }

export type ExampleRef = { rule_key: string; valid: boolean }

export type StepKey = 'name' | 'market' | 'setup' | 'entry' | 'stop' | 'exit' | 'risk' | 'costs' | 'no_trade' | 'examples'

export type CheckItem = { code: string; severity: 'fail' | 'warn'; path: string; message: string; fix: StepKey }
export type ClarityReport = { passed: boolean; kind: 'mechanical' | 'discretionary'; items: CheckItem[] }
export type FitItem = { code: string; message: string }
export type Profile = { weekly_hours: number | null; sessions: string[]; timezone: string }
