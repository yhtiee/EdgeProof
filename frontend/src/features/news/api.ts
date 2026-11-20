import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api/client'

/** News (docs/news.md): the economic calendar and official headlines. Read-only, signed-in, no gate. */

export type Impact = 'High' | 'Medium' | 'Low' | 'Holiday'

export type CalendarEvent = {
  id: string
  currency: string
  title: string
  at: string
  impact: Impact
  forecast: string
  previous: string
  /** As the calendar prints it ("3.6%", "194K"), or "" when we don't have it yet. */
  actual: string
  actual_source: string
  /** +1 above the forecast, −1 below, 0 in line; null without both figures. */
  surprise: -1 | 0 | 1 | null
  /** Whether that's usually good or bad for the currency; null when we don't judge it. */
  effect: 'good' | 'bad' | null
  factor: string
  indicator: string
  factor_name: string
  factor_about: string
  lesson: string
  official: { label: string; url: string } | null
}

export type CalendarResponse = {
  from: string
  to: string
  events: CalendarEvent[]
  my_currencies: string[]
  currencies: string[]
  impacts: Impact[]
  fetched_at: string | null
  link: { label: string; url: string }
  disclaimer: string
}

export type Headline = {
  id: string
  title: string
  url: string
  published_at: string
  summary: string
  currency: string
  source: string
  publisher: 'bank' | 'statistics'
  kind: string
  kind_text: string
  topics: string[]
}

export type HeadlinesResponse = {
  items: Headline[]
  next: string | null
  topics: Record<string, string>
  kinds: Record<string, string>
  currencies: string[]
  banks: Record<string, string>
  fetched_at: string | null
  disclaimer: string
}

export type HeadlineFilters = { currency: string; topic: string; kind: string; publisher: string }

// The calendar changes when the feed is fetched (four times a day); headlines once a day.
const STALE = 5 * 60_000

const qs = (params: Record<string, string | null | undefined>) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v)
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const useCalendar = (from: string, to: string) =>
  useQuery({
    queryKey: ['news', 'calendar', from, to],
    queryFn: () => api<CalendarResponse>(`/news/calendar${qs({ from, to })}`),
    staleTime: STALE,
  })

export const useHeadlines = (filters: HeadlineFilters) =>
  useInfiniteQuery({
    queryKey: ['news', 'headlines', filters],
    queryFn: ({ pageParam }) => api<HeadlinesResponse>(`/news/headlines${qs({ ...filters, before: pageParam })}`),
    initialPageParam: '' as string,
    getNextPageParam: (last) => last.next ?? undefined,
    staleTime: STALE,
  })
