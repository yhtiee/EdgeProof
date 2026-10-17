import { describe, expect, it } from 'vitest'
import type { CurriculumLevel } from './content'
import type { ExamStatus } from './exams'
import type { LessonState } from './progress'
import { academyPath, itemId, pathAccess, pathTo, placementBlocker } from './sequence'

const lesson = (slug: string) => ({ slug, title: slug.toUpperCase(), order: 1, minutes: 3, status: 'published' as const, questions: 0, screens: 2 })

const LEVELS = [
  {
    order: 1, slug: 'one', title: 'One', phase: 1, reading: [],
    modules: [
      { order: 1, slug: 'mod-a', title: 'A', lessons: [lesson('a1'), lesson('a2')] },
      { order: 2, slug: 'mod-b', title: 'B', lessons: [lesson('b1')] },
    ],
  },
  {
    order: 2, slug: 'two', title: 'Two', phase: 1, reading: [],
    modules: [{ order: 1, slug: 'mod-c', title: 'C', lessons: [lesson('c1')] }],
  },
] as CurriculumLevel[]

const exam = (key: string, level: number, passed = false) =>
  ({ key, title: `${key} exam`, scope: key.startsWith('m-') ? 'module' : key.startsWith('l-') ? 'level' : 'placement', level, passed }) as ExamStatus

const examsWith = (passed: string[] = []) =>
  Object.fromEntries(
    [exam('m-mod-a', 1), exam('m-mod-b', 1), exam('l-1', 1), exam('p-1', 1), exam('m-mod-c', 2)].map((e) => [
      e.key,
      { ...e, passed: passed.includes(e.key) },
    ]),
  )

const done: LessonState = { done: [0, 1], total: 2, complete: true, pendingSync: false }

describe('academyPath and pathAccess', () => {
  it('opens only the first lesson for a new learner', () => {
    const a = pathAccess(academyPath(LEVELS, {}, examsWith()))
    expect(a[itemId('lesson', 'a1')].locked).toBe(false)
    expect(a[itemId('lesson', 'a2')].locked).toBe(true)
    expect(a[itemId('exam', 'm-mod-a')].blocker?.key).toBe('a1')
  })

  it("puts each module's exam after its lessons, and the level exam last", () => {
    const keys = academyPath(LEVELS, {}, examsWith()).map((i) => i.key)
    expect(keys).toEqual(['a1', 'a2', 'm-mod-a', 'b1', 'm-mod-b', 'l-1', 'c1', 'm-mod-c'])
  })

  it('locks the next module until the module exam is passed', () => {
    const byLesson = { a1: done, a2: done }
    let a = pathAccess(academyPath(LEVELS, byLesson, examsWith()))
    expect(a[itemId('exam', 'm-mod-a')].locked).toBe(false)
    expect(a[itemId('lesson', 'b1')].blocker).toMatchObject({ kind: 'exam', key: 'm-mod-a' })
    a = pathAccess(academyPath(LEVELS, byLesson, examsWith(['m-mod-a'])))
    expect(a[itemId('lesson', 'b1')].locked).toBe(false)
  })

  it('counts a placement pass as the whole level done', () => {
    const items = academyPath(LEVELS, {}, examsWith(['p-1']))
    const a = pathAccess(items)
    expect(items.filter((i) => i.level === 1).every((i) => i.done)).toBe(true)
    expect(a[itemId('lesson', 'c1')].locked).toBe(false)
    expect(placementBlocker(items, 2)).toBeUndefined()
  })

  it('keeps later placement exams closed until earlier levels are done', () => {
    const items = academyPath(LEVELS, {}, examsWith())
    expect(placementBlocker(items, 1)).toBeUndefined()
    expect(placementBlocker(items, 2)?.key).toBe('a1')
  })

  it('falls back to lessons only when exam status is unknown (offline first visit)', () => {
    const items = academyPath(LEVELS, { a1: done }, undefined)
    expect(items.every((i) => i.kind === 'lesson')).toBe(true)
    expect(pathAccess(items)[itemId('lesson', 'a2')].locked).toBe(false)
  })

  it('opens everything in development but still reports what would lock', () => {
    const a = pathAccess(academyPath(LEVELS, {}, examsWith()), true)
    expect(a[itemId('lesson', 'c1')]).toMatchObject({ locked: false, wouldLock: true })
    expect(a[itemId('lesson', 'c1')].blocker?.key).toBe('a1')
    expect(a[itemId('lesson', 'a1')]).toMatchObject({ locked: false, wouldLock: false })
  })

  it('links blockers to the right screen', () => {
    expect(pathTo({ kind: 'exam', key: 'm-mod-a' })).toBe('/learn/exam/m-mod-a')
    expect(pathTo({ kind: 'lesson', key: 'a1' })).toBe('/learn/a1')
  })
})
