import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { CircleCheck, CircleX, CornerDownLeft, X } from 'lucide-react'
import { Button, buttonClass } from '../../../components/ui'
import type { Block, Lesson, QuestionBlock, TextContent } from '../content'
import { InlineText, InteractiveBlock, TakeawayBlock, TextBlock } from './Blocks'
import { isAnswered, isCorrect, type Response } from './grading'
import { Mascot, hasInteractive, poseFor, type MascotPose } from './Mascot'
import { ModuleArt } from './ModuleArt'
import { LessonSourcesContext, QuoteBlock, SourceList } from './Sources'

/**
 * Lesson player (DESIGN.md §12 "Lesson screen", §11 Brilliant/Duolingo).
 *
 * One screen at a time, in one centred column about 680px wide: text, then
 * the simulator or question, in the order the lesson was written, so the eye
 * moves down rather than across. The action bar and the answer feedback
 * line up with the same column. Enter moves forward.
 */
type Props = {
  lesson: Lesson
  /** "Level 1 · How forex works", shown above the title. */
  context?: string
  startAt?: number
  /** Called when a screen is finished (Continue pressed). */
  onScreenDone?: (index: number) => void
  exitTo: string
  exitLabel: string
  /** Shown on the completion screen. */
  next?: { to: string; label: string }
  visitor?: boolean
}

type Feedback = { correct: boolean } | null

const STAGE = 'mx-auto w-full max-w-[680px]'

export function LessonPlayer(props: Props) {
  const byId = useMemo(() => Object.fromEntries((props.lesson.sources ?? []).map((src) => [src.id, src])), [props.lesson])
  return (
    <LessonSourcesContext.Provider value={byId}>
      <Player {...props} />
    </LessonSourcesContext.Provider>
  )
}

function Player({ lesson, context, startAt = 0, onScreenDone, exitTo, exitLabel, next, visitor }: Props) {
  const total = lesson.screens.length
  const [index, setIndex] = useState(() => Math.min(startAt, total - 1))
  const [finished, setFinished] = useState(false)
  const [response, setResponse] = useState<Response>('')
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [firstTry, setFirstTry] = useState<Record<number, boolean>>({})
  const headingRef = useRef<HTMLHeadingElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)

  const screen = lesson.screens[index]
  const question = screen.blocks.find((b): b is QuestionBlock => b.type === 'question')
  const isLast = index === total - 1

  // Move focus to the new screen so keyboard and screen-reader users follow along.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [index, finished])

  // Enter moves forward, unless focus is on something that uses Enter itself.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, button, a[href], [role="radio"]')) return
      if (primaryRef.current && !primaryRef.current.disabled) {
        e.preventDefault()
        primaryRef.current.click()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function go(to: number) {
    setResponse('')
    setFeedback(null)
    setIndex(to)
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }

  function advance() {
    onScreenDone?.(index)
    if (index + 1 < total) go(index + 1)
    else {
      setFinished(true)
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    }
  }

  function check(e?: FormEvent) {
    e?.preventDefault()
    if (!question || !isAnswered(question, response)) return
    const correct = isCorrect(question, response)
    setFeedback({ correct })
    setFirstTry((prev) => (index in prev ? prev : { ...prev, [index]: correct }))
  }

  if (finished) {
    return (
      <div className="min-h-dvh bg-bg">
        <TopBar lesson={lesson} context={context} index={total} exitTo={exitTo} exitLabel={exitLabel} done />
        <LessonComplete lesson={lesson} firstTry={firstTry} headingRef={headingRef} exitTo={exitTo} exitLabel={exitLabel} next={next} visitor={visitor} />
      </div>
    )
  }

  const awaitingCheck = !!question && !feedback
  const primaryLabel = awaitingCheck ? 'Check' : isLast ? 'Finish lesson' : 'Continue'

  return (
    <div className="min-h-dvh bg-bg">
      <TopBar lesson={lesson} context={context} index={index} exitTo={exitTo} exitLabel={exitLabel} />

      <main className="px-4 pb-48 pt-8 md:px-6 md:pt-12">
        <div key={index} className={`${STAGE} ep-screen-in`}>
          <h1 ref={headingRef} tabIndex={-1} className="sr-only">
            {lesson.title}, step {index + 1} of {total}
          </h1>
          <WithMascot show={!hasInteractive(screen.blocks)} pose={poseFor(screen.blocks, index)} module={lesson.module}>
          {question ? (
            <QuestionView
              question={question}
              response={response}
              onChange={(v) => {
                setResponse(v)
                if (feedback && !feedback.correct) setFeedback(null)
              }}
              locked={feedback?.correct ?? false}
              onSubmit={check}
              before={screen.blocks.filter((b) => b.type !== 'question')}
            />
          ) : (
            screen.blocks.map((b, i) => <ScreenBlock key={i} block={b} />)
          )}
          </WithMascot>
        </div>
      </main>

      <ActionBar
        feedback={feedback}
        explanation={question && feedback ? <InlineText tokens={question.explanation} /> : null}
        onBack={index > 0 && !feedback ? () => go(index - 1) : undefined}
        primary={
          <Button
            ref={primaryRef}
            onClick={awaitingCheck ? () => check() : advance}
            disabled={awaitingCheck && !isAnswered(question!, response)}
            className="md:min-w-40"
          >
            {primaryLabel}
          </Button>
        }
        secondary={
          feedback && !feedback.correct ? (
            <Button
              variant="secondary"
              onClick={() => {
                setFeedback(null)
                setResponse('')
              }}
            >
              Try again
            </Button>
          ) : null
        }
      />
    </div>
  )
}

