import { describe, expect, it } from 'vitest'
import type { LessonRef } from './content'
import { lessonAccess } from './sequence'

const ref = (slug: string) => ({ slug, screens: 3 }) as LessonRef

describe('lessonAccess', () => {
  const order = [ref('a'), ref('b'), ref('c')]

  it('opens only the first lesson for a new learner', () => {
    const a = lessonAccess(order, {})
    expect([a.a.locked, a.b.locked, a.c.locked]).toEqual([false, true, true])
    expect(a.c.blocker?.slug).toBe('a')
  })

  it('opens the next lesson once the previous is complete', () => {
    const a = lessonAccess(order, { a: { done: [0, 1, 2], total: 3, complete: true, pendingSync: false } })
    expect([a.a.locked, a.b.locked, a.c.locked]).toEqual([false, false, true])
  })

  it('keeps a partly done lesson open and later ones locked', () => {
    const a = lessonAccess(order, {
      a: { done: [0, 1, 2], total: 3, complete: true, pendingSync: false },
      b: { done: [0], total: 3, complete: false, pendingSync: true },
    })
    expect(a.b.locked).toBe(false)
    expect(a.c.locked).toBe(true)
    expect(a.c.blocker?.slug).toBe('b')
  })
})
