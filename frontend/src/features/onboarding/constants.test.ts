import { describe, expect, it } from 'vitest'
import { localWindow, timezoneOptions } from './constants'

describe('localWindow', () => {
  it('shows London session hours in Lagos time (UTC+1)', () => {
    expect(localWindow('07:00', '16:00', 'Africa/Lagos')).toBe('08:00–17:00')
  })
  it('shows UTC hours unchanged in UTC', () => {
    expect(localWindow('12:00', '21:00', 'UTC')).toBe('12:00–21:00')
  })
})

describe('timezoneOptions', () => {
  it('always includes UTC and the current zone', () => {
    const values = timezoneOptions('Africa/Lagos').map((o) => o.value)
    expect(values).toContain('UTC')
    expect(values).toContain('Africa/Lagos')
  })
})
