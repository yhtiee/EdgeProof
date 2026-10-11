import { describe, expect, it } from 'vitest'
import {
  compound,
  currencyExposure,
  equityCurves,
  expectancyRange,
  gapLoss,
  leverageMargin,
  overfit,
  pipMoney,
  riskOfRuin,
  sma,
  swapTotal,
  tradingCost,
} from './maths2'

describe('leverageMargin', () => {
  it('matches the lesson: $30,000 at 30:1 needs $1,000 margin; a 1% move costs 30% of $1,000', () => {
    const m = leverageMargin({ balance: 1000, leverage: 30, positionValue: 30000 })
    expect(m.margin).toBe(1000)
    expect(m.wipeMovePct).toBeCloseTo(3.33, 2)
    expect(m.effectiveLeverage).toBe(30)
    expect(m.closeOutMovePct).toBeCloseTo(1.67, 2)
  })
})

describe('pip, cost, swap, gap', () => {
  it('pip money', () => expect(pipMoney({ lots: 0.5, pips: 20 }).money).toBe(100))
  it('cost in R: 1-pip spread + $7 commission on a 10-pip stop is 0.17R', () => {
    expect(tradingCost({ spreadPips: 1, commissionPerLot: 7, slippagePips: 0, stopPips: 10 }).costInR).toBeCloseTo(0.17)
  })
  it('swap counts Wednesday three times', () => {
    expect(swapTotal({ perLotPerNight: -6, lots: 1, nights: 5, wednesdays: 1 })).toEqual({ chargedNights: 7, total: -42 })
  })
  it('gap loss in R', () => expect(gapLoss({ stopPips: 20, gapBeyondPips: 30 }).lossR).toBe(2.5))
})

describe('statistics', () => {
  it('equity curves are reproducible from a seed', () => {
    const a = equityCurves({ seed: 3, curves: 2, trades: 50, winRate: 0.5, winR: 1 })
    expect(a).toEqual(equityCurves({ seed: 3, curves: 2, trades: 50, winRate: 0.5, winR: 1 }))
    expect(a[0]).toHaveLength(51)
  })
  it('expectancy range narrows with more trades', () => {
    const small = expectancyRange({ winRate: 0.4, winR: 2, trades: 30 })
    const big = expectancyRange({ winRate: 0.4, winR: 2, trades: 300 })
    expect(small.mean).toBeCloseTo(0.2)
    expect(small.high - small.low).toBeGreaterThan(3 * (big.high - big.low))
  })
  it('risk of ruin grows with risk per trade', () => {
    const low = riskOfRuin({ riskPct: 1, winRate: 0.45, winR: 1.5, trades: 200, ruinPct: 30 }).probability
    const high = riskOfRuin({ riskPct: 5, winRate: 0.45, winR: 1.5, trades: 200, ruinPct: 30 }).probability
    expect(high).toBeGreaterThan(low)
  })
  it('compounding: 10% a month is about 214% a year', () => {
    expect(compound({ monthlyPct: 10, months: 12, start: 1000 }).yearlyPct).toBeCloseTo(213.8, 0)
  })
  it('sma', () => expect(sma([1, 2, 3, 4], 2)).toEqual([null, 1.5, 2.5, 3.5]))
  it('currency exposure: long EUR/USD and long GBP/USD are both short USD', () => {
    const e = currencyExposure([
      { pair: 'EUR/USD', side: 'buy', riskPct: 1 },
      { pair: 'GBP/USD', side: 'buy', riskPct: 1 },
    ])
    expect(e.USD).toBe(-2)
    expect(e.EUR).toBe(1)
  })
  it('overfitting: the best of many no-edge strategies looks good in sample, not out of sample', () => {
    const r = overfit({ tries: 200, trades: 50, seed: 1 })
    expect(r.bestInSample).toBeGreaterThan(0.2)
    expect(Math.abs(r.outOfSample)).toBeLessThan(r.bestInSample)
  })
})