/**
 * The lesson scene: Pip beside a drawing of the module's topic, so each
 * screen's picture matches what's being taught. Screens with a simulator or
 * diagram leave it out, so the interactive part has room.
 */
function WithMascot({
  show,
  pose,
  module,
  children,
}: {
  show: boolean
  pose: MascotPose
  module: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-6">
      {show && <LessonScene pose={pose} module={module} />}
      {children}
    </div>
  )
}

export function LessonScene({ pose, module }: { pose: MascotPose; module: string }) {
  return (
    <div className="flex items-end justify-center gap-4 rounded-lg border border-border bg-surface px-6 pb-4 pt-6" aria-hidden="true">
      <Mascot pose={pose} className="h-20 w-20 md:h-24 md:w-24" />
      <ModuleArt module={module} className="h-24 w-24 md:h-28 md:w-28" />
    </div>
  )
}

/** Every block, in authored order, at reading size. */
function ScreenBlock({ block }: { block: Block }) {
  switch (block.type) {
    case 'text':
      return <TextBlock content={block.content} size="lesson" />
    case 'takeaway':
      return <TakeawayBlock content={block.content as TextContent[]} />
    case 'quote':
      return <QuoteBlock text={block.text} source={block.source} page={block.page} />
    case 'simulator':
    case 'diagram':
      return (
        <div className="my-2">
          <InteractiveBlock block={block} />
        </div>
      )
    default:
      return null
  }
}

function TopBar({
  lesson,
  context,
  index,
  exitTo,
  exitLabel,
  done,
}: {
  lesson: Lesson
  context?: string
  index: number
  exitTo: string
  exitLabel: string
  done?: boolean
}) {
  const total = lesson.screens.length
  const pct = done ? 100 : ((index + 1) / total) * 100
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface">
      <div className={`${STAGE} flex min-h-14 items-center gap-2 px-2 md:px-0`}>
        <Link
          to={exitTo}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted hover:bg-raised hover:text-text md:-ml-3"
          aria-label={exitLabel}
        >
          <X className="size-5" strokeWidth={1.75} aria-hidden="true" />
        </Link>
        <div className="min-w-0 flex-1">
          {context && <p className="truncate text-caption text-subtle">{context}</p>}
          <p className="truncate text-small font-semibold">{lesson.title}</p>
        </div>
        <span className="shrink-0 pr-2 font-mono text-caption text-muted md:pr-0" aria-live="polite">
          {done ? 'Done' : `${index + 1}/${total}`}
        </span>
      </div>
      <div
        className="h-1 bg-border"
        role="progressbar"
        aria-label="Lesson progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done ? total : index + 1}
      >
        <div className="h-full bg-accent transition-[width] duration-[var(--motion-slow)] ease-emphasis" style={{ width: `${pct}%` }} />
      </div>
    </header>
  )
}

