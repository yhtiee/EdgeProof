import { describe, expect, it } from 'vitest'
import { findVague } from './banned'
import { checkRulebook } from './clarity'
import { describeCondition, describeEntry, describeExit, describeStop } from './describe'
import { profileFit } from './fit'
import { mirror } from './mirror'
import type { Condition, ExampleRef, Profile, VersionDoc } from './types'
import { BLOCKS, newDraft } from './vocabulary'

/**
 * The same twelve teaching fixtures the server tests use
 * (backend/tests/test_clarity.py): both engines must give the same codes.
 */
type Fixture = {
  fixture: string
  teachingFixture: boolean
  name: string
  profile: Profile
  version: VersionDoc
  examples: ExampleRef[]
  expected: { passed: boolean; kind: string; fails: string[]; warns: string[]; fit: string[] }
}
const FILES = import.meta.glob<Fixture>('../../../../docs/strategy-lab/fixtures/*.json', { eager: true, import: 'default' })
const FIXTURES: Fixture[] = Object.keys(FILES)
  .sort()
  .map((k) => FILES[k])

const codes = (items: { code: string; severity: string }[], severity: string) =>
  [...new Set(items.filter((i) => i.severity === severity).map((i) => i.code))].sort()

describe('clarity engine parity with the server', () => {
  it('has twelve labelled fixtures', () => {
    expect(FIXTURES).toHaveLength(12)
    expect(FIXTURES.every((f) => f.teachingFixture)).toBe(true)
  })

  it.each(FIXTURES.map((f) => [f.fixture, f] as const))('%s', (_, f) => {
    const report = checkRulebook(f.name, f.version, f.examples)
    expect(codes(report.items, 'fail')).toEqual(f.expected.fails)
    expect(codes(report.items, 'warn')).toEqual(f.expected.warns)
    expect(report.kind).toBe(f.expected.kind)
    expect(report.passed).toBe(f.expected.passed)
    expect(profileFit(f.version.rules, f.profile).map((x) => x.code).sort()).toEqual(f.expected.fit)
  })

  it('lists what a new draft is missing', () => {
    const fails = codes(checkRulebook('', newDraft(), []).items, 'fail')
    for (const code of ['NAME_MISSING', 'MARKET_NO_INSTRUMENT', 'SETUP_EMPTY', 'ENTRY_MISSING', 'STOP_MISSING', 'EXIT_MISSING']) {
      expect(fails).toContain(code)
    }
  })
})

describe('banned words (same cases as the server)', () => {
  it.each([
    ['A strong candle near a key level', ['strong', 'near', 'key level']],
    ['It closes above the prior day high on a major pair', []],
    ['Price is close to the 20 EMA', ['close to']],
    ['STRONG and Clearly obvious', ['strong', 'clearly', 'obvious']],
    ['Wait for confirmation, usually', ['confirmation', 'usually']],
    ["The candle's body is about 10 pips", ['about']],
    ['Strongest', []],
  ])('%s', (text, words) => {
    expect(findVague(text).map((h) => h.word)).toEqual(words)
  })
})

describe('vocabulary, preview and mirror', () => {
  const base = FIXTURES.find((f) => f.fixture === '01-trend-pullback-ema')!

  it('every block opens with valid defaults', () => {
    for (const block of BLOCKS.filter((b) => b.type !== 'free_text')) {
      const cond: Condition = { id: 'c9', type: block.type, timeframe: 'H1', params: structuredClone(block.defaults) }
      const doc = structuredClone(base.version)
      doc.rules.setup.conditions = [cond]
      const report = checkRulebook(base.name, doc, [{ rule_key: 'c9', valid: true }, { rule_key: 'c9', valid: false }])
      expect(report.items.filter((i) => i.code.startsWith('COND_')), block.type).toEqual([])
    }
  })

  it('describes every fixture rule in plain words, with no unfilled gaps', () => {
    for (const f of FIXTURES) {
      for (const c of f.version.rules.setup.conditions) expect(describeCondition(c)).not.toContain('…')
      if (f.version.rules.stop) expect(describeStop(f.version.rules)).not.toContain('…')
      expect(describeEntry(f.version.rules)).not.toContain('…')
      expect(describeExit(f.version.rules).join(' ')).not.toContain('…')
    }
    const c = base.version.rules.setup.conditions[0]
    expect(describeCondition(c)).toBe('The candle closes above the 50 EMA on the 4-hour chart.')
  })

  it('mirrors long rules to short ones and back', () => {
    for (const f of FIXTURES) for (const c of f.version.rules.setup.conditions) expect(mirror(mirror(c))).toEqual(c)
    const rsi = base.version.rules.setup.conditions[3]
    expect(mirror(rsi).params).toMatchObject({ relation: 'crosses_below', value: 60 })
    expect(describeCondition(mirror(base.version.rules.setup.conditions[0]))).toBe('The candle closes below the 50 EMA on the 4-hour chart.')
  })
})
