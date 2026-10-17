import type { CurriculumLevel } from './content'
import type { ExamStatus } from './exams'
import type { LessonState } from './progress'

/**
 * The learning path (spec §5), mirroring academy_path on the server: within
 * each level, every module's lessons are followed by its module exam, and the
 * level ends with its level exam. Items open in order; done items stay open
 * for review. A passed placement or level exam counts the whole level as done.
 *
 * Exams come from /me/exams. Without them (first visit offline) the path
 * falls back to lessons only; the server still enforces the full order.
 */
export type PathItem = {
  kind: 'lesson' | 'exam'
  key: string
  title: string
  level: number
  done: boolean
}

/** `wouldLock`: what blocks this item on a deployed build, even when development opens every gate. */
export type Access = { locked: boolean; done: boolean; blocker?: PathItem; wouldLock: boolean }

export const itemId = (kind: PathItem['kind'], key: string) => `${kind}:${key}`

export function isComplete(screens: number, state: LessonState | undefined) {
  return !!state && (state.complete || state.done.length >= screens)
}

export function academyPath(
  levels: CurriculumLevel[],
  byLesson: Record<string, LessonState>,
  exams: Record<string, ExamStatus> | undefined,
): PathItem[] {
  const passed = (key: string) => !!exams?.[key]?.passed
  const items: PathItem[] = []
  for (const level of levels) {
    const skip = passed(`p-${level.order}`) || passed(`l-${level.order}`)
    for (const module of level.modules) {
      for (const lesson of module.lessons) {
        const done = skip || isComplete(lesson.screens, byLesson[lesson.slug])
        items.push({ kind: 'lesson', key: lesson.slug, title: lesson.title, level: level.order, done })
      }
      const exam = exams?.[`m-${module.slug}`]
      if (exam) items.push({ kind: 'exam', key: exam.key, title: exam.title, level: level.order, done: skip || exam.passed })
    }
    const levelExam = exams?.[`l-${level.order}`]
    if (levelExam) {
      const placed = passed(`p-${level.order}`)
      items.push({ kind: 'exam', key: levelExam.key, title: levelExam.title, level: level.order, done: placed || levelExam.passed })
    }
  }
  return items
}

/**
 * Locks for every item: an item is locked while anything before it is
 * unfinished. With `open` (development builds), nothing is locked but
 * `wouldLock` still says where a deployed build would lock.
 */
export function pathAccess(items: PathItem[], open = false): Record<string, Access> {
  const access: Record<string, Access> = {}
  let blocker: PathItem | undefined
  for (const item of items) {
    const wouldLock = !!blocker && !item.done
    access[itemId(item.kind, item.key)] = { locked: wouldLock && !open, done: item.done, blocker, wouldLock }
    if (!item.done && !blocker) blocker = item
  }
  return access
}

/** A placement exam opens once every earlier level is done. */
export function placementBlocker(items: PathItem[], level: number): PathItem | undefined {
  return items.find((i) => i.level < level && !i.done)
}

/** Where a blocker lives in the app. */
export const pathTo = (item: Pick<PathItem, 'kind' | 'key'>) =>
  item.kind === 'exam' ? `/learn/exam/${item.key}` : `/learn/${item.key}`
