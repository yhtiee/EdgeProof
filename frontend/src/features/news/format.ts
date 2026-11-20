import type { CalendarEvent, Impact } from './api'

/** News display helpers. Pure, so they're unit-tested. Times are the learner's own (the browser's time zone). */

export type Week = 'last' | 'this' | 'next'
export type ImpactFilter = 'high' | 'high_medium' | 'all'

/** Monday 00:00 to the next Monday 00:00 in local time, for last, this or next week. */
export function weekRange(week: Week, now = new Date()): { from: Date; to: Date } {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + (week === 'last' ? -7 : week === 'next' ? 7 : 0))
  const to = new Date(monday)
  to.setDate(to.getDate() + 7)
  return { from: monday, to }
}

/** An ISO time with the local offset ("2026-11-16T00:00:00+01:00"), so the server sees the learner's week. */
export function localIso(d: Date): string {
  const pad = (n: number) => String(Math.abs(n)).padStart(2, '0')
  const off = -d.getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`
}

export const IMPACT_TEXT: Record<Impact, string> = { High: 'High', Medium: 'Medium', Low: 'Low', Holiday: 'Holiday' }

const IMPACTS_FOR: Record<ImpactFilter, Impact[]> = {
  high: ['High'],
  high_medium: ['High', 'Medium'],
  all: ['High', 'Medium', 'Low', 'Holiday'],
}

/** Calendar filters: impact level and currencies ("mine" = the currencies in the learner's journaled pairs). */
export function filterEvents(
  events: CalendarEvent[],
  { impact, currency, mine }: { impact: ImpactFilter; currency: string; mine: string[] },
): CalendarEvent[] {
  const impacts = IMPACTS_FOR[impact]
  return events.filter(
    (e) => impacts.includes(e.impact) && (!currency || (currency === 'mine' ? mine.includes(e.currency) : e.currency === currency)),
  )
}

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

/** Events grouped by local day, in order, with a readable label and which day is today. */
export function groupByDay(events: CalendarEvent[], now = new Date()) {
  const today = dayKey(now)
  const groups: { key: string; label: string; isToday: boolean; events: CalendarEvent[] }[] = []
  for (const e of events) {
    const d = new Date(e.at)
    const key = dayKey(d)
    let g = groups[groups.length - 1]
    if (!g || g.key !== key) {
      g = { key, label: DAY.format(d), isToday: key === today, events: [] }
      groups.push(g)
    }
    g.events.push(e)
  }
  return groups
}

/** The first event still to come: the "Up next" line sits above it. */
export function nextUpId(events: CalendarEvent[], now = Date.now()): string | null {
  return events.find((e) => new Date(e.at).getTime() >= now && e.impact !== 'Holiday')?.id ?? null
}

const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })

/** "13:30", or "All day" for a holiday (the feed puts those at midnight New York time). */
export function eventTime(e: Pick<CalendarEvent, 'at' | 'impact'>): string {
  return e.impact === 'Holiday' ? 'All day' : TIME.format(new Date(e.at))
}

/** How the actual compared, in words: "Above forecast", "Below forecast", "In line", or "" when there's nothing to compare. */
export function surpriseText(e: Pick<CalendarEvent, 'surprise'>): string {
  return e.surprise === 1 ? 'Above forecast' : e.surprise === -1 ? 'Below forecast' : e.surprise === 0 ? 'In line with forecast' : ''
}

/** One sentence on what the release meant for the currency, or what to watch for if it's still to come. */
export function readingText(e: CalendarEvent, now = Date.now()): string {
  if (e.impact === 'Holiday') return `Banks in this economy are closed, so ${e.currency} trading can be thinner than usual.`
  const out = new Date(e.at).getTime() <= now
  if (!out) {
    return e.forecast
      ? `Not out yet. Prices tend to move on the gap between the actual figure and the ${e.forecast} forecast, not on the figure alone.`
      : 'Not out yet. There is no forecast for this one, so watch what is said or how it compares with last time.'
  }
  if (!e.actual) return 'Out, but we don’t have the figure yet. The official source has it.'
  if (e.surprise === null) return `Came in at ${e.actual}.`
  const compared = e.surprise === 0 ? `Came in at ${e.actual}, in line with the forecast` : `Came in at ${e.actual}, ${e.surprise > 0 ? 'above' : 'below'} the ${e.forecast} forecast`
  if (e.effect === 'good') return `${compared}. That usually supports ${e.currency}.`
  if (e.effect === 'bad') return `${compared}. That usually weighs on ${e.currency}.`
  return `${compared}.`
}
