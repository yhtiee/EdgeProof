import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Circle, FlaskConical, Lock } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Banner, Button, DevGateNote, EmptyState, buttonClass } from '../../components/ui'
import { ApiError } from '../../lib/api/client'
import { useSession } from '../../lib/session'
import { LAB_KEYS, MAX_ACTIVE, createStrategy, useLabAccess, useStrategies, type Strategy } from '../strategy-lab/api'

/**
 * Strategy Lab home (spec §6, rulebook-builder.md §4.3 "Lab list"). Drafting
 * opens after the Level 6 strategy lessons on a deployed build; development
 * builds open it and say what learners would need.
 */
export default function LabPage() {
  const session = useSession()
  const userId = session.status === 'signed-in' ? session.me.id : undefined
  const access = useLabAccess(!!userId)
  const strategies = useStrategies(userId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const notice = (useLocation().state as { notice?: string } | null)?.notice
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const list = strategies.data ?? []
  const active = list.filter((s) => s.status === 'active')
  const archived = list.filter((s) => s.status === 'archived')
  const atLimit = active.length >= MAX_ACTIVE
  const locked = access.data && !access.data.open

  const start = async () => {
    setCreating(true)
    setError(null)
    try {
      const s = await createStrategy(`Strategy ${list.length + 1}`)
      await queryClient.invalidateQueries({ queryKey: LAB_KEYS.strategies })
      navigate(`/lab/${s.id}/v/1/name`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message)
      setCreating(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Strategy Lab"
        description="Write your own rulebook, one part at a time. Clear rules can be tested; vague ones can't."
        action={
          !locked && (
            <Button onClick={start} disabled={creating || atLimit || !access.data}>
              {creating ? 'Creating…' : 'New strategy'}
            </Button>
          )
        }
      />

      {notice && (
        <p role="status" className="-mt-4 mb-6 text-small font-semibold text-muted">
          {notice}
        </p>
      )}
      {access.data?.gates_open && !access.data.requirement_met && (
        <div className="mb-6">
          <DevGateNote>When deployed, the Lab opens after: {access.data.required.map((r) => r.title).join(', ')}.</DevGateNote>
        </div>
      )}
      {error && (
        <div className="mb-6">
          <Banner kind="danger" title="Couldn't create a strategy">
            {error}
          </Banner>
        </div>
      )}
      {atLimit && !locked && (
        <div className="mb-6">
          <Banner kind="info" title={`${MAX_ACTIVE} strategies are active, the most allowed`}>
            Archive one to start another. Archived strategies stay readable.
          </Banner>
        </div>
      )}

      {locked ? (
        <section aria-labelledby="lab-locked" className="max-w-2xl rounded-lg border border-border bg-surface p-4 md:p-6">
          <p className="flex items-center gap-2 text-small font-semibold text-muted">
            <Lock className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Locked
          </p>
          <h2 id="lab-locked" className="mt-2 text-h2">
            Drafting opens after the strategy lessons
          </h2>
          <p className="mt-2 text-body text-muted">
            The Lab turns an idea into rules a computer could follow. These lessons in Level 6 teach exactly that, so the builder opens when they&rsquo;re done.
          </p>
          <ul className="mt-4 grid gap-2">
            {access.data!.required.map((r) => (
              <li key={r.slug}>
                <Link to={`/learn/${r.slug}`} className="flex min-h-12 items-center gap-3 rounded-md border border-border bg-bg px-3 hover:border-control">
                  {r.done ? (
                    <Check className="size-5 shrink-0 text-gain" strokeWidth={2} aria-label="Done" />
                  ) : (
                    <Circle className="size-5 shrink-0 text-subtle" strokeWidth={1.75} aria-label="Not done" />
                  )}
                  <span className="text-body">{r.title}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link to="/learn" className={`${buttonClass('primary')} mt-6`}>
            Go to Learn
          </Link>
        </section>
      ) : strategies.isPending && !list.length ? (
        <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-surface motion-reduce:animate-none" />
          ))}
        </div>
      ) : !list.length ? (
        <EmptyState message="No strategies yet. Write your first rulebook, one part at a time." action={access.data && <Button onClick={start} disabled={creating}>New strategy</Button>} />
      ) : (
        <div className="grid gap-8">
          <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {active.map((s) => (
              <StrategyCard key={s.id} s={s} />
            ))}
          </ul>
          {archived.length > 0 && (
            <details>
              <summary className="min-h-11 cursor-pointer text-small font-semibold text-muted">Archived ({archived.length})</summary>
              <ul className="mt-3 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {archived.map((s) => (
                  <StrategyCard key={s.id} s={s} />
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

function StrategyCard({ s }: { s: Strategy }) {
  const v = s.latest
  const status = !v
    ? 'Draft'
    : v.locked
      ? 'Locked · Gate 3 passed'
      : v.fails === null || v.fails === undefined
        ? 'Draft'
        : v.fails === 0
          ? 'Draft · all checks pass'
          : `Draft · ${v.fails} ${v.fails === 1 ? 'check' : 'checks'} left`
  return (
    <li>
      <Link to={`/lab/${s.id}`} className={`flex h-full flex-col gap-2 rounded-lg border border-border bg-surface p-4 hover:border-control md:p-6 ${s.status === 'archived' ? 'opacity-70' : ''}`}>
        <span className="flex items-start gap-2">
          <FlaskConical className="mt-1 size-5 shrink-0 text-muted" strokeWidth={1.75} aria-hidden="true" />
          <span className="text-h3">{s.name}</span>
        </span>
        <span className="text-small text-muted">
          Version {v?.number ?? 1} · {v?.kind === 'discretionary' ? 'Discretionary' : 'Mechanical'}
        </span>
        <span className={`w-fit rounded-full border px-2 py-0.5 text-caption font-semibold ${v?.locked ? 'border-gain text-gain' : 'border-control text-muted'}`}>{status}</span>
        <span className="mt-auto text-caption text-subtle">Edited {new Date(s.updated_at).toLocaleDateString()}</span>
      </Link>
    </li>
  )
}
