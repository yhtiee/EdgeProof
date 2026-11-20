import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from './api'
import { eventTime, filterEvents, groupByDay, localIso, nextUpId, readingText, surpriseText, weekRange } from './format'

const ev = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: over.title ?? 'x', currency: 'USD', title: 'CPI y/y', at: '2026-11-18T13:30:00Z', impact: 'High', forecast: '3.5%', previous: '3.4%',
  actual: '', actual_source: '', surprise: null, effect: null, factor: 'inflation', indicator: 'cpi', factor_name: 'Inflation',
  factor_about: '', lesson: 'l5-actual-versus-expected', official: null, ...over,
})

describe('news calendar', () => {
  it('finds the local week, Monday to Monday', () => {
    const thu = new Date(2026, 10, 19, 15, 0) // Thursday 19 Nov 2026
    const { from, to } = weekRange('this', thu)
    expect([from.getDate(), from.getDay(), from.getHours(), to.getDate()]).toEqual([16, 1, 0, 23])
    expect(weekRange('last', thu).from.getDate()).toBe(9)
    expect(weekRange('next', thu).to.getDate()).toBe(30)
    expect(localIso(from)).toMatch(/^2026-11-16T00:00:00[+-]\d\d:\d\d$/)
  })

  it('filters by impact and currency, including the pairs I trade', () => {
    const rows = [ev({ title: 'a' }), ev({ title: 'b', impact: 'Low', currency: 'EUR' }), ev({ title: 'c', impact: 'Holiday', currency: 'JPY' })]
    expect(filterEvents(rows, { impact: 'high_medium', currency: '', mine: [] }).map((e) => e.title)).toEqual(['a'])
    expect(filterEvents(rows, { impact: 'all', currency: 'mine', mine: ['EUR', 'JPY'] }).map((e) => e.title)).toEqual(['b', 'c'])
    expect(filterEvents(rows, { impact: 'all', currency: 'USD', mine: [] }).map((e) => e.title)).toEqual(['a'])
  })

  it('groups by day and marks what is up next', () => {
    const rows = [ev({ title: 'a', at: '2026-11-18T08:00:00Z' }), ev({ title: 'b', at: '2026-11-18T13:30:00Z' }), ev({ title: 'c', at: '2026-11-20T09:00:00Z' })]
    const groups = groupByDay(rows, new Date('2026-11-18T12:00:00Z'))
    expect(groups.map((g) => g.events.length)).toEqual([2, 1])
    expect(groups[0].label).toContain('November')
    expect(nextUpId(rows, Date.parse('2026-11-18T12:00:00Z'))).toBe('b')
    expect(eventTime(ev({ impact: 'Holiday' }))).toBe('All day')
  })

  it('reads a release in words', () => {
    const now = Date.parse('2026-11-19T00:00:00Z')
    expect(readingText(ev({ actual: '3.6%', surprise: 1, effect: 'good' }), now)).toBe('Came in at 3.6%, above the 3.5% forecast. That usually supports USD.')
    expect(readingText(ev({ actual: '4.3%', surprise: 1, effect: 'bad', title: 'Unemployment Rate', forecast: '4.1%' }), now)).toContain('weighs on USD')
    expect(readingText(ev({ actual: '3.5%', surprise: 0 }), now)).toBe('Came in at 3.5%, in line with the forecast.')
    expect(readingText(ev({}), now)).toContain('The official source has it')
    expect(readingText(ev({ at: '2026-11-25T13:30:00Z' }), now)).toContain('gap between the actual figure and the 3.5% forecast')
    expect([surpriseText(ev({ surprise: 1 })), surpriseText(ev({ surprise: null }))]).toEqual(['Above forecast', ''])
  })
})
