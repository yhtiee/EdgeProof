import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { CircleCheck, CircleX, Clock, Flag, Lock, X } from 'lucide-react'
import { Banner, Button, DevGateNote, buttonClass } from '../../components/ui'
import { ApiError } from '../../lib/api/client'
import { ME_KEY, useSession } from '../../lib/session'
import { useCurriculum } from './content'
import {
  MY_EXAMS,
  clearAnswers,
  loadAnswers,
  percent,
  reportQuestion,
  saveAnswers,
  startAttempt,
  submitAttempt,
  untilLabel,
  useMyExams,
  type Attempt,
  type ExamResult,
  type ExamStatus,
} from './exams'
import { parseNumber } from './lesson/grading'
import { Mascot, type MascotPose } from './lesson/Mascot'
import { ModuleArt } from './lesson/ModuleArt'
import { pathTo } from './sequence'

/**
 * /learn/exam/:key: a module, level or placement exam (spec §5, AC-5 to AC-8).
 *
 * Same stage as a lesson (one centred column, DESIGN.md §12), but no
 * feedback until the end: questions are drawn and graded on the server, and
 * the result says which questions were missed and which lessons to review,
 * never the answers, so a retake stays fair.
 */
const STAGE = 'mx-auto w-full max-w-[680px]'

type Phase =
  | { kind: 'intro' }
  | { kind: 'taking'; attempt: Attempt }
  | { kind: 'result'; attempt: Attempt; result: ExamResult }

export default function ExamPage() {
  const { key = '' } = useParams()
  const session = useSession()
  const userId = session.status === 'signed-in' ? session.me.id : undefined
  const exams = useMyExams(userId)
  const curriculum = useCurriculum()
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' })
  const exam = exams.byKey?.[key]

  const context = useMemo(() => {
    if (!exam || !curriculum.data) return undefined
    const level = curriculum.data.levels.find((l) => l.order === exam.level)
    const module = level?.modules.find((m) => m.slug === exam.module)
    return `Level ${exam.level}${module ? ` · ${module.title}` : level ? ` · ${level.title}` : ''}`
  }, [exam, curriculum.data])

  if (exams.loading) {
    return (
      <div className={`${STAGE} px-4 py-10`} aria-busy="true">
        <div className="h-6 w-56 animate-pulse rounded-sm bg-surface motion-reduce:animate-none" />
        <div className="mt-6 h-40 animate-pulse rounded-md bg-surface motion-reduce:animate-none" />
      </div>
    )
  }
  if (!exam) {
    return (
      <main className={`${STAGE} grid gap-4 px-4 py-10`}>
        <Banner kind={exams.error ? 'danger' : 'info'} title={exams.error ? "Couldn't load this exam" : 'Exam not found'}>
          {exams.error
            ? `${(exams.error as Error).message} Exams need a connection, because they're graded on the server.`
            : "This exam isn't published, or the link is wrong."}
        </Banner>
        <Link to="/learn" className={`${buttonClass('secondary')} w-fit`}>
          Back to Learn
        </Link>
      </main>
    )
  }

  if (phase.kind === 'taking') {
    return (
      <ExamRunner
        attempt={phase.attempt}
        context={context}
        onDone={(result) => {
          clearAnswers(phase.attempt.id)
          setPhase({ kind: 'result', attempt: phase.attempt, result })
        }}
      />
    )
  }
  if (phase.kind === 'result') {
    return (
      <ExamResultView
        exam={exam}
        attempt={phase.attempt}
        result={phase.result}
        context={context}
        onRetake={(attempt) => setPhase({ kind: 'taking', attempt })}
      />
    )
  }
  return <ExamIntro exam={exam} context={context} onStart={(attempt) => setPhase({ kind: 'taking', attempt })} />
}

