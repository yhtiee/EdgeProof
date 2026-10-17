import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleCheck } from 'lucide-react'
import { Banner, Button } from '../../components/ui'
import { api } from '../../lib/api/client'
import { formatCount, formatPct, formatR } from '../../lib/format'
import { qs, useMetrics, useReviews, type Review, type Trade } from './api'

/**
 * Guided reviews (JR-8): three questions a day, five a week, the same ones
 * the Level 3 routines lesson teaches. Calm and private, like Day One;
 * the facts sit beside the questions so answers don't rely on memory.
 */
const pad = (n: number) => String(n).padStart(2, '0')
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const monday = (d: Date) => {
  const m = new Date(d)
  m.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return m
}

export default function ReviewsPage() {
  const reviews = useReviews()
  const today = isoDay(new Date())
  const week = isoDay(monday(new Date()))

  if (reviews.isError) {
    return (
      <Banner kind="danger" title="Couldn't load reviews">
        {(reviews.error as Error).message}
      </Banner>
    )
  }
  if (!reviews.data) return <div className="h-80 animate-pulse rounded-lg bg-surface motion-reduce:animate-none" aria-busy="true" />

  const { results, questions } = reviews.data
  const find = (kind: Review['kind'], period: string) => results.find((r) => r.kind === kind && r.period === period)
  const past = results.filter((r) => !(r.kind === 'daily' && r.period === today) && !(r.kind === 'weekly' && r.period === week))

  return (
    <div className="grid gap-8 xl:grid-cols-2 xl:items-start">
      <ReviewCard kind="daily" period={today} title="Today's review" questions={questions.daily} existing={find('daily', today)} />
      <ReviewCard kind="weekly" period={week} title="This week's review" questions={questions.weekly} existing={find('weekly', week)} />
      {past.length > 0 && (
        <section aria-labelledby="past" className="xl:col-span-2">
          <h2 id="past" className="text-h3">
            Earlier reviews
          </h2>
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {past.map((r) => (
              <li key={r.id} className="rounded-lg border border-border bg-surface p-4">
                <p className="text-small font-semibold text-muted">
                  {r.kind === 'daily' ? 'Day' : 'Week of'} {new Date(`${r.period}T00:00:00`).toLocaleDateString(undefined, { weekday: r.kind === 'daily' ? 'short' : undefined, day: 'numeric', month: 'short' })}
                </p>
                <dl className="mt-2 grid gap-2">
                  {questions[r.kind].map((q, i) =>
                    r.answers[`q${i + 1}`]?.trim() ? (
                      <div key={q}>
                        <dt className="text-caption text-subtle">{q}</dt>
                        <dd className="whitespace-pre-line text-body">{r.answers[`q${i + 1}`]}</dd>
                      </div>
                    ) : null,
                  )}
                </dl>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function ReviewCard({ kind, period, title, questions, existing }: { kind: Review['kind']; period: string; title: string; questions: string[]; existing?: Review }) {
  const queryClient = useQueryClient()
  const [answers, setAnswers] = useState<Record<string, string>>(existing?.answers ?? {})
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>(existing ? 'saved' : 'idle')
  const [error, setError] = useState<string | null>(null)
  const dirty = JSON.stringify(answers) !== JSON.stringify(existing?.answers ?? {})

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!Object.values(answers).some((v) => v.trim())) return setError('Answer at least one question.')
    setState('saving')
    setError(null)
    try {
      await api<Review>('/me/reviews', { method: 'POST', body: { kind, period, answers } })
      setState('saved')
      void queryClient.invalidateQueries({ queryKey: ['reviews'] })
      void queryClient.invalidateQueries({ queryKey: ['journal-activity'] })
    } catch (err) {
      setState('error')
      setError((err as Error).message)
    }
  }

  return (
    <section aria-labelledby={`${kind}-h`} className="rounded-lg border border-border bg-surface p-4 md:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={`${kind}-h`} className="text-h3">
          {title}
        </h2>
        {state === 'saved' && !dirty && (
          <span className="inline-flex items-center gap-1 text-small text-muted">
            <CircleCheck className="size-4 text-gain" strokeWidth={1.75} aria-hidden="true" />
            Done
          </span>
        )}
      </div>
      {kind === 'daily' ? <DayFacts day={period} /> : <WeekFacts from={period} />}
      <form onSubmit={save} className="mt-4 grid gap-4">
        {questions.map((q, i) => {
          const id = `${kind}-q${i + 1}`
          return (
            <div key={q}>
              <label htmlFor={id} className="mb-1 block text-small font-semibold">
                {q}
              </label>
              <textarea
                id={id}
                rows={2}
                maxLength={2000}
                value={answers[`q${i + 1}`] ?? ''}
                onChange={(e) => setAnswers({ ...answers, [`q${i + 1}`]: e.target.value })}
                className="block w-full rounded-sm border border-control bg-raised px-3 py-2 text-body"
              />
            </div>
          )
        })}
        {error && (
          <p role="alert" className="text-small text-loss">
            {error}
          </p>
        )}
        <Button type="submit" variant={state === 'saved' && !dirty ? 'secondary' : 'primary'} disabled={state === 'saving' || (state === 'saved' && !dirty)} className="w-fit">
          {state === 'saving' ? 'Saving…' : existing || state === 'saved' ? 'Save changes' : 'Save review'}
        </Button>
      </form>
    </section>
  )
}

function DayFacts({ day }: { day: string }) {
  const trades = useQuery({
    queryKey: ['trades', { from: day, to: day }],
    queryFn: () => api<{ results: Trade[] }>(`/me/trades${qs({ from: day, to: day, limit: '200' })}`),
  })
  const list = trades.data?.results ?? []
  if (!trades.data) return null
  if (!list.length) return <p className="mt-1 text-small text-muted">No trades logged today. A review still counts toward your journaling streak.</p>
  const followed = list.filter((t) => t.rules_followed).length
  const total = list.reduce((a, t) => a + (t.r_result ?? 0), 0)
  return (
    <p className="mt-1 text-small text-muted">
      {formatCount(list.length, 'trade')} today · {followed} followed every rule · {formatR(total, 1)} in total
    </p>
  )
}

function WeekFacts({ from }: { from: string }) {
  const metrics = useMetrics({ from })
  const m = metrics.data
  if (!m) return null
  if (!m.closed) return <p className="mt-1 text-small text-muted">No closed trades this week yet.</p>
  return (
    <p className="mt-1 text-small text-muted">
      {formatCount(m.closed, 'closed trade')} this week · rule-following {m.rule_following_rate !== null ? formatPct(m.rule_following_rate * 100, { digits: 0 }) : '—'} · broken rules cost {formatR(m.rule_breaking_cost_r, 1)}
    </p>
  )
}

