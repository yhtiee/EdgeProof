import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Check, Circle, Lock } from 'lucide-react'
import { Banner, DevGateNote, buttonClass } from '../../components/ui'
import { api } from '../../lib/api/client'

/**
 * Your progress (DESIGN.md "Progress path", spec §8): every gate and level
 * in order, from the server's own gate rules (GET /me/progress). The current
 * step is marked in amber; choosing any step shows its criteria and the next
 * thing to do, so the path is also the nudge.
 */
type Criterion = { name: string; met: boolean; link?: string }
type Step = {
  kind: 'gate' | 'level' | 'milestone'
  key: string
  title: string
  done: boolean
  unlocks?: string
  upcoming?: boolean
  criteria?: Criterion[]
  link?: string | null
  placed?: boolean
  lessons_done?: number
  lessons_total?: number
  exams_done?: number
  exams_total?: number
  level_exam?: { key: string; passed: boolean; best_score: number | null } | null
  next?: { kind: 'lesson' | 'exam'; key: string; title: string } | null
}
type Progress = { steps: Step[]; current: string | null; gates_open: boolean }

const pathTo = (n: NonNullable<Step['next']>) => (n.kind === 'exam' ? `/learn/exam/${n.key}` : `/learn/${n.key}`)

function summary(s: Step) {
  if (s.kind === 'level') {
    if (s.placed) return 'Placed out with the placement exam'
    return `${s.lessons_done}/${s.lessons_total} lessons · ${s.exams_done}/${s.exams_total} exams`
  }
  if (s.upcoming) return 'Coming in Phase 2'
  if (s.done) return 'Passed'
  const crit = s.criteria ?? []
  return `${crit.filter((c) => c.met).length}/${crit.length} criteria met`
}

export function ProgressSection() {
  const query = useQuery({ queryKey: ['my-progress'], queryFn: () => api<Progress>('/me/progress'), staleTime: 30_000 })
  const [chosen, setChosen] = useState<string | null>(null)
  const { hash } = useLocation()
  const loaded = !!query.data
  // Arriving from the Progress link (/profile#progress): bring the section into view once it has rendered.
  useEffect(() => {
    if (loaded && hash === '#progress') document.getElementById('progress')?.scrollIntoView({ block: 'start' })
  }, [loaded, hash])

  if (query.isError) {
    return (
      <Banner kind="danger" title="Couldn't load your progress">
        {(query.error as Error).message}
      </Banner>
    )
  }
  if (!query.data) return <div className="h-80 animate-pulse rounded-lg bg-surface motion-reduce:animate-none" aria-busy="true" />

  const { steps, current, gates_open } = query.data
  const selected = steps.find((s) => s.key === (chosen ?? current)) ?? steps.at(-1)!

  return (
    <section id="progress" aria-labelledby="progress-h" className="scroll-mt-24">
      <h2 id="progress-h" className="text-h2 md:text-h2-lg">
        Your progress
      </h2>
      <p className="mt-1 max-w-[60ch] text-body text-muted">Each gate opens only when your own data meets its criteria. Choose a step to see what it needs.</p>
      {gates_open && (
        <div className="mt-4">
          <DevGateNote>Every gate is open on this build. The path shows what learners would see when deployed.</DevGateNote>
        </div>
      )}
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-12">
        <ol className="relative ml-3 border-l border-border">
          {steps.map((s) => {
            const isCurrent = s.key === current
            const isChosen = s.key === selected.key
            return (
              <li key={s.key} className="relative pb-2 pl-6 last:pb-0">
                <span
                  className={`absolute -left-3 top-3 flex size-6 items-center justify-center rounded-full border ${
                    s.done
                      ? 'border-transparent bg-text text-bg'
                      : isCurrent
                        ? 'border-transparent bg-accent text-on-accent'
                        : 'border-control bg-surface text-subtle'
                  }`}
                  aria-hidden="true"
                >
                  {s.done ? <Check className="size-3.5" strokeWidth={2.5} /> : isCurrent ? <Circle className="size-2.5 fill-current" strokeWidth={0} /> : <Lock className="size-3" strokeWidth={1.75} />}
                </span>
                <button
                  type="button"
                  onClick={() => setChosen(s.key)}
                  aria-pressed={isChosen}
                  className={`block w-full rounded-md px-3 py-2 text-left ${isChosen ? 'bg-surface' : 'hover:bg-surface'}`}
                >
                  <span className="block text-body font-semibold">{s.title}</span>
                  <span className="block text-small text-muted">
                    <span className="sr-only">{s.done ? 'Done. ' : isCurrent ? 'You are here. ' : 'Not yet. '}</span>
                    {isCurrent ? 'You are here · ' : ''}
                    {summary(s)}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>

        <section aria-live="polite" aria-label={`${selected.title} details`} className="rounded-lg border border-border bg-surface p-4 md:p-6 lg:sticky lg:top-24">
          <p className="text-small font-semibold text-muted">{selected.done ? 'Passed' : selected.key === current ? 'You are here' : selected.upcoming ? 'Coming later' : 'Not yet'}</p>
          <h3 className="mt-1 text-h3">{selected.title}</h3>
          {selected.unlocks && <p className="mt-1 text-small text-muted">Unlocks: {selected.unlocks}</p>}

          {selected.kind === 'level' ? (
            <dl className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <dt className="text-caption text-subtle">Lessons</dt>
                <dd className="font-mono text-h3">
                  {selected.lessons_done}/{selected.lessons_total}
                </dd>
              </div>
              <div>
                <dt className="text-caption text-subtle">Exams</dt>
                <dd className="font-mono text-h3">
                  {selected.exams_done}/{selected.exams_total}
                </dd>
              </div>
              {selected.level_exam && (
                <div className="col-span-2">
                  <dt className="text-caption text-subtle">Level exam</dt>
                  <dd className="text-small">
                    {selected.placed ? 'Placed out' : selected.level_exam.passed ? 'Passed' : 'Not passed yet'}
                    {selected.level_exam.best_score !== null && ` · best ${Math.round(selected.level_exam.best_score * 100)}%`}
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <ul className="mt-3">
              {(selected.criteria ?? []).map((c) => (
                <li key={c.name} className="flex min-h-11 items-center justify-between gap-4 border-t border-border text-small">
                  {c.link && !c.met ? (
                    <Link to={c.link} className="underline underline-offset-4">
                      {c.name}
                    </Link>
                  ) : (
                    <span>{c.name}</span>
                  )}
                  <span className={`flex shrink-0 items-center gap-1 ${c.met ? 'text-gain' : 'text-muted'}`}>
                    {c.met && <Check className="size-4" strokeWidth={2} aria-hidden="true" />}
                    {c.met ? 'Met' : 'Not yet'}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {!selected.done && !selected.upcoming && (
            <div className="mt-6">
              {selected.kind === 'level' && selected.next ? (
                <Link to={pathTo(selected.next)} className={buttonClass('primary')}>
                  Next: {selected.next.title}
                </Link>
              ) : selected.link ? (
                <Link to={selected.link} className={buttonClass(selected.key === current ? 'primary' : 'secondary')}>
                  {selected.key === 'gate-1' ? 'Finish your plan' : selected.key === 'lab' || selected.key === 'gate-3' ? 'Open the Strategy Lab' : 'Go to Learn'}
                </Link>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </section>
  )
}