function ExamScene({ pose, module }: { pose: MascotPose; module: string | null }) {
  return (
    <div className="flex items-end justify-center gap-4 rounded-lg border border-border bg-surface px-6 pb-4 pt-6" aria-hidden="true">
      <Mascot pose={pose} className="h-20 w-20 md:h-24 md:w-24" />
      {module && <ModuleArt module={module} className="h-24 w-24 md:h-28 md:w-28" />}
    </div>
  )
}

function TopBar({ title, context, right, progress }: { title: string; context?: string; right?: string; progress?: [number, number] }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface">
      <div className={`${STAGE} flex min-h-14 items-center gap-2 px-2 md:px-0`}>
        <Link
          to="/learn"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted hover:bg-raised hover:text-text md:-ml-3"
          aria-label="Back to Learn"
        >
          <X className="size-5" strokeWidth={1.75} aria-hidden="true" />
        </Link>
        <div className="min-w-0 flex-1">
          {context && <p className="truncate text-caption text-subtle">{context}</p>}
          <p className="truncate text-small font-semibold">{title}</p>
        </div>
        {right && (
          <span className="shrink-0 pr-2 font-mono text-caption text-muted md:pr-0" aria-live="polite">
            {right}
          </span>
        )}
      </div>
      {progress && (
        <div
          className="h-1 bg-border"
          role="progressbar"
          aria-label="Exam progress"
          aria-valuemin={0}
          aria-valuemax={progress[1]}
          aria-valuenow={progress[0]}
        >
          <div className="h-full bg-accent transition-[width] duration-[var(--motion-base)] ease-standard" style={{ width: `${(progress[0] / progress[1]) * 100}%` }} />
        </div>
      )}
    </header>
  )
}

const SCOPE_LABEL = { module: 'Module exam', level: 'Level exam', placement: 'Placement exam' } as const

