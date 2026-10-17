import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api/client'

/** Journal API types and read hooks (spec §7, §8, §15). */

export type Side = 'buy' | 'sell'
export type Outcome = 'open' | 'win' | 'loss' | 'breakeven'

export type TradingAccount = {
  id: string
  name: string
  kind: 'demo' | 'live' | 'prop'
  broker: string
  currency: string
  balance: string | null
  risk_per_trade_pct: string
  archived: boolean
}

export type PracticeRule = { id: string; text: string; order: number; active: boolean }
export type NeverAgainItem = { id: string; text: string; order: number }

export type RuleCheck = { rule: string; followed: boolean }
export type TradeImage = { key: string; kind: 'before' | 'after' }

/** What the form sends. Decimals travel as strings so nothing is lost to floats. */
export type TradeInput = {
  client_id?: string
  account: string
  /** Optional link to a Strategy Lab version: its rules become the checklist (SL-8). */
  strategy_version?: string | null
  instrument: string
  side: Side
  entry: string
  initial_stop: string | null
  target: string | null
  exit_price: string | null
  /** Partial closes; the server merges them into one size-weighted exit (JR-4). */
  exits?: { price: string; size: string }[]
  size: string
  opened_at: string
  closed_at: string | null
  initial_risk_ccy: string | null
  gross_pnl: string | null
  fees: string
  swap: string
  setup_key: string
  rule_checks: RuleCheck[]
  emotion_before: string
  emotion_after: string
  confidence: number | null
  sleep: string
  distracted: boolean | null
  tags: string[]
  notes: string
  images: TradeImage[]
}

export type Trade = TradeInput & {
  id: string
  client_id: string
  pnl: string | null
  r_result: number | null
  r_estimated: boolean
  outcome: Outcome
  market_session: string
  after_loss: boolean
  /** The linked version's risk limits this trade went past (SL-8); never blocks logging. */
  plan_warnings?: { code: string; message: string }[]
  rules_followed: boolean
  broken_rules: string[]
  created_at: string
  updated_at: string
}

export type Breakdown = { key: string; trades: number; total_r: number; expectancy: number | null; win_rate: number | null }

export type Metrics = {
  trades: number
  wins: number
  losses: number
  breakevens: number
  win_rate: number | null
  expectancy: number | null
  total_r: number
  avg_win: number | null
  avg_loss: number | null
  profit_factor: number | null
  closed: number
  open: number
  excluded_no_stop: number
  independent_trades: number
  max_drawdown_r: number
  longest_losing_streak: number
  rule_following_rate: number | null
  rule_breaking_cost_r: number
  rule_broken_trades: number
  costs_r: number
  costs_share: number | null
  avg_stop_pips: number | null
  warnings: ('costs_high' | 'stops_small')[]
  expectancy_range: { low: number; median: number; high: number; lower_bound_90: number; no_edge_pct: number | null; blocks: number } | null
  expected: { drawdown_r: [number, number, number]; losing_streak: [number, number, number] } | null
  min_for_ranges: number
  curve: { t: string; r: number }[]
  breakdowns: Record<'instrument' | 'session' | 'weekday' | 'setup' | 'year' | 'emotion' | 'rules' | 'account', Breakdown[]>
  risk_per_trade_pct: number
  estimated_r_trades: number
}

export type Activity = {
  today: string
  days: Record<string, number>
  streak: number
  best_streak: number
  logged_today: boolean
  total_trades: number
}

export type Review = { id: string; kind: 'daily' | 'weekly'; period: string; answers: Record<string, string>; created_at: string }
export type ReviewList = { results: Review[]; next: string | null; questions: Record<'daily' | 'weekly', string[]> }

export type TradeFilters = { q?: string; account?: string; outcome?: string; rules?: string; from?: string; to?: string }

export const qs = (params: Record<string, string | undefined>) => {
  const s = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1])).toString()
  return s ? `?${s}` : ''
}

/** A query whose last good answer is kept on the device, so the form works offline. */
function useCachedQuery<T>(key: readonly unknown[], path: string, userId: string | undefined) {
  const storageKey = `edgeproof.cache.${userId}.${path}`
  const readCache = (): T | undefined => {
    try {
      const raw = localStorage.getItem(storageKey)
      return raw ? (JSON.parse(raw) as T) : undefined
    } catch {
      return undefined
    }
  }
  const query = useQuery<T>({
    queryKey: key,
    queryFn: () => api<T>(path),
    enabled: !!userId,
    // TanStack's NonFunctionGuard<T> can't resolve for a generic T; the data is plain JSON.
    placeholderData: readCache as never,
  })
  useEffect(() => {
    if (!userId || !query.data || query.isPlaceholderData) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(query.data))
    } catch {
      /* storage blocked */
    }
  }, [userId, storageKey, query.data, query.isPlaceholderData])
  return query
}

export const ACCOUNTS = ['trading-accounts'] as const
export const RULES = ['practice-rules'] as const
export const NEVER_AGAIN = ['never-again'] as const

export const useAccounts = (userId: string | undefined) => useCachedQuery<TradingAccount[]>(ACCOUNTS, '/me/trading-accounts', userId)
export const useRules = (userId: string | undefined) => useCachedQuery<PracticeRule[]>(RULES, '/me/practice-rules', userId)
export const useNeverAgain = (userId: string | undefined) => useCachedQuery<NeverAgainItem[]>(NEVER_AGAIN, '/me/never-again', userId)

export const useMetrics = (filters: TradeFilters, enabled = true) =>
  useQuery({
    queryKey: ['journal-metrics', filters],
    queryFn: () => api<Metrics>(`/me/journal/metrics${qs(filters)}`),
    enabled,
    staleTime: 30_000,
  })

export const useActivity = (enabled = true) =>
  useQuery({ queryKey: ['journal-activity'], queryFn: () => api<Activity>('/me/journal/activity'), enabled, staleTime: 30_000 })

export const useReviews = (enabled = true) =>
  useQuery({ queryKey: ['reviews'], queryFn: () => api<ReviewList>('/me/reviews?limit=60'), enabled })

export const getTrade = (id: string) => api<Trade>(`/me/trades/${id}`)

/** Journal-wide data that changes when a trade does. */
export const JOURNAL_KEYS = [['trades'], ['journal-metrics'], ['journal-activity']] as const

export const EMOTIONS = ['calm', 'confident', 'anxious', 'frustrated', 'excited', 'bored', 'tired', 'fomo'] as const
export const EMOTION_LABEL: Record<string, string> = {
  calm: 'Calm', confident: 'Confident', anxious: 'Anxious', frustrated: 'Frustrated',
  excited: 'Excited', bored: 'Bored', tired: 'Tired', fomo: 'Fear of missing out',
}
export const SESSION_LABEL: Record<string, string> = {
  asia: 'Asia', london: 'London', overlap: 'London–New York', new_york: 'New York', off: 'After hours',
}
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export const INSTRUMENTS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD',
  'EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'EUR/CHF', 'AUD/JPY', 'EUR/AUD', 'GBP/CHF', 'CAD/JPY', 'AUD/NZD',
]
