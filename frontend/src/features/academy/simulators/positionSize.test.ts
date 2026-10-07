import { describe, expect, it } from 'vitest'
import { positionSize } from './positionSize'

describe('positionSize', () => {
  it('sizes $1,000 at 1% with a 20-pip stop to 0.05 lots', () => {
    const r = positionSize({ balance: 1000, riskPct: 1, stopPips: 20 })!
    expect(r.riskAmount).toBe(10)
    expect(r.lots).toBe(0.05)
    expect(r.actualRisk).toBeCloseTo(10)
  })

  it('rounds down so the plan is never exceeded', () => {
    const r = positionSize({ balance: 1000, riskPct: 1, stopPips: 30 })!
    expect(r.lotsExact).toBeCloseTo(0.0333, 4)
    expect(r.lots).toBe(0.03)
    expect(r.actualRiskPct).toBeLessThanOrEqual(1)
  })

  it('reports 0 lots when the stop is too wide for the account', () => {
    const r = positionSize({ balance: 100, riskPct: 0.5, stopPips: 80 })!
    expect(r.lots).toBe(0)
  })

  it('returns null for missing input', () => {
    expect(positionSize({ balance: 0, riskPct: 1, stopPips: 20 })).toBeNull()
  })
})