function QuestionView({
  question,
  response,
  onChange,
  locked,
  onSubmit,
  before,
}: {
  question: QuestionBlock
  response: Response
  onChange: (v: Response) => void
  locked: boolean
  onSubmit: (e: FormEvent) => void
  before: Block[]
}) {
  const promptId = useId()
  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      {before.map((b, i) => (
        <ScreenBlock key={i} block={b} />
      ))}
      <div>
        <p className="text-small font-semibold text-accent-text">Practice question</p>
        <p id={promptId} className="mt-2 text-h3 md:text-h2-lg md:leading-snug">
          <InlineText tokens={question.prompt} />
        </p>
      </div>
      {question.kind === 'mc' ? (
        <div role="radiogroup" aria-labelledby={promptId} className="grid gap-2">
          {question.options.map((o, i) => {
            const selected = response === o.key
            return (
              <label
                key={o.key}
                className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-md border px-4 py-3 transition-colors duration-[var(--motion-fast)] ease-standard has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${
                  selected ? 'border-text bg-raised' : 'border-border bg-surface hover:border-control'
                } ${locked ? 'cursor-default' : ''}`}
              >
                <input
                  type="radio"
                  name="answer"
                  value={o.key}
                  checked={selected}
                  disabled={locked}
                  onChange={() => onChange(o.key)}
                  className="sr-only"
                />
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-caption ${
                    selected ? 'border-text bg-text text-bg' : 'border-control text-muted'
                  }`}
                  aria-hidden="true"
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="text-lesson">
                  <InlineText tokens={o.inline} />
                </span>
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
              value={response}
              readOnly={locked}
              onChange={(e) => onChange(e.target.value)}
              aria-describedby={promptId}
              className="block min-h-12 w-full rounded-sm border border-control bg-raised px-3 pr-16 font-mono text-h3 read-only:bg-surface"
            />
            {question.unit && (
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-small text-subtle">
                {question.unit}
              </span>
            )}
          </div>
        </div>
      )}
      {/* Enter submits the check from the numeric field. */}
      <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
    </form>
  )
}

function ActionBar({
  feedback,
  explanation,
  onBack,
  primary,
  secondary,
}: {
  feedback: Feedback
  explanation: ReactNode
  onBack?: () => void
  primary: ReactNode
  secondary: ReactNode
}) {
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] ${
        feedback ? 'ep-slide-up border-border bg-raised shadow-sheet' : 'border-border bg-surface'
      }`}
    >
      <div className={`${STAGE} grid gap-4 px-4 py-4 md:px-0`}>
        {feedback && (
          <div role="status" aria-live="polite" className="flex gap-3">
            {feedback.correct ? (
              <CircleCheck className="mt-0.5 size-6 shrink-0 text-gain" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <CircleX className="mt-0.5 size-6 shrink-0 text-loss" strokeWidth={1.75} aria-hidden="true" />
            )}
            <div>
              <p className={`text-h3 ${feedback.correct ? 'text-gain' : 'text-loss'}`}>{feedback.correct ? 'Correct' : 'Not quite'}</p>
              <p className="text-body">{explanation}</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex min-h-11 items-center px-2 text-small font-semibold text-muted hover:text-text md:-ml-2"
            >
              Back
            </button>
          ) : null}
          <span className="hidden flex-1 items-center gap-1 text-caption text-subtle md:flex">
            <CornerDownLeft className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
            Press Enter to continue
          </span>
          <div className="flex flex-1 justify-end gap-3 md:flex-none [&>*]:flex-1 md:[&>*]:flex-none">
            {secondary}
            {primary}
          </div>
        </div>
      </div>
    </div>
  )
}

function LessonComplete({
  lesson,
  firstTry,
  headingRef,
  exitTo,
  exitLabel,
  next,
  visitor,
}: {
  lesson: Lesson
  firstTry: Record<number, boolean>
  headingRef: React.RefObject<HTMLHeadingElement | null>
  exitTo: string
  exitLabel: string
  next?: { to: string; label: string }
  visitor?: boolean
}) {
  const takeaways = lesson.screens.flatMap((s) => s.blocks.filter((b) => b.type === 'takeaway'))
  const asked = Object.keys(firstTry).length
  const right = Object.values(firstTry).filter(Boolean).length

  return (
    <main className="px-4 py-10 md:px-6 md:py-16">
      <div className={`${STAGE} ep-screen-in grid gap-8`}>
        <div>
          <LessonScene pose="cheer" module={lesson.module} />
          <h1 ref={headingRef} tabIndex={-1} className="mt-3 text-h1 md:text-h1-lg">
            Lesson complete
          </h1>
          {asked > 0 && (
            <p className="mt-2 text-body text-muted">
              You answered <span className="font-mono">{right}</span> of <span className="font-mono">{asked}</span> practice{' '}
              {asked === 1 ? 'question' : 'questions'} right on the first try.
            </p>
          )}
        </div>

        {takeaways.length > 0 && (
          <div className="grid gap-3">
            {takeaways.map((t, i) => (
              <TakeawayBlock key={i} content={(t as { content: TextContent[] }).content} />
            ))}
          </div>
        )}

        {visitor ? (
          <div className="grid gap-4">
            <p className="text-lesson">
              That was Level 1, Lesson 1. Create a free account to keep going: your progress saves as you learn, and you get a study plan built
              around your week.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link to="/sign-up" className={buttonClass('primary')}>
                Create free account
              </Link>
              <Link to={exitTo} className="inline-flex min-h-11 items-center text-small font-semibold text-muted hover:text-text">
                {exitLabel}
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            {next && (
              <Link to={next.to} className={buttonClass('primary')}>
                {next.label}
              </Link>
            )}
            <Link
              to={exitTo}
              className={next ? 'inline-flex min-h-11 items-center text-small font-semibold text-muted hover:text-text' : buttonClass('primary')}
            >
              {exitLabel}
            </Link>
          </div>
        )}

        <SourceList sources={lesson.sources ?? []} />
      </div>
    </main>
  )
}
