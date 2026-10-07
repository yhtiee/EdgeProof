import { describe, expect, it } from 'vitest'
import { computeExampleVerdict } from './exampleVerdict'

describe('computeExampleVerdict', () => {
  const v = computeExampleVerdict()

  it('matches the figures written in DIRECTION.md', () => {
    expect(v.trades).toBe(54)
    expect(v.expectancy.toFixed(2)).toBe('-0.07')
    expect(v.profitFactor.toFixed(2)).toBe('0.89')
    expect(v.low.toFixed(2)).toBe('-0.35')
    expect(v.high.toFixed(2)).toBe('0.23')
  })

  it('is a "No edge found yet" result: the range includes zero', () => {
    expect(v.low).toBeLessThan(0)
    expect(v.high).toBeGreaterThan(0)
  })
})
