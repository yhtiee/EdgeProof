import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api/client'

/** Fundamental Bias Scanner API (docs/scanner/fundamental-bias-scanner.md). Read-only, no gate. */

export type Label = 'very_bullish' | 'bullish' | 'neutral' | 'bearish' | 'very_bearish' | 'insufficient'
export type CurrencyFactor = 'cot' | 'rates' | 'inflation' | 'growth' | 'labour' | 'business'
export type PairFactor = 'trend' | 'retail'
export type Factor = CurrencyFactor | PairFactor

export const CURRENCY_FACTORS: CurrencyFactor[] = ['cot', 'rates', 'inflation', 'growth', 'labour', 'business']
export const PAIR_FACTORS: PairFactor[] = ['trend', 'retail']

export type RunMeta = {
  as_of: string
  updated_at: string | null
  is_weekly_snapshot: boolean
  /** "EUR:inflation" or "EURUSD:trend" for every factor past its refresh window. */
  stale: string[]
  disclaimer: string
}

export type Agreement = { agree: number; of: number }

export type PairRow = {
  symbol: string
  base: string
  quote: string
  score: number | null
  label: Label
  label_text: string
  rank: number | null
  change_wow: number | null
  agreement: Agreement | null
  stale_factors: string[]
  /** Final bias: the regime `score` blended with momentum (docs/scanner/scoreboard.md). */
  final_score: number | null
  final_label: Label
  final_rank: number | null
  momentum: number | null
  mixed: boolean
  board_score: number | null
}

// --- Scoreboard (docs/scanner/scoreboard.md) ----------------------------------------------------

export type BoardColumn =
  | 'trend' | 'seasonality' | 'cot' | 'crowd'
  | 'gdp' | 'mpmi' | 'spmi' | 'retail' | 'cconf' | 'cpi' | 'ppi' | 'pce' | 'rates' | 'nfp' | 'unemp' | 'claims' | 'adp' | 'jolts'

/** ok: scored · pending: waiting for a release with a forecast · none: no free source · na: US-only data, not this pair · stale · missing */
export type CellStatus = 'ok' | 'pending' | 'none' | 'na' | 'stale' | 'missing'

export type CellDetail = Record<string, unknown> & {
  title?: string
  actual?: number | null
  forecast?: number | null
  forecast_text?: string
  previous?: number | null
  actual_source?: string
  at?: string
  reason?: string
  basis?: string
}

export type BoardSide = { score: number | null; status: CellStatus; detail: CellDetail } | null

export type BoardCell = {
  score: number | null
  status: CellStatus
  detail?: CellDetail
  sides?: { base: BoardSide; quote: BoardSide }
}

export type BoardRow = {
  symbol: string
  base: string
  quote: string
  score: number | null
  label: Label
  label_text: string
  rank: number | null
  change_1d: number | null
  columns: Partial<Record<BoardColumn, BoardCell>>
  final_score: number | null
  final_label: Label
  regime: number | null
  momentum: number | null
  mixed: boolean
}

export type Scoreboard = RunMeta & {
  rows: BoardRow[]
  groups: { tech: BoardColumn[]; macro: BoardColumn[] }
  columns: Record<BoardColumn, { short: string; name: string; about: string }>
  merge: { regime: number; momentum: number; mixed_at: number }
  calendar_link: { label: string; url: string }
}

export type FactorValue = {
  score: number | null
  raw: number | null
  stale: boolean
  detail: Record<string, unknown> & { as_of?: string; period?: string; freq?: string; age_days?: number; reason?: string }
  source: string
}

export type CurrencyBlock = {
  code: string
  name: string
  central_bank: string
  score: number | null
  label: Label
  label_text: string
  factors_used: number
  factors: Partial<Record<CurrencyFactor, FactorValue>>
}

export type FactorText = Record<Factor, { name: string; about: string; lesson: string }>

export type PairDetail = RunMeta & {
  symbol: string
  score: number | null
  label: Label
  label_text: string
  rank: number | null
  change_wow: number | null
  agreement: Agreement | null
  base: CurrencyBlock
  quote: CurrencyBlock
  pair_factors: Partial<Record<PairFactor, FactorValue>>
  contributions: Partial<Record<Factor, number | null>>
  factor_text: FactorText
  summary: string
}

export type HistoryPoint = { as_of: string; score: number | null; label: Label; close: number | null; replay: boolean }

