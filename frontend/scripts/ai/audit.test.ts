import { describe, expect, it } from 'vitest'
// @ts-expect-error - plain ESM script without type declarations
import { checkArithmetic } from './audit.mjs'

describe('checkArithmetic', () => {
  it('accepts correct chains from the sample lessons', () => {
    expect(checkArithmetic('0.4 × 2R − 0.6 × 1R = 0.8R − 0.6R = +0.2R per trade.')).toEqual([])
    expect(checkArithmetic('1% of $2,000 is $20. A 40-pip stop costs $400 per lot. $20 ÷ $400 = 0.05 lots.')).toEqual([])
    expect(checkArithmetic('20 pips × $5 = $100.')).toEqual([])
  })
  it('flags wrong arithmetic', () => {
    expect(checkArithmetic('$20 ÷ $400 = 0.5 lots.')).toHaveLength(1)
    expect(checkArithmetic('35 pips × $5 = $165.')).toHaveLength(1)
  })
})
