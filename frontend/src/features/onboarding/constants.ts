/**
 * Labels and session windows used by the onboarding and profile forms.
 * Keys match the backend (apps/accounts/services.py); the server computes
 * the plan itself.
 */

export type SessionKey = 'asia' | 'london' | 'new_york'

/** Approximate windows in UTC; they shift by an hour with daylight saving. */
export const SESSIONS: { key: SessionKey; label: string; utcStart: string; utcEnd: string }[] = [
  { key: 'asia', label: 'Asia', utcStart: '00:00', utcEnd: '09:00' },
  { key: 'london', label: 'London', utcStart: '07:00', utcEnd: '16:00' },
  { key: 'new_york', label: 'New York', utcStart: '12:00', utcEnd: '21:00' },
]

export type YearsTrading = 'none' | 'lt1' | '1to3' | '3plus'

export const YEARS_TRADING: { value: YearsTrading; label: string }[] = [
  { value: 'none', label: 'None yet' },
  { value: 'lt1', label: 'Under 1 year' },
  { value: '1to3', label: '1 to 3 years' },
  { value: '3plus', label: 'More than 3' },
]

export const MISTAKES: { key: string; label: string }[] = [
  { key: 'no_stop', label: 'Trading without a stop' },
  { key: 'oversized', label: 'Risking too much on one trade' },
  { key: 'revenge', label: 'Revenge trading after a loss' },
  { key: 'moved_stop', label: 'Moving my stop further away' },
  { key: 'overtrading', label: 'Taking too many trades' },
  { key: 'news', label: 'Trading through big news' },
  { key: 'no_plan', label: 'No written plan' },
  { key: 'prop_rules', label: 'Breaking prop firm rules' },
]

export const HOUR_PRESETS = [3, 5, 10, 15, 20]

export type Experience = {
  years_trading: YearsTrading
  accounts_blown: number
  prop_challenges: number
  usual_mistakes: string[]
  other_mistake: string
}

export type Profile = {
  weekly_hours: number | null
  sessions: SessionKey[]
  experience: Experience | null
  onboarding_step: number
  plan_accepted_at: string | null
}

/** "08:00–17:00" in the given timezone, for a UTC window today. */
export function localWindow(utcStart: string, utcEnd: string, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone, hourCycle: 'h23' })
  const at = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number)
    const d = new Date()
    d.setUTCHours(h, m, 0, 0)
    return fmt.format(d)
  }
  try {
    return `${at(utcStart)}–${at(utcEnd)}`
  } catch {
    return `${utcStart}–${utcEnd} UTC`
  }
}

/** IANA timezones for the select, with the browser's own first. */
export function timezoneOptions(current?: string): { value: string; label: string }[] {
  let zones: string[] = []
  try {
    zones = Intl.supportedValuesOf('timeZone')
  } catch {
    zones = ['Africa/Lagos', 'Europe/London', 'America/New_York', 'Asia/Tokyo']
  }
  if (!zones.includes('UTC')) zones = [...zones, 'UTC']
  if (current && !zones.includes(current)) zones = [current, ...zones]
  return zones.map((z) => ({ value: z, label: z.replace(/_/g, ' ') }))
}
