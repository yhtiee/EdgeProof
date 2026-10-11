import { describe, expect, it } from 'vitest'
import type { QuestionBlock } from '../content'
import { isAnswered, isCorrect, parseNumber } from './grading'

const numeric: QuestionBlock = { type: 'question', kind: 'numeric', answer: 0.05, tolerance: 0.001, unit: 'lots', prompt: [], explanation: [] }
const mc: QuestionBlock = { type: 'question', kind: 'mc', answer: 'b', options: [], prompt: [], explanation: [] }

describe('parseNumber', () => {
  it('accepts commas, spaces and a true minus', () => {
    expect(parseNumber('1,000')).toBe(1000)
    expect(parseNumber(' 0.05 ')).toBe(0.05)
    expect(parseNumber('−2')).toBe(-2)
    expect(parseNumber('.5')).toBe(0.5)
  })
  it('rejects non-numbers', () => {
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('abc')).toBeNull()
    expect(parseNumber('1.2.3')).toBeNull()
  })
})

describe('isCorrect', () => {
  it('uses the tolerance for numeric answers', () => {
    expect(isCorrect(numeric, '0.05')).toBe(true)
    expect(isCorrect(numeric, '0.051')).toBe(true)
    expect(isCorrect(numeric, '0.052')).toBe(false)
  })
  it('compares the option key for multiple choice', () => {
    expect(isCorrect(mc, 'b')).toBe(true)
    expect(isCorrect(mc, 'a')).toBe(false)
    expect(isAnswered(mc, '')).toBe(false)
  })
})
