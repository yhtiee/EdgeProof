import { describe, expect, it } from 'vitest'
import { MINUS, formatCount, formatMoney, formatPct, formatR } from './format'

describe('formatR', () => {
  it('signs positive and negative values with a true minus', () => {
    expect(formatR(0.21)).toBe('+0.21R')
    expect(formatR(-1)).toBe(`${MINUS}1.00R`)
  })
  it('never shows a signed zero', () => {
    expect(formatR(-0.001)).toBe('0.00R')
  })
})

describe('formatPct', () => {
  it('is unsigned by default and signed on request', () => {
    expect(formatPct(2.4)).toBe('2.4%')
    expect(formatPct(1.3, { signed: true })).toBe('+1.3%')
    expect(formatPct(-0.5, { signed: true })).toBe(`${MINUS}0.5%`)
  })
})

describe('formatMoney', () => {
  it('formats naira without decimals and dollars with two', () => {
    expect(formatMoney(25000, 'NGN')).toBe('₦25,000')
    expect(formatMoney(150, 'USD')).toBe('$150.00')
    expect(formatMoney(-42.5, 'USD')).toBe(`${MINUS}$42.50`)
  })
})

describe('formatCount', () => {
  it('pluralises', () => {
    expect(formatCount(1, 'trade')).toBe('1 trade')
    expect(formatCount(54, 'trade')).toBe('54 trades')
  })
})
