import { describe, expect, it } from 'vitest'
import { takeEvents } from './stream'

describe('explain stream', () => {
  it('parses complete events and keeps the unfinished tail', () => {
    const { events, rest } = takeEvents('data: {"type":"meta","remaining":3,"cached":false}\n\ndata: {"type":"text","text":"Hi"}\n\ndata: {"ty')
    expect(events).toEqual([{ type: 'meta', remaining: 3, cached: false }, { type: 'text', text: 'Hi' }])
    expect(rest).toBe('data: {"ty')
  })
})
