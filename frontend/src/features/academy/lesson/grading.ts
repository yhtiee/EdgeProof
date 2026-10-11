import type { QuestionBlock } from '../content'

/**
 * Practice-question checking (AC-4). Numeric answers accept commas and
 * spaces and are right within the question's tolerance.
 */
export type Response = string

export function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/[\s,]/g, '').replace(/[−–]/g, '-')
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return null
  return Number(cleaned)
}

export function isAnswered(q: QuestionBlock, response: Response): boolean {
  return q.kind === 'mc' ? response !== '' : parseNumber(response) !== null
}

export function isCorrect(q: QuestionBlock, response: Response): boolean {
  if (q.kind === 'mc') return response === q.answer
  const n = parseNumber(response)
  return n !== null && Math.abs(n - q.answer) <= q.tolerance + 1e-9
}