function ExamIntro({ exam, context, onStart }: { exam: ExamStatus; context?: string; onStart: (a: Attempt) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ title: string; body: string; next?: { kind: 'lesson' | 'exam'; key: string } } | null>(null)
  const [cooldown, setCooldown] = useState(exam.cooldown_until)
  const queryClient = useQueryClient()

  const start = async () => {
    setBusy(true)
    setError(null)
    try {
      onStart(await startAttempt(exam.key))
    } catch (err) {
      if (err instanceof ApiError && err.code === 'exam_cooldown') {
        setCooldown(String(err.data.cooldown_until))
      } else if (err instanceof ApiError && err.code === 'exam_locked') {
        setError({ title: 'Not open yet', body: err.message, next: err.data.next as { kind: 'lesson' | 'exam'; key: string } })
        void queryClient.invalidateQueries({ queryKey: MY_EXAMS })
      } else {
        setError({ title: "Couldn't start the exam", body: (err as Error).message })
      }
    } finally {
      setBusy(false)
    }
  }

  if (exam.locked && exam.blocker) {
    return (
      <>
        <TopBar title={exam.title} context={context} />
        <main className={`${STAGE} grid gap-6 px-4 py-10 md:py-16`}>
          <ExamScene pose="think" module={exam.module} />
          <div>
            <p className="flex items-center gap-2 text-small font-semibold text-muted">
              <Lock className="size-4" strokeWidth={1.75} aria-hidden="true" />
              Locked
            </p>
            <h1 className="mt-2 text-h1 md:text-h1-lg">{exam.title}</h1>
            <p className="mt-3 text-lesson text-muted">
              {exam.scope === 'placement'
                ? `Placement for Level ${exam.level} opens once the levels before it are done.`
                : 'The exam opens when every lesson before it is done.'}{' '}
              Next up: &ldquo;{exam.blocker.title}&rdquo;.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link to={pathTo(exam.blocker)} className={buttonClass('primary')}>
              Go to {exam.blocker.title}
            </Link>
            <Link to="/learn" className="inline-flex min-h-11 items-center text-small font-semibold text-muted hover:text-text">
              Back to Learn
            </Link>
          </div>
        </main>
      </>
    )
  }

  const cooling = cooldown && new Date(cooldown).getTime() > Date.now()
  return (
    <>
      <TopBar title={exam.title} context={context} />
      <main className={`${STAGE} grid gap-6 px-4 pb-32 pt-8 md:pt-12`}>
        <ExamScene pose={exam.passed ? 'cheer' : 'wave'} module={exam.module} />
        {!exam.locked && exam.blocker && (
          <DevGateNote>When deployed, this exam opens after &ldquo;{exam.blocker.title}&rdquo;.</DevGateNote>
        )}
        <div>
          <p className="text-small font-semibold text-accent-text">{SCOPE_LABEL[exam.scope]}</p>
          <h1 className="mt-2 text-h1 md:text-h1-lg">{exam.title}</h1>
          <p className="mt-3 text-lesson text-muted">
            {exam.scope === 'placement'
              ? `Already know this material? Pass with ${percent(exam.pass_mark)} or more and the whole of Level ${exam.level} counts as done. If you don't, nothing is lost: start with the lessons.`
              : exam.scope === 'level'
                ? `This checks everything in Level ${exam.level}. Pass it to finish the level.`
                : 'A short check on this module. Pass it to open the next module.'}
          </p>
        </div>

        <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border grid-cols-3">
          <Fact label="Questions" value={String(exam.draw_count)} />
          <Fact label="Pass mark" value={percent(exam.pass_mark)} />
          <Fact
            label={exam.passed ? 'Best score' : 'Attempts'}
            value={exam.passed && exam.best_score !== null ? percent(exam.best_score) : String(exam.attempts)}
          />
        </dl>

        <ul className="grid gap-2 text-body text-muted">
          <li>· One question at a time. You can go back and change answers before you submit.</li>
          <li>· You&rsquo;ll see your score and which questions you missed at the end, with the lessons to review.</li>
          <li>· Answers aren&rsquo;t shown, so a retake stays a fair test. You can retake once straight away; after a second miss in a row, there&rsquo;s a 24-hour pause to review.</li>
        </ul>

        {cooling && (
          <Banner kind="info" title="Review time">
            You can take this exam again {untilLabel(cooldown!)}. Use the time to go back over the lessons you missed.
          </Banner>
        )}
        {error && (
          <Banner kind="danger" title={error.title}>
            {error.body}{' '}
            {error.next && (
              <Link to={pathTo(error.next)} className="font-semibold underline">
                Go there
              </Link>
            )}
          </Banner>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className={`${STAGE} flex items-center gap-3 px-4 py-4 md:px-0`}>
          <span className="hidden flex-1 items-center gap-2 text-caption text-subtle md:flex">
            <Clock className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
            About {Math.max(2, Math.round(exam.draw_count * 0.75))} minutes · no time limit
          </span>
          <Button className="flex-1 md:flex-none" onClick={start} disabled={busy || !!cooling} autoFocus>
            {busy ? 'Starting…' : exam.in_progress ? 'Resume exam' : exam.passed ? 'Take it again' : 'Start exam'}
          </Button>
        </div>
      </div>
    </>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-4 py-3">
      <dt className="text-caption text-subtle">{label}</dt>
      <dd className="mt-0.5 font-mono text-h3">{value}</dd>
    </div>
  )
}

function ExamRunner({ attempt, context, onDone }: { attempt: Attempt; context?: string; onDone: (r: ExamResult) => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>(() => loadAnswers(attempt.id))
  const [index, setIndex] = useState(() => {
    const first = attempt.questions.findIndex((q) => !(q.id in loadAnswers(attempt.id)))
    return first < 0 ? attempt.questions.length - 1 : first
  })
  const [submitting, setSubmitting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const headingRef = useRef<HTMLParagraphElement>(null)
  const promptId = useId()

  const questions = attempt.questions
  const q = questions[index]
  const total = questions.length
  const last = index === total - 1
  const answered = (id: string) => {
    const v = answers[id]
    const question = questions.find((x) => x.id === id)!
    return v !== undefined && v !== '' && (question.type !== 'numeric' || parseNumber(v) !== null)
  }
  const unanswered = questions.filter((x) => !answered(x.id)).length

  useEffect(() => {
    headingRef.current?.focus()
  }, [index])

  const set = (v: string) => {
    const next = { ...answers, [q.id]: v }
    setAnswers(next)
    saveAnswers(attempt.id, next)
  }

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const body = Object.fromEntries(
        questions.map((x) => [x.id, x.type === 'numeric' ? (parseNumber(answers[x.id] ?? '') ?? '') : (answers[x.id] ?? '')]),
      )
      const result = await submitAttempt(attempt.id, body)
      void queryClient.invalidateQueries({ queryKey: MY_EXAMS })
      void queryClient.invalidateQueries({ queryKey: ['lesson-progress'] })
      if (result.gate_2_passed) void queryClient.invalidateQueries({ queryKey: ME_KEY })
      onDone(result)
    } catch (err) {
      setError(`${(err as Error).message} Your answers are saved on this device; try again when you're back online.`)
      setSubmitting(false)
    }
  }

  const forward = (e?: FormEvent) => {
    e?.preventDefault()
    if (!last) setIndex(index + 1)
    else if (unanswered > 0 && !confirming) setConfirming(true)
    else void submit()
  }

  return (
    <>
      <TopBar title={attempt.exam.title} context={context} right={`${index + 1}/${total}`} progress={[index + 1, total]} />
      <main className={`${STAGE} px-4 pb-40 pt-8 md:pt-12`}>
        <form key={q.id} onSubmit={forward} className="ep-screen-in grid gap-5" noValidate>
          <div>
            <p className="text-small font-semibold text-accent-text">
              Question {index + 1} of {total}
            </p>
            <p ref={headingRef} tabIndex={-1} id={promptId} className="mt-2 text-h3 outline-none md:text-h2-lg md:leading-snug">
              {q.prompt}
            </p>
          </div>
          {q.type === 'multiple_choice' ? (
            <div role="radiogroup" aria-labelledby={promptId} className="grid gap-2">
              {q.options.map((o, i) => {
                const selected = answers[q.id] === o.key
                return (
                  <label
                    key={o.key}
                    className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-md border px-4 py-3 transition-colors duration-[var(--motion-fast)] ease-standard has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${
                      selected ? 'border-text bg-raised' : 'border-border bg-surface hover:border-control'
                    }`}
                  >
                    <input type="radio" name={q.id} value={o.key} checked={selected} onChange={() => set(o.key)} className="sr-only" />
                    <span
                      className={`flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-caption ${
                        selected ? 'border-text bg-text text-bg' : 'border-control text-muted'
                      }`}
                      aria-hidden="true"
                    >
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="text-lesson">{o.text}</span>
                  </label>
                )
              })}
            </div>
          ) : (
            <div className="max-w-[320px]">
              <label htmlFor={`${promptId}-n`} className="mb-1 block text-small font-semibold">
                Your answer
              </label>
              <div className="relative">
                <input
                  id={`${promptId}-n`}
                  inputMode="decimal"
                  autoComplete="off"
                  value={answers[q.id] ?? ''}
                  onChange={(e) => set(e.target.value)}
                  aria-describedby={promptId}
                  className="block min-h-12 w-full rounded-sm border border-control bg-raised px-3 pr-16 font-mono text-h3"
                />
                {q.unit && (
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-small text-subtle">
                    {q.unit}
                  </span>
                )}
              </div>
              {answers[q.id] && parseNumber(answers[q.id]) === null && (
                <p className="mt-1 text-small text-loss">Enter a number, like 25 or 0.5.</p>
              )}
            </div>
          )}
          <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
        </form>

        {/* Jump to any question; answered ones are filled. */}
        <nav aria-label="Questions" className="mt-10 flex flex-wrap gap-2">
          {questions.map((x, i) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-current={i === index ? 'step' : undefined}
              aria-label={`Question ${i + 1}${answered(x.id) ? ', answered' : ''}`}
              className={`flex size-11 items-center justify-center rounded-md border font-mono text-caption ${
                i === index ? 'border-text' : 'border-border'
              } ${answered(x.id) ? 'bg-text text-bg' : 'bg-surface text-muted hover:border-control'}`}
            >
              {i + 1}
            </button>
          ))}
        </nav>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className={`${STAGE} grid gap-3 px-4 py-4 md:px-0`}>
          {confirming && unanswered > 0 && (
            <p role="status" className="text-body">
              {unanswered} {unanswered === 1 ? 'question has' : 'questions have'} no answer and will count as wrong. Submit anyway?
            </p>
          )}
          {error && (
            <p role="alert" className="text-small text-loss">
              {error}
            </p>
          )}
          <div className="flex items-center gap-3">
            {index > 0 && (
              <button
                type="button"
                onClick={() => {
                  setConfirming(false)
                  setIndex(index - 1)
                }}
                className="inline-flex min-h-11 items-center px-2 text-small font-semibold text-muted hover:text-text md:-ml-2"
              >
                Back
              </button>
            )}
            <span className="hidden flex-1 text-caption text-subtle md:block">
              {total - unanswered}/{total} answered · saved on this device
            </span>
            <Button className="flex-1 md:flex-none" onClick={() => forward()} disabled={submitting}>
              {submitting ? 'Grading…' : !last ? 'Next' : confirming && unanswered > 0 ? 'Submit anyway' : 'Submit answers'}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

function ExamResultView({
  exam,
  attempt,
  result,
  context,
  onRetake,
}: {
  exam: ExamStatus
  attempt: Attempt
  result: ExamResult
  context?: string
  onRetake: (a: Attempt) => void
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => headingRef.current?.focus(), [])

  const retake = async () => {
    setBusy(true)
    setError(null)
    try {
      onRetake(await startAttempt(exam.key))
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  const passed = result.passed
  return (
    <>
      <TopBar title={attempt.exam.title} context={context} right="Done" progress={[1, 1]} />
      <main className={`${STAGE} grid gap-8 px-4 pb-16 pt-8 md:pt-12`}>
        <ExamScene pose={passed ? 'cheer' : 'think'} module={exam.module} />
        <div>
          <p className={`text-small font-semibold ${passed ? 'text-gain' : 'text-muted'}`}>{passed ? 'Passed' : 'Not passed yet'}</p>
          <h1 ref={headingRef} tabIndex={-1} className="mt-2 text-h1 outline-none md:text-h1-lg">
            {result.correct} of {result.total} correct · {percent(result.score)}
          </h1>
          <p className="mt-3 text-lesson text-muted">
            {passed
              ? exam.scope === 'placement'
                ? `Level ${exam.level} counts as done. The lessons stay open if you want to read them.`
                : exam.scope === 'level'
                  ? `Level ${exam.level} is complete.`
                  : 'The next module is open.'
              : `The pass mark is ${percent(result.pass_mark)}. Review the lessons below, then try again.`}
          </p>
          {result.gate_2_passed && (
            <p className="mt-3 text-lesson">
              <strong>Gate 2 passed.</strong> Every published level is done, so the Strategy Lab is open.
            </p>
          )}
          {/* The score bar shows where the pass mark sits. */}
          <div className="relative mt-6 h-2 rounded-full bg-border" aria-hidden="true">
            <div className={`h-full rounded-full ${passed ? 'bg-gain' : 'bg-text'}`} style={{ width: percent(result.score) }} />
            <div className="absolute -top-1 h-4 w-0.5 bg-accent" style={{ left: percent(result.pass_mark) }} />
          </div>
          <p className="mt-2 text-caption text-subtle">Amber line: pass mark</p>
        </div>

        {result.review_lessons.length > 0 && (
          <section aria-labelledby="review">
            <h2 id="review" className="text-h3">
              Lessons to review
            </h2>
            <ul className="mt-3 grid gap-2">
              {result.review_lessons.map((l) => (
                <li key={l.slug}>
                  <Link to={`/learn/${l.slug}`} className="flex min-h-12 items-center rounded-md border border-border bg-surface px-4 text-body hover:border-control">
                    {l.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="questions">
          <h2 id="questions" className="text-h3">
            Your answers
          </h2>
          <ol className="mt-3 grid gap-3">
            {result.results.map((r, i) => (
              <ResultRow key={r.question} index={i} row={r} />
            ))}
          </ol>
          <p className="mt-3 text-caption text-subtle">Correct answers aren&rsquo;t shown, so a retake stays a fair test.</p>
        </section>

        {!passed && !result.can_retake_now && result.cooldown_until && (
          <Banner kind="info" title="Time to review">
            That&rsquo;s two misses in a row, so this exam opens again {untilLabel(result.cooldown_until)}. The lessons above are the best use of the wait.
          </Banner>
        )}
        {error && (
          <Banner kind="danger" title="Couldn't start a retake">
            {error}
          </Banner>
        )}

        <div className="flex flex-wrap items-center gap-4">
          {!passed && result.can_retake_now ? (
            <>
              <Button onClick={retake} disabled={busy}>
                {busy ? 'Starting…' : 'Retake now, with different questions'}
              </Button>
              <Link to="/learn" className="inline-flex min-h-11 items-center text-small font-semibold text-muted hover:text-text">
                Review first
              </Link>
            </>
          ) : (
            <Link to="/learn" className={buttonClass('primary')}>
              {passed ? 'Continue' : 'Back to Learn'}
            </Link>
          )}
        </div>
      </main>
    </>
  )
}

function ResultRow({ index, row }: { index: number; row: ExamResult['results'][number] }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const fieldId = useId()

  const send = async (e: FormEvent) => {
    e.preventDefault()
    if (reason.trim().length < 5) return
    setState('sending')
    try {
      await reportQuestion(row.question, reason.trim())
      setState('sent')
    } catch {
      setState('error')
    }
  }

  return (
    <li className="rounded-md border border-border bg-surface px-4 py-3">
      <div className="flex gap-3">
        {row.correct ? (
          <CircleCheck className="mt-0.5 size-5 shrink-0 text-gain" strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <CircleX className="mt-0.5 size-5 shrink-0 text-loss" strokeWidth={1.75} aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-body">
            <span className="sr-only">{row.correct ? 'Correct: ' : 'Missed: '}</span>
            <span className="font-mono text-caption text-subtle">{index + 1}.</span> {row.prompt}
          </p>
          {state === 'sent' ? (
            <p className="mt-2 text-caption text-subtle" role="status">
              Thanks. We&rsquo;ll check this question; if it&rsquo;s wrong, it&rsquo;s removed from exams.
            </p>
          ) : open ? (
            <form onSubmit={send} className="mt-3 grid gap-2">
              <label htmlFor={fieldId} className="text-small font-semibold">
                What&rsquo;s wrong with this question?
              </label>
              <textarea
                id={fieldId}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={1000}
                rows={3}
                className="rounded-sm border border-control bg-raised px-3 py-2 text-body"
              />
              {state === 'error' && <p className="text-small text-loss">Couldn&rsquo;t send. Try again when you&rsquo;re online.</p>}
              <div className="flex gap-3">
                <Button type="submit" variant="secondary" disabled={state === 'sending' || reason.trim().length < 5}>
                  {state === 'sending' ? 'Sending…' : 'Send report'}
                </Button>
                <button type="button" onClick={() => setOpen(false)} className="min-h-11 px-2 text-small font-semibold text-muted hover:text-text">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-caption font-semibold text-subtle hover:text-text"
            >
              <Flag className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              Report this question
            </button>
          )}
        </div>
      </div>
    </li>
  )
}
