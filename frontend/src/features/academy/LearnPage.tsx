import { useMemo } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, Check, CircleDashed, ClipboardCheck, Clock, ExternalLink, Lock } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Banner, DevGateNote, EmptyState, buttonClass } from '../../components/ui'
import { useSession } from '../../lib/session'
import { PROFILE_KEY, getProfile } from '../onboarding/api'
import { lessonsInOrder, useCurriculum, type CurriculumLevel, type LessonSummary } from './content'
import { percent, useMyExams, type ExamStatus } from './exams'
import { useLessonProgress, type LessonState } from './progress'
import { academyPath, itemId, pathAccess, pathTo, placementBlocker, type Access, type PathItem } from './sequence'

/**
 * Academy home (spec §5): Level → Module → Lesson, with each module's exam
 * after its lessons and the level exam at the end. Layout per DESIGN.md §5:
 * the path fills the left; "Up next", level progress and reading sit beside
 * it on wide screens. Experienced learners see placement offers up front
 * (ON-3); everyone else gets a quieter link.
 */
type Status = 'done' | 'started' | 'todo'

export default function LearnPage() {
  const session = useSession()
  const userId = session.status === 'signed-in' ? session.me.id : undefined
  const curriculum = useCurriculum()
  const progress = useLessonProgress(userId)
  const exams = useMyExams(userId)
  const profile = useQuery({ queryKey: PROFILE_KEY, queryFn: getProfile, enabled: !!userId, staleTime: 5 * 60_000 })
  const experienced = !!profile.data?.experience && profile.data.experience.years_trading !== 'none'

  const items = useMemo(
    () => (curriculum.data ? academyPath(curriculum.data.levels, progress.byLesson, exams.byKey) : []),
    [curriculum.data, progress.byLesson, exams.byKey],
  )
  const gatesOpen = session.status === 'signed-in' && !!session.me.gates_open
  const access = useMemo(() => pathAccess(items, gatesOpen), [items, gatesOpen])

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
  const status = (l: LessonSummary): Status => {
    if (access[itemId('lesson', l.slug)]?.done) return 'done'
    return progress.byLesson[l.slug]?.done.length ? 'started' : 'todo'
  }
  const upNext = items.find((i) => !i.done)
  const pending = Object.values(progress.byLesson).some((s) => s.pendingSync)

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
            <LevelSection
              key={level.slug}
              level={level}
              status={status}
              upNext={upNext}
              access={access}
              exams={exams.byKey}
              placementOpen={!placementBlocker(items, level.order) && items.some((i) => i.level === level.order && !i.done)}
              experienced={experienced}
            />
          ))}
        </div>

        <aside className="grid gap-6 lg:sticky lg:top-24">
          {upNext ? (
            <UpNext item={upNext} items={all} byLesson={progress.byLesson} exam={exams.byKey?.[upNext.key]} />
          ) : (
            <section className="rounded-lg border border-border bg-surface p-4 md:p-6">
              <p className="text-h3">Everything published is done</p>
              <p className="mt-1 text-small text-muted">New lessons and exams appear here as they&rsquo;re published.</p>
            </section>
          )}
          {curriculum.data.levels
            .filter((l) => l.modules.some((m) => m.lessons.length))
            .map((level) => {
              const steps = items.filter((i) => i.level === level.order)
              const done = steps.filter((i) => i.done).length
              return (
                <section key={level.slug} aria-label={`Level ${level.order} progress`}>
                  <div className="flex items-baseline justify-between gap-4 text-small">
                    <span className="font-semibold">
                      Level {level.order}: {level.title}
                    </span>
                    <span className="font-mono text-muted">
                      {done}/{steps.length}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-border" aria-hidden="true">
                    <div className="h-full rounded-full bg-text" style={{ width: `${steps.length ? (done / steps.length) * 100 : 0}%` }} />
                  </div>
                  {level.reading.length > 0 && (
                    <ul className="mt-3 grid gap-1">
                      {level.reading.map((r) => (
                        <li key={`${r.url}-${r.title}`} className="text-small">
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

function UpNext({
  item,
  items,
  byLesson,
  exam,
}: {
  item: PathItem
  items: ReturnType<typeof lessonsInOrder>
  byLesson: Record<string, LessonState>
  exam: ExamStatus | undefined
}) {
  if (item.kind === 'exam') {
    return (
      <section aria-labelledby="up-next" className="rounded-lg border border-border bg-surface p-4 md:p-6">
        <p className="text-small font-semibold text-muted">{exam?.in_progress ? 'Finish your exam' : 'Up next: an exam'}</p>
        <h2 id="up-next" className="mt-1 text-h2 md:text-h2-lg">
          {item.title}
        </h2>
        {exam && (
          <p className="mt-3 inline-flex items-center gap-2 text-small text-muted">
            <ClipboardCheck className="size-4" strokeWidth={1.75} aria-hidden="true" />
            {exam.draw_count} questions · pass mark {percent(exam.pass_mark)}
          </p>
        )}
        <Link to={pathTo(item)} className={`${buttonClass('primary', true)} mt-6`}>
          {exam?.in_progress ? 'Resume exam' : 'Go to exam'}
        </Link>
      </section>
    )
  }
  const lesson = items.find((l) => l.slug === item.key)
  if (!lesson) return null
  const started = !!byLesson[lesson.slug]?.done.length
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
  exams,
  placementOpen,
  experienced,
}: {
  level: CurriculumLevel
  status: (l: LessonSummary) => Status
  upNext: PathItem | undefined
  access: Record<string, Access>
  exams: Record<string, ExamStatus> | undefined
  placementOpen: boolean
  experienced: boolean
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

  const placement = exams?.[`p-${level.order}`]
  const levelExam = exams?.[`l-${level.order}`]
  const isNext = (kind: PathItem['kind'], key: string) => upNext?.kind === kind && upNext.key === key

  return (
    <section aria-labelledby={`level-${level.slug}`}>
      <h2 id={`level-${level.slug}`} className="text-h2 md:text-h2-lg">
        Level {level.order}: {level.title}
      </h2>

      {placement && placementOpen && !placement.passed && (
        experienced ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-surface p-4">
            <div className="min-w-0">
              <p className="text-body font-semibold">Already know this? Test out of Level {level.order}</p>
              <p className="mt-0.5 text-small text-muted">
                {placement.draw_count} questions · {percent(placement.pass_mark)} to pass · the whole level counts as done
              </p>
            </div>
            <Link to={pathTo({ kind: 'exam', key: placement.key })} className={buttonClass('secondary')}>
              Take placement exam
            </Link>
          </div>
        ) : (
          <p className="mt-2 text-small text-muted">
            Know this already?{' '}
            <Link to={pathTo({ kind: 'exam', key: placement.key })} className="inline-flex min-h-11 items-center font-semibold text-text underline underline-offset-4">
              Take the placement exam
            </Link>
          </p>
        )
      )}
      {placement?.passed && <p className="mt-2 text-small text-muted">Placed out with {percent(placement.best_score ?? 0)}. The lessons stay open to read.</p>}

      <ol className="mt-4 grid">
        {level.modules.map((module) => {
          if (module.lessons.length === 0) {
            // Unwritten modules stay visible (the honest shape of the course) in one compact line.
            return (
              <li key={module.slug} className="flex min-h-11 items-center justify-between gap-4 border-t border-border">
                <h3 className="text-small font-semibold text-subtle">
                  {module.order}. {module.title}
                </h3>
                <span className="shrink-0 text-caption text-subtle">Being written</span>
              </li>
            )
          }
          const exam = exams?.[`m-${module.slug}`]
          return (
            <li key={module.slug} className="border-t border-border pb-4 pt-3">
              <h3 className="text-small font-semibold text-muted">
                {module.order}. {module.title}
              </h3>
              <ol className="mt-2 grid gap-1">
                {module.lessons.map((lesson) => {
                  const lock = access[itemId('lesson', lesson.slug)]
                  if (lock?.locked) {
                    return <LockedRow key={lesson.slug} title={lesson.title} meta={`${lesson.minutes} min`} blocker={lock.blocker} />
                  }
                  const s = status(lesson)
                  const current = isNext('lesson', lesson.slug)
                  return (
                    <li key={lesson.slug}>
                      <Link
                        to={`/learn/${lesson.slug}`}
                        className={`flex min-h-12 items-center gap-3 rounded-md px-3 hover:bg-surface ${current ? 'bg-surface' : ''}`}
                        aria-current={current ? 'step' : undefined}
                      >
                        <StatusIcon status={s} current={current} />
                        <span className="min-w-0 flex-1 text-body">{lesson.title}</span>
                        {lock?.wouldLock && <DevGateNote compact>Locked when deployed</DevGateNote>}
                        <span className="shrink-0 font-mono text-caption text-subtle">{lesson.minutes} min</span>
                        <span className="sr-only">
                          {s === 'done' ? ', done' : s === 'started' ? ', started' : ''}
                          {lesson.status === 'draft' ? ', draft' : ''}
                        </span>
                      </Link>
                    </li>
                  )
                })}
                {exam && <ExamRow exam={exam} label="Module exam" access={access[itemId('exam', exam.key)]} current={isNext('exam', exam.key)} />}
              </ol>
            </li>
          )
        })}
      </ol>
      {levelExam && (
        <ol className="grid border-t border-border pt-3">
          <ExamRow exam={levelExam} label={`Level ${level.order} exam`} access={access[itemId('exam', levelExam.key)]} current={isNext('exam', levelExam.key)} />
        </ol>
      )}
    </section>
  )
}

function LockedRow({ title, meta, blocker }: { title: string; meta: string; blocker?: PathItem }) {
  return (
    <li>
      <div className="flex min-h-12 items-center gap-3 rounded-md px-3 text-subtle" aria-disabled="true">
        <Lock className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        <span className="min-w-0 flex-1 text-body">{title}</span>
        <span className="shrink-0 font-mono text-caption">{meta}</span>
        <span className="sr-only">, locked. Opens after {blocker?.title}.</span>
      </div>
    </li>
  )
}

function ExamRow({ exam, label, access, current }: { exam: ExamStatus; label: string; access: Access | undefined; current: boolean }) {
  const meta = `${exam.draw_count} questions`
  if (access?.locked) return <LockedRow title={label} meta={meta} blocker={access.blocker} />
  const done = !!access?.done
  const cooling = !done && exam.cooldown_until && new Date(exam.cooldown_until).getTime() > Date.now()
  const note = done
    ? exam.passed && exam.best_score !== null
      ? `Passed · ${percent(exam.best_score)}`
      : 'Done'
    : cooling
      ? 'Review time'
      : exam.in_progress
        ? 'In progress'
        : exam.attempts
          ? `Best ${percent(exam.best_score ?? 0)} · ${percent(exam.pass_mark)} to pass`
          : `${percent(exam.pass_mark)} to pass`
  return (
    <li>
      <Link
        to={pathTo({ kind: 'exam', key: exam.key })}
        className={`flex min-h-12 items-center gap-3 rounded-md px-3 hover:bg-surface ${current ? 'bg-surface' : ''}`}
        aria-current={current ? 'step' : undefined}
      >
        {done ? (
          <StatusIcon status="done" current={false} />
        ) : (
          <ClipboardCheck className={`size-6 shrink-0 ${current ? 'text-accent-text' : 'text-muted'}`} strokeWidth={1.75} aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1 text-body font-semibold">{label}</span>
        {access?.wouldLock && <DevGateNote compact>Locked when deployed</DevGateNote>}
        <span className="shrink-0 text-caption text-subtle">{note}</span>
        <span className="sr-only">, {meta}</span>
      </Link>
    </li>
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
