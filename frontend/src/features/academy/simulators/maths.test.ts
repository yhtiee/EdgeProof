import { describe, expect, it } from 'vitest'
import { drawdown, expectancy } from './maths'

describe('expectancy', () => {
  it('matches the lesson example: 40% wins, 2R wins, 1R losses = +0.2R', () => {
    const e = expectancy({ winRatePct: 40, avgWinR: 2, avgLossR: 1 })
    expect(e.perTrade).toBeCloseTo(0.2)
    expect(e.per100).toBeCloseTo(20)
    expect(e.breakevenWinRatePct).toBeCloseTo(33.33, 1)
  })
  it('shows a high win rate can still lose: 70% at 0.4R / 1R', () => {
    expect(expectancy({ winRatePct: 70, avgWinR: 0.4, avgLossR: 1 }).perTrade).toBeCloseTo(-0.02)
  })
})

describe('drawdown', () => {
  it('compounds: 10 losses at 2% is about 18.3%, not 20%', () => {
    const d = drawdown({ riskPct: 2, losses: 10 })
    expect(d.drawdownPct).toBeCloseTo(18.29, 1)
    expect(d.simpleSumPct).toBe(20)
  })
  it('needs +100% to recover from −50%', () => {
    expect(drawdown({ riskPct: 50, losses: 1 }).recoveryPct).toBeCloseTo(100)
  })
  it('needs +25% to recover from −20%', () => {
    expect(drawdown({ riskPct: 20, losses: 1 }).recoveryPct).toBeCloseTo(25)
  })
})