export type EvidenceRow = { n: number; hit_rate: number | null; avg_return_pct: number | null }
export type Evidence = {
  snapshots: number
  first: string | null
  last: string | null
  disclaimer: string
  horizons: Record<
    '1' | '4' | '12',
    Record<Exclude<Label, 'insufficient'>, EvidenceRow> & {
      strong_vs_neutral: { strong_hit_rate: number | null; strong_n: number; neutral_hit_rate: number | null; passes: boolean }
    }
  >
}

export type ScannerStatus = {
  last_run_at: string | null
  as_of: string | null
  stale: string[]
  insufficient: string[]
  sources: { name: string; ok: boolean; last_success_at: string | null; last_error: string }[]
}

// Scores change once a day at most, so a long stale time keeps tab switches instant.
const STALE = 5 * 60_000

export const usePairs = () =>
  useQuery({ queryKey: ['scanner', 'pairs'], queryFn: () => api<RunMeta & { pairs: PairRow[] }>('/scanner/pairs'), staleTime: STALE, retry: false })

export const useScoreboard = () =>
  useQuery({ queryKey: ['scanner', 'scoreboard'], queryFn: () => api<Scoreboard>('/scanner/scoreboard'), staleTime: STALE, retry: false })

export const useCurrencies = () =>
  useQuery({
    queryKey: ['scanner', 'currencies'],
    queryFn: () => api<RunMeta & { currencies: CurrencyBlock[]; factor_text: FactorText }>('/scanner/currencies'),
    staleTime: STALE,
    retry: false,
  })

export const usePair = (symbol: string) =>
  useQuery({ queryKey: ['scanner', 'pair', symbol], queryFn: () => api<PairDetail>(`/scanner/pairs/${symbol}`), staleTime: STALE, retry: false })

export const useHistory = (symbol: string, weeks: string) =>
  useQuery({
    queryKey: ['scanner', 'history', symbol, weeks],
    queryFn: () => api<{ symbol: string; points: HistoryPoint[] }>(`/scanner/pairs/${symbol}/history?weeks=${weeks}`),
    staleTime: STALE,
  })

export const useEvidence = () =>
  useQuery({ queryKey: ['scanner', 'evidence'], queryFn: () => api<Evidence>('/scanner/evidence'), staleTime: STALE })

export const useStatus = () =>
  useQuery({ queryKey: ['scanner', 'status'], queryFn: () => api<ScannerStatus>('/scanner/status'), staleTime: STALE })

// --- Evidence and "Explain it simply" ---------------------------------------------------------

export type Print = {
  period: string
  freq: string
  value: number
  released: string
  estimated_release: boolean
  change?: number | null
  current_as_of?: string
  long?: number | null
  short?: number | null
  sample?: number | null
}

export type Publication = { title: string; url: string; published_at: string; summary: string; source: string; topics: string[] }

export type CalendarItem = {
  currency: string
  title: string
  at: string
  impact: 'High' | 'Medium'
  forecast: string
  previous: string
  factor: string
  upcoming: boolean
}

export type EvidenceSide = {
  code: string
  current: { score: number | null; raw: number | null; stale: boolean; detail: FactorValue['detail'] } | null
  observations: Print[]
  data_source: string
  official: { label: string; url: string } | null
  news: Publication[]
}

export type FactorEvidence = {
  subject: string
  factor: Factor
  name: string
  about: string
  sides: EvidenceSide[]
  calendar?: CalendarItem[]
  calendar_link?: { label: string; url: string }
  disclaimer: string
}

export const useFactorEvidence = (subject: string, factor: Factor, enabled: boolean) =>
  useQuery({
    queryKey: ['scanner', 'factor', subject, factor],
    queryFn: () => api<FactorEvidence>(`/scanner/factor/${subject}/${factor}`),
    staleTime: STALE,
    enabled,
  })

export const useCalendar = (subject: string) =>
  useQuery({
    queryKey: ['scanner', 'calendar', subject],
    queryFn: () => api<{ events: CalendarItem[]; link: { label: string; url: string } }>(`/scanner/calendar/${subject}`),
    staleTime: STALE,
  })

export type ExplainStatus = { available: boolean; reason: { code: string; message: string } | null; remaining: number; limit: number }

export const useExplainStatus = () =>
  useQuery({ queryKey: ['scanner', 'explain-status'], queryFn: () => api<ExplainStatus>('/scanner/explain/status'), staleTime: 30_000 })
