import { describe, expect, it } from 'vitest'
import type { CalendarItem } from './api'
import { splitByNow } from './Evidence'

describe('calendar split', () => {
  it('never lists a past release as coming up, even if the server said so', () => {
    const e = (title: string, at: string): CalendarItem => ({ currency: 'GBP', title, at, impact: 'High', forecast: '', previous: '', factor: 'rates', upcoming: true })
    const now = Date.parse('2026-10-17T16:30:00Z')
    const { upcoming, out } = splitByNow([e('Old', '2026-10-15T06:00:00Z'), e('Today', '2026-10-17T06:45:00Z'), e('Next', '2026-10-20T08:30:00Z')], now)
    expect(upcoming.map((x) => x.title)).toEqual(['Next'])
    expect(out.map((x) => x.title)).toEqual(['Today', 'Old'])
  })
})
