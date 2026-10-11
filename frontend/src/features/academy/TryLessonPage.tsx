import { Navigate } from 'react-router'
import { useCurriculum, useLesson, lessonsInOrder } from './content'
import { LessonPlayer } from './lesson/LessonPlayer'

/**
 * /try: visitors take Level 1, Lesson 1 before signing up (spec §4).
 * Nothing is saved. If no lesson is published yet, the simulator page
 * stands in.
 */
export default function TryLessonPage() {
  const curriculum = useCurriculum()
  const first = curriculum.data ? lessonsInOrder(curriculum.data).find((l) => l.level.order === 1) : undefined
  const lesson = useLesson(first?.slug)

  if (curriculum.data && !first) return <Navigate to="/try/position-size" replace />
  if (curriculum.isError || lesson.isError) return <Navigate to="/try/position-size" replace />
  if (!lesson.data) {
    return (
      <div className="px-4 py-10 md:px-6 lg:px-8" aria-busy="true">
        <div className="h-40 max-w-[680px] animate-pulse rounded-md bg-surface motion-reduce:animate-none" />
      </div>
    )
  }
  return (
    <LessonPlayer
      lesson={lesson.data}
      context={`Level 1 · ${first?.module.title ?? 'Foundations'}`}
      exitTo="/"
      exitLabel="Back to the home page"
      visitor
    />
  )
}
