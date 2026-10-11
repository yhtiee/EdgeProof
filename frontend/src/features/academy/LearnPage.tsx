import { Link } from 'react-router'
import { BookOpen, Check, CircleDashed, Clock, ExternalLink, Lock } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Banner, EmptyState, buttonClass } from '../../components/ui'
import { useSession } from '../../lib/session'
import { lessonsInOrder, useCurriculum, type CurriculumLevel, type LessonRef, type LessonSummary } from './content'
import { useLessonProgress, type LessonState } from './progress'
import { lessonAccess, type LessonAccess } from './sequence'

/**
 * Academy home (spec §5): Level → Module → Lesson, with the learner's
 * position. Layout per DESIGN.md §5: the path fills the left; "Up next",
 * level progress and reading sit beside it on wide screens.
 */
type Status = 'done' | 'started' | 'todo'

function statusOf(lesson: LessonSummary, state: LessonState | undefined): Status {
  if (!state) return 'todo'
  if (state.complete || state.done.length >= lesson.screens) return 'done'
  return state.done.length ? 'started' : 'todo'
}

export default function LearnPage() {
  const session = useSession()
  const userId = session.status === 'signed-in' ? session.me.id : undefined
  const curriculum = useCurriculum()
  const progress = useLessonProgress(userId)

  if (curriculum.isError) {
    return (
      <div>
        <PageHeader title="Learn" />
        <Banner kind="danger" title="Couldn't load the curriculum">
          {(curriculum.error as Error).message} Reload the page to try again.
        </Banner>
      </div>
    )
  }
  if (!curriculum.data) {
    return (
      <div aria-busy="true">
        <PageHeader title="Learn" />
        <div className="h-64 animate-pulse rounded-md bg-surface motion-reduce:animate-none" />
      </div>
    )
  }

  const all = lessonsInOrder(curriculum.data)
  const status = (l: LessonSummary) => statusOf(l, progress.byLesson[l.slug])
  const upNext = all.find((l) => status(l) === 'started') ?? all.find((l) => status(l) !== 'done')
  const pending = Object.values(progress.byLesson).some((s) => s.pendingSync)
  const access = lessonAccess(all, progress.byLesson)

  if (!all.length) {
    return (
      <div>
        <PageHeader title="Learn" description="The Academy: seven levels, from how forex works to strategy design." />
        <EmptyState message="The first lessons are being written. Level 1 opens here as soon as they're published." />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Learn" description="Seven levels, from how forex works to strategy design. Lessons work offline once opened." />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start lg:gap-12">
        <div className="grid gap-10">
          {curriculum.data.levels.map((level) => (
            <LevelSection key={level.slug} level={level} status={status} upNext={upNext?.slug} access={access} />
          ))}
        </div>

        <aside className="grid gap-6 lg:sticky lg:top-24">
          {upNext ? (
            <UpNext lesson={upNext} started={status(upNext) === 'started'} />
          ) : (
            <section className="rounded-lg border border-border bg-surface p-4 md:p-6">
              <p className="text-h3">All published lessons done</p>
              <p className="mt-1 text-small text-muted">New lessons appear here as they&rsquo;re published.</p>
            </section>
          )}
          {curriculum.data.levels
            .filter((l) => l.modules.some((m) => m.lessons.length))
            .map((level) => {
              const lessons = level.modules.flatMap((m) => m.lessons)
              const done = lessons.filter((l) => status(l) === 'done').length
              return (
                <section key={level.slug} aria-label={`Level ${level.order} progress`}>
                  <div className="flex items-baseline justify-between gap-4 text-small">
                    <span className="font-semibold">
                      Level {level.order}: {level.title}
                    </span>
                    <span className="font-mono text-muted">
                      {done}/{lessons.length}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-border" aria-hidden="true">
                    <div className="h-full rounded-full bg-text" style={{ width: `${(done / lessons.length) * 100}%` }} />
                  </div>
                  {level.reading.length > 0 && (
                    <ul className="mt-3 grid gap-1">
                      {level.reading.map((r) => (
                        <li key={r.title} className="text-small">
                          <a href={r.url} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-11 items-center gap-2 text-muted hover:text-text">
                            <BookOpen className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                            <span>
                              {r.title}, {r.author} <span className="text-subtle">({r.access === 'free' ? 'free' : 'optional, paid'})</span>
                              {level.reading_note && <span className="text-subtle"> · {level.reading_note}</span>}
                            </span>
                            <ExternalLink className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )
            })}
          {pending && (
            <p className="text-caption text-subtle" role="status">
              Saved on this device · Syncing when the server is reachable
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}

function UpNext({ lesson, started }: { lesson: LessonRef; started: boolean }) {
  return (
    <section aria-labelledby="up-next" className="rounded-lg border border-border bg-surface p-4 md:p-6">
      <p className="text-small font-semibold text-muted">{started ? 'Continue where you stopped' : 'Up next'}</p>
      <h2 id="up-next" className="mt-1 text-h2 md:text-h2-lg">
        {lesson.title}
      </h2>
      <p className="mt-1 text-small text-muted">
        Level {lesson.level.order} · {lesson.module.title}
      </p>
      <p className="mt-3 inline-flex items-center gap-2 text-small text-muted">
        <Clock className="size-4" strokeWidth={1.75} aria-hidden="true" />
        About {lesson.minutes} minutes
        {lesson.questions > 0 && ` · ${lesson.questions} practice ${lesson.questions === 1 ? 'question' : 'questions'}`}
      </p>
      <Link to={`/learn/${lesson.slug}`} className={`${buttonClass('primary', true)} mt-6`}>
        {started ? 'Continue lesson' : 'Start lesson'}
      </Link>
    </section>
  )
}

function LevelSection({
  level,
  status,
  upNext,
  access,
}: {
  level: CurriculumLevel
  status: (l: LessonSummary) => Status
  upNext: string | undefined
  access: Record<string, LessonAccess>
}) {
  const hasLessons = level.modules.some((m) => m.lessons.length)
  if (!hasLessons) {
    return (
      <section aria-labelledby={`level-${level.slug}`} className="border-t border-border pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id={`level-${level.slug}`} className="text-h3 text-muted">
            Level {level.order}: {level.title}
          </h2>
          <p className="text-small text-subtle">{level.phase > 1 ? `Opens in phase ${level.phase}` : 'Being written'}</p>
        </div>
        {level.modules.length > 0 && (
          <p className="mt-1 max-w-[80ch] text-small text-subtle">
            <span className="sr-only">Modules: </span>
            {level.modules.map((m) => m.title).join(' · ')}
          </p>
        )}
      </section>
    )
  }

  return (
    <section aria-labelledby={`level-${level.slug}`}>
      <h2 id={`level-${level.slug}`} className="text-h2 md:text-h2-lg">
        Level {level.order}: {level.title}
      </h2>
      <ol className="mt-4 grid">
        {level.modules.map((module) =>
          module.lessons.length === 0 ? (
            // Unwritten modules stay visible (the honest shape of the course) in one compact line.
            <li key={module.slug} className="flex min-h-11 items-center justify-between gap-4 border-t border-border">
              <h3 className="text-small font-semibold text-subtle">
                {module.order}. {module.title}
              </h3>
              <span className="shrink-0 text-caption text-subtle">Being written</span>
            </li>
          ) : (
          <li key={module.slug} className="border-t border-border pb-4 pt-3">
            <h3 className="text-small font-semibold text-muted">
              {module.order}. {module.title}
            </h3>
            {module.lessons.length ? (
              <ol className="mt-2 grid gap-1">
                {module.lessons.map((lesson) => {
                  const s = status(lesson)
                  const current = lesson.slug === upNext
                  const lock = access[lesson.slug]
                  if (lock?.locked) {
                    return (
                      <li key={lesson.slug}>
                        <div className="flex min-h-12 items-center gap-3 rounded-md px-3 text-subtle" aria-disabled="true">
                          <Lock className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                          <span className="min-w-0 flex-1 text-body">{lesson.title}</span>
                          <span className="shrink-0 font-mono text-caption">{lesson.minutes} min</span>
                          <span className="sr-only">, locked. Opens after {lock.blocker?.title}.</span>
                        </div>
                      </li>
                    )
                  }
                  return (
                    <li key={lesson.slug}>
                      <Link
                        to={`/learn/${lesson.slug}`}
                        className={`flex min-h-12 items-center gap-3 rounded-md px-3 hover:bg-surface ${current ? 'bg-surface' : ''}`}
                        aria-current={current ? 'step' : undefined}
                      >
                        <StatusIcon status={s} current={current} />
                        <span className="min-w-0 flex-1 text-body">{lesson.title}</span>
                        <span className="shrink-0 font-mono text-caption text-subtle">{lesson.minutes} min</span>
                        <span className="sr-only">
                          {s === 'done' ? ', done' : s === 'started' ? ', started' : ''}
                          {lesson.status === 'draft' ? ', draft' : ''}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ol>
            ) : null}
          </li>
          ),
        )}
      </ol>
    </section>
  )
}

function StatusIcon({ status, current }: { status: Status; current: boolean }) {
  if (status === 'done') {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-text text-bg" aria-hidden="true">
        <Check className="size-3.5" strokeWidth={2.5} />
      </span>
    )
  }
  if (current) return <span className="size-6 shrink-0 rounded-full border-[6px] border-accent" aria-hidden="true" />
  if (status === 'started') return <CircleDashed className="size-6 shrink-0 text-muted" strokeWidth={1.75} aria-hidden="true" />
  return <span className="size-6 shrink-0 rounded-full border border-control" aria-hidden="true" />
}
