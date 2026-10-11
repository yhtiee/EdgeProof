import type { LessonRef } from './content'
import type { LessonState } from './progress'

/**
 * Lessons open in order (spec §5): a lesson unlocks when every earlier
 * lesson is complete. Completed lessons stay open for review. The server
 * enforces the same rule when saving progress.
 */
export type LessonAccess = { locked: boolean; complete: boolean; blocker?: LessonRef }

export function isComplete(lesson: LessonRef, state: LessonState | undefined) {
  return !!state && (state.complete || state.done.length >= lesson.screens)
}

export function lessonAccess(ordered: LessonRef[], byLesson: Record<string, LessonState>): Record<string, LessonAccess> {
  const access: Record<string, LessonAccess> = {}
  let blocker: LessonRef | undefined
  for (const lesson of ordered) {
    const complete = isComplete(lesson, byLesson[lesson.slug])
    access[lesson.slug] = { locked: !!blocker && !complete, complete, blocker }
    if (!complete && !blocker) blocker = lesson
  }
  return access
}
