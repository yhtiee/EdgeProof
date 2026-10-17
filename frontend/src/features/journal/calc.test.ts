import { describe, expect, it } from 'vitest'
import { calcTrade, pipSize, sizeForRisk, type CalcInput } from './calc'

const base: CalcInput = {
  instrument: 'EUR/USD', side: 'buy', entry: 1.1, stop: 1.095, exit: 1.11, size: 0.1, accountCurrency: 'USD',
  fees: 2, swap: -1, balance: 5000,
}

describe('calcTrade (matches the server tests)', () => {
  it('computes risk, P&L and R from prices with costs', () => {
    const c = calcTrade(base)
    expect(c.riskCcy).toBe(50)
    expect(c.grossPnl).toBe(100)
    expect(c.pnl).toBe(97)
    expect(c.r).toBeCloseTo(1.94)
    expect(c.riskPct).toBeCloseTo(1)
    expect(c.stopPips).toBeCloseTo(50)
    expect(c.outcome).toBe('win')
  })

  it('flags a stop on the wrong side', () => {
    expect(calcTrade({ ...base, stop: 1.105 }).stopError).toMatch(/below/)
    expect(calcTrade({ ...base, side: 'sell', stop: 1.095 }).stopError).toMatch(/above/)
  })

  it('estimates R from prices when the quote currency differs', () => {
    const c = calcTrade({ ...base, instrument: 'USD/JPY', entry: 150, stop: 149.5, exit: 149.75 })
    expect(c.sameCurrency).toBe(false)
    expect(c.rEstimated).toBe(true)
    expect(c.r).toBeCloseTo(-0.5)
    expect(c.stopPips).toBeCloseTo(50)
    const exact = calcTrade({ ...base, instrument: 'USD/JPY', entry: 150, stop: 149.5, exit: 149.75, riskCcy: 33.4, grossPnl: -16.7, fees: 0, swap: 0 })
    expect(exact.rEstimated).toBe(false)
    expect(exact.r).toBeCloseTo(-0.5)
  })

  it('treats tiny results as breakeven and no exit as open', () => {
    expect(calcTrade({ ...base, exit: 1.1003, fees: 0, swap: 0 }).outcome).toBe('breakeven')
    expect(calcTrade({ ...base, exit: null }).outcome).toBe('open')
  })

  it('sizes a position for a money risk', () => {
    expect(sizeForRisk(1.1, 1.095, 50)).toBe(0.1)
    expect(sizeForRisk(1.1, 1.1, 50)).toBeNull()
    expect(pipSize('GBP/JPY')).toBe(0.01)
  })
})
