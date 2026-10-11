import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { Lock } from 'lucide-react'
import { Banner, buttonClass } from '../../components/ui'
import { useSession } from '../../lib/session'
import { lessonsInOrder, useCurriculum, useLesson } from './content'
import { LessonPlayer, LessonScene } from './lesson/LessonPlayer'
import { useLessonProgress } from './progress'
import { lessonAccess } from './sequence'

/**
 * /learn/:slug: a lesson for a signed-in learner, resuming where they
 * stopped. Lessons open in order (spec §5); a locked one points to the
 * lesson that comes first. The server enforces the same rule.
 */
export default function LessonPage() {
  const { slug } = useParams()
  const session = useSession()
  const userId = session.status === 'signed-in' ? session.me.id : undefined
  const lesson = useLesson(slug)
  const curriculum = useCurriculum()
  const progress = useLessonProgress(userId)

  const order = useMemo(() => (curriculum.data ? lessonsInOrder(curriculum.data) : []), [curriculum.data])
  const ref = order.find((l) => l.slug === slug)
  const next = useMemo(() => {
    const i = order.findIndex((l) => l.slug === slug)
    const n = i >= 0 ? order[i + 1] : undefined
    return n ? { to: `/learn/${n.slug}`, label: `Next: ${n.title}` } : undefined
  }, [order, slug])

  if (lesson.isError) {
    return (
      <main className="mx-auto grid w-full max-w-[680px] gap-4 px-4 py-10">
        <Banner kind="danger" title="Couldn't open this lesson">
          {(lesson.error as Error).message}
        </Banner>
        <Link to="/learn" className={`${buttonClass('secondary')} w-fit`}>
          Back to Learn
        </Link>
      </main>
    )
  }
  if (!lesson.data || progress.loading || !curriculum.data) {
    return (
      <div className="mx-auto w-full max-w-[680px] px-4 py-10" aria-busy="true">
        <div className="h-6 w-56 animate-pulse rounded-sm bg-surface motion-reduce:animate-none" />
        <div className="mt-6 h-40 animate-pulse rounded-md bg-surface motion-reduce:animate-none" />
      </div>
    )
  }

  const access = lessonAccess(order, progress.byLesson)[lesson.data.slug]
  if (access?.locked && access.blocker) {
    return (
      <main className="mx-auto grid w-full max-w-[680px] gap-6 px-4 py-10 md:py-16">
        <LessonScene pose="think" module={lesson.data.module} />
        <div>
          <p className="flex items-center gap-2 text-small font-semibold text-muted">
            <Lock className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Locked
          </p>
          <h1 className="mt-2 text-h1 md:text-h1-lg">{lesson.data.title}</h1>
          <p className="mt-3 text-lesson text-muted">
            Lessons open in order, so each one builds on the last. This one opens when you finish &ldquo;{access.blocker.title}&rdquo;.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Link to={`/learn/${access.blocker.slug}`} className={buttonClass('primary')}>
            Go to {access.blocker.title}
          </Link>
          <Link to="/learn" className="inline-flex min-h-11 items-center text-small font-semibold text-muted hover:text-text">
            Back to Learn
          </Link>
        </div>
      </main>
    )
  }

  const state = progress.byLesson[lesson.data.slug]
  const total = lesson.data.screens.length
  const complete = state && (state.complete || state.done.length >= total)
  const startAt = !state || complete ? 0 : (Array.from({ length: total }, (_, i) => i).find((i) => !state.done.includes(i)) ?? 0)

  return (
    <LessonPlayer
      key={lesson.data.slug}
      lesson={lesson.data}
      context={ref ? `Level ${ref.level.order} · ${ref.module.title}` : undefined}
      startAt={startAt}
      onScreenDone={(i) => progress.record(lesson.data.slug, i, total)}
      exitTo="/learn"
      exitLabel="Back to Learn"
      next={next}
    />
  )
}
