import type { FitItem, Profile, Rules, Timeframe } from './types'
import { TF_RANK } from './vocabulary'

/**
 * Profile fit check (SL-2), mirroring backend/apps/strategy/fit.py. Warnings
 * only; never blocks anything.
 */
const HOURS_NEEDED: Record<Timeframe, number> = { M5: 15, M15: 10, M30: 6, H1: 6, H4: 3, D1: 1, W1: 1 }
export const TF_WORDS: Record<Timeframe, string> = {
  M5: '5-minute', M15: '15-minute', M30: '30-minute', H1: '1-hour', H4: '4-hour', D1: 'daily', W1: 'weekly',
}
const SESSION_WORDS: Record<string, string> = { asia: 'Asia', london: 'London', new_york: 'New York' }

const join = (names: string[]) => {
  const words = names.map((n) => SESSION_WORDS[n] ?? n)
  return words.length === 1 ? words[0] : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`
}

/** Hour and minute in `zone` for 14 January 2026 at hh:mm in `from` (a fixed winter day, like the server). */
function shift(hhmm: string, from: string, to: string): [number, number] {
  const [h, m] = hhmm.split(':').map(Number)
  const guess = Date.UTC(2026, 0, 14, h, m)
  const offset = (zone: string, at: number) => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-GB', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
        .formatToParts(at)
        .map((p) => [p.type, p.value]),
    )
    return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute) - at
  }
  const instant = guess - offset(from, guess)
  const local = new Date(instant + offset(to, instant))
  return [local.getUTCHours(), local.getUTCMinutes()]
}

const pad = (n: number) => String(n).padStart(2, '0')

export function profileFit(rules: Rules, profile: Profile): FitItem[] {
  const out: FitItem[] = []
  const tfs = (rules.market?.timeframes ?? []).filter((tf) => tf in TF_RANK)
  if (!tfs.length) return out
  const low = [...tfs].sort((a, b) => TF_RANK[a] - TF_RANK[b])[0]
  const hours = profile.weekly_hours
  if (!hours) out.push({ code: 'FIT_NO_PROFILE', message: 'Add your weekly hours in your profile to check fit.' })
  else if (hours < HOURS_NEEDED[low]) {
    out.push({
      code: 'FIT_HOURS_TF',
      message: `This strategy uses ${TF_WORDS[low]} charts. Your plan has ${hours} hours a week; ${TF_WORDS[low]} strategies usually need about ${HOURS_NEEDED[low]}.`,
    })
  }
  const mine = profile.sessions ?? []
  const extra = (rules.market?.sessions ?? []).filter((s) => !mine.includes(s))
  if (mine.length && extra.length && TF_RANK[low] <= TF_RANK.H4) {
    out.push({ code: 'FIT_SESSIONS', message: `This strategy trades the ${join(extra)} session. Your profile lists ${join(mine)}.` })
  }
  for (const c of rules.setup?.conditions ?? []) {
    if (c.type !== 'time_window') continue
    const p = c.params as { from?: string; to?: string; zone?: string }
    if (!p.from || !p.to || !p.zone) continue
    try {
      const start = shift(p.from, p.zone, profile.timezone || 'UTC')
      const end = shift(p.to, p.zone, profile.timezone || 'UTC')
      const night = ([h]: [number, number]) => h >= 23 || h < 6
      if (night(start) || night(end)) {
        out.push({
          code: 'FIT_WINDOW_LOCAL',
          message: `${p.from}–${p.to} ${p.zone.split('/').at(-1)!.replace('_', ' ')} time is ${pad(start[0])}:${pad(start[1])}–${pad(end[0])}:${pad(end[1])} where you are.`,
        })
      }
    } catch {
      /* unknown zone: skip */
    }
  }
  return out
}
