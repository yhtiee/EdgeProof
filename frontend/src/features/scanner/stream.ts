import { apiRaw } from '../../lib/api/client'

/** Server-sent events from POST /scanner/explain (same event shapes as the Academy tutor). */
export type ExplainEvent =
  | { type: 'meta'; remaining: number; cached: boolean }
  | { type: 'text'; text: string }
  | { type: 'reset' }
  | { type: 'done'; answer: string; cached: boolean }
  | { type: 'refused'; message: string }
  | { type: 'error'; code: string; message: string }

/** Splits a chunk buffer into complete `data:` events; returns the events and the unfinished remainder. */
export function takeEvents(buffer: string): { events: ExplainEvent[]; rest: string } {
  const events: ExplainEvent[] = []
  let rest = buffer
  let cut: number
  while ((cut = rest.indexOf('\n\n')) >= 0) {
    const line = rest.slice(0, cut).trim()
    rest = rest.slice(cut + 2)
    if (line.startsWith('data: ')) events.push(JSON.parse(line.slice(6)) as ExplainEvent)
  }
  return { events, rest }
}

export async function streamExplanation(body: { subject: string; factor?: string }, onEvent: (e: ExplainEvent) => void) {
  const res = await apiRaw('/scanner/explain', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
  })
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    const { events, rest } = takeEvents(buffer + decoder.decode(value, { stream: true }))
    buffer = rest
    events.forEach(onEvent)
  }
}
