import type { ConditionType } from './types'

/**
 * Banned vague words and phrases (rulebook-builder.md §2.7), mirroring
 * backend/apps/strategy/banned.py. Whole words, case-insensitive; a few
 * precise phrases ("major pair", "closes above") are allowed.
 */
type Entry = [phrase: string, question: string, blocks: ConditionType[]]

const CLEAR_Q = 'What would two people both see? Try a close beyond a level, or a swing structure.'
const LEVEL_Q = 'Which level: prior day high or low, prior week, a swing, or a round number?'
const NUMBER_Q = 'Give the number and the tolerance.'
const EVERY_TIME_Q = 'A rule applies every time. Which condition decides when?'
const PREDICT_Q = "Rules don't predict. What do you see on the chart?"
const DECIDE_Q = 'What would you be looking at when you decide? Describe it in prices.'
const CONFIRM_Q = 'What exactly confirms it: a close beyond a level, or a named candle pattern?'
const MEASURE_Q = 'What would you measure to know?'
const FEEL_Q = 'Which price fact sits behind the feeling?'
const DEFINITION_Q = 'Which parts of the definition must be true?'
const BEHAVIOUR_Q = 'Which price behaviour do you mean? Describe it as levels, structure or candles.'
const FAKE_Q = 'Define it: a close beyond a level that reverses within a number of candles?'

export const BANNED: Entry[] = [
  ['strong', 'Strong compared with what? A candle range above some multiple of ATR, or one average above another?', ['candle_size', 'ma_order']],
  ['weak', 'Weak by what measure: RSI below a value, or a small candle range?', ['rsi', 'candle_size']],
  ['clear', CLEAR_Q, ['level', 'structure']],
  ['clearly', CLEAR_Q, ['level', 'structure']],
  ['obvious', 'What makes it obvious, in prices? Name the level or the pattern.', ['level', 'candle_pattern']],
  ['good', 'Good by which number?', []],
  ['nice', 'Which measurable feature makes it nice?', []],
  ['clean', 'Clean meaning what: no candle closing through the level for a number of candles?', ['level']],
  ['looks like', 'What exactly would it need to be? Name the pattern or the level.', ['candle_pattern']],
  ['seems', MEASURE_Q, []],
  ['seem', MEASURE_Q, []],
  ['feels', FEEL_Q, []],
  ['feel', FEEL_Q, []],
  ['significant', 'Significant by size (pips or ATR) or by being a prior-day or swing level?', ['level', 'candle_size']],
  ['key level', LEVEL_Q, ['level']],
  ['major level', LEVEL_Q, ['level']],
  ['big', 'How big, in pips or ATR?', ['candle_size']],
  ['small', 'How small, in pips or ATR?', ['candle_size']],
  ['sharp', 'Sharp meaning a range above how many ATR?', ['candle_size']],
  ['momentum is', 'Momentum measured how: RSI above a value, or MACD above its signal line?', ['rsi', 'macd']],
  ['trending', 'Trending by structure (higher highs and lows) or by a moving average?', ['structure', 'price_vs_ma', 'ma_order']],
  ['choppy', 'Choppy meaning ATR below a value?', ['atr']],
  ['overextended', 'Overextended meaning how far from which average, in pips or ATR?', ['distance']],
  ['confirmation', CONFIRM_Q, ['level', 'candle_pattern']],
  ['confirms', CONFIRM_Q, ['level', 'candle_pattern']],
  ['near', 'Within how many pips or ATR?', ['level', 'distance']],
  ['close to', 'Within how many pips or ATR?', ['level', 'distance']],
  ['around', 'Within how many pips of what price?', ['distance']],
  ['approximately', NUMBER_Q, []],
  ['roughly', NUMBER_Q, []],
  ['about', NUMBER_Q, []],
  ['enough', 'How much is enough, as a number?', []],
  ['a lot', 'How many, as a number?', []],
  ['lots', 'How many, as a number?', []],
  ['usually', EVERY_TIME_Q, []],
  ['often', EVERY_TIME_Q, []],
  ['sometimes', EVERY_TIME_Q, []],
  ['probably', PREDICT_Q, []],
  ['likely', PREDICT_Q, []],
  ['should', 'Rules describe what you do. Which condition triggers it?', []],
  ['healthy pullback', 'A pullback of how much: to which average, or within how many ATR?', ['distance']],
  ['solid', 'Solid meaning what, in prices?', []],
  ['important', 'Which level, defined how?', ['level']],
  ['high probability', 'Probability is what testing measures. Which conditions define the setup?', []],
  ['textbook', DEFINITION_Q, ['candle_pattern']],
  ['perfect', DEFINITION_Q, ['candle_pattern']],
  ['when it makes sense', DECIDE_Q, []],
  ['at my discretion', DECIDE_Q, []],
  ['gut', DECIDE_Q, []],
  ['intuition', DECIDE_Q, []],
  ['smart money', BEHAVIOUR_Q, ['level', 'structure']],
  ['institutional', BEHAVIOUR_Q, ['level', 'structure']],
  ['fakeout', FAKE_Q, ['level']],
  ['fake out', FAKE_Q, ['level']],
]

const ALLOWED = ['major pair', 'major pairs', 'closes above', 'closes below', 'close above', 'close below']

const pattern = (phrase: string) =>
  new RegExp(`(?<![\\w'’])${phrase.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+')}(?![\\w'’])`, 'i')

const COMPILED = BANNED.map(([phrase, question, blocks]) => ({ phrase, re: pattern(phrase), question, blocks }))
const ALLOWED_RE = ALLOWED.map((p) => new RegExp(pattern(p).source, 'gi'))

export type VagueHit = { word: string; at: number; question: string; blocks: ConditionType[] }

/** Every banned word or phrase in `text`, in order of first appearance, without repeats. */
export function findVague(text: string): VagueHit[] {
  let cleaned = text
  for (const re of ALLOWED_RE) cleaned = cleaned.replace(re, (m) => ' '.repeat(m.length))
  const hits: VagueHit[] = []
  for (const { phrase, re, question, blocks } of COMPILED) {
    const m = re.exec(cleaned)
    if (m) hits.push({ word: phrase, at: m.index, question, blocks })
  }
  hits.sort((a, b) => a.at - b.at || b.word.length - a.word.length)
  const spans: [number, number][] = []
  return hits.filter((h) => {
    const span: [number, number] = [h.at, h.at + h.word.length]
    if (spans.some(([s, e]) => s <= span[0] && span[1] <= e)) return false
    spans.push(span)
    return true
  })
}
