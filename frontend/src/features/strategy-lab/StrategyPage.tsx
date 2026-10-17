import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CircleCheck, Lock } from 'lucide-react'
import { Banner, Button, buttonClass } from '../../components/ui'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { LAB_KEYS, createVersion, listVersions, updateStrategy, useStrategies, useVersion } from './api'
import { checkRulebook } from './clarity'
import { Preview } from './Preview'
import { useSession } from '../../lib/session'
import { ApiError } from '../../lib/api/client'

/**
 * A strategy (rulebook-builder.md §4.3 "Strategy page" and "Version
 * history"): the latest rulebook read-only, the Gate 3 card, every version
 * with its reason, and "Edit rules", which starts a new version once the
 * latest is locked (SL-6).
 */
export default function StrategyPage() {
  const { strategyId = '' } = useParams()
  const session = useSession()
  const userId = session.status === 'signed-in' ? session.me.id : undefined
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const notice = (useLocation().state as { notice?: string } | null)?.notice
  const strategies = useStrategies(userId)
  const strategy = strategies.data?.find((s) => s.id === strategyId)
  const versions = useQuery({ queryKey: ['strategy-versions', strategyId], queryFn: () => listVersions(strategyId) })
  const latest = versions.data?.[0]
  const version = useVersion(latest?.id)
  const [sheet, setSheet] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (strategies.isError || versions.isError) {
    return (
      <Banner kind="danger" title="Couldn't open this strategy">
        {((strategies.error ?? versions.error) as Error).message}
      </Banner>
    )
  }
  if (!strategy || !latest || !version.data) return <div className="h-96 animate-pulse rounded-lg bg-surface motion-reduce:animate-none" aria-busy="true" />

  const v = version.data
  const report = checkRulebook(strategy.name, v, v.examples.map((e) => ({ rule_key: e.rule_key, valid: e.valid })))
  const archived = strategy.status === 'archived'

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: LAB_KEYS.strategies }),
      queryClient.invalidateQueries({ queryKey: ['strategy-versions', strategyId] }),
    ])

  const newVersion = async () => {
    setBusy(true)
    setError(null)
    try {
      const created = await createVersion(strategyId, reason.trim())
      await refresh()
      navigate(`/lab/${strategyId}/v/${created.number}/name`)
    } catch (err) {
      setError(err instanceof ApiError && err.fields.reason ? err.fields.reason[0] : (err as Error).message)
      setBusy(false)
    }
  }

  const toggleArchive = async () => {
    setError(null)
    try {
      await updateStrategy(strategyId, { status: archived ? 'active' : 'archived' })
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start lg:gap-12">
      <div className="grid min-w-0 gap-6">
        <div>
          <Link to="/lab" className="inline-flex min-h-11 items-center gap-1 text-small font-semibold text-muted hover:text-text">
            <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Strategy Lab
          </Link>
          <h1 className="mt-1 text-h1 md:text-h1-lg">{strategy.name}</h1>
          <p className="mt-1 text-body text-muted">
            Version {v.number} · {v.locked ? 'Locked' : 'Draft'} · {v.kind === 'discretionary' ? 'Discretionary, lower reliability' : 'Mechanical'}
            {archived ? ' · Archived' : ''}
          </p>
        </div>
        {notice && (
          <p role="status" className="text-small font-semibold text-muted">
            {notice}
          </p>
        )}
        {error && (
          <Banner kind="danger" title="Couldn't do that">
            {error}
          </Banner>
        )}
        <div className="flex flex-wrap gap-3">
          {v.locked ? (
            <Button onClick={() => setSheet(true)} disabled={archived}>
              Edit rules
            </Button>
          ) : (
            <Link to={`/lab/${strategyId}/v/${v.number}/name`} className={buttonClass('primary')}>
              Continue editing
            </Link>
          )}
          <Button variant="secondary" onClick={toggleArchive}>
            {archived ? 'Unarchive' : 'Archive'}
          </Button>
        </div>
        <section className="rounded-lg border border-border bg-surface p-4 md:p-6">
          <Preview name={strategy.name} doc={v} items={report.items} heading="h3" stepHref={v.locked ? undefined : (s) => `/lab/${strategyId}/v/${v.number}/${s}`} />
        </section>
      </div>

      <aside className="grid gap-6 lg:sticky lg:top-24">
        <section aria-label="Gate 3" className="rounded-lg border border-border bg-surface p-4 md:p-6">
          <p className="flex items-center gap-2 text-h3">
            {v.locked ? <CircleCheck className="size-5 text-gain" strokeWidth={1.75} aria-hidden="true" /> : <Lock className="size-5 text-muted" strokeWidth={1.75} aria-hidden="true" />}
            Gate 3
          </p>
          <p className="mt-1 text-small text-muted">Rules are clear enough to test.</p>
          <p className="mt-2 text-small font-semibold">
            {v.locked
              ? `Passed${v.locked_at ? ` on ${new Date(v.locked_at).toLocaleDateString()}` : ''}`
              : `${report.items.filter((i) => i.severity === 'fail').length} checks left`}
          </p>
          {!v.locked && (
            <Link to={`/lab/${strategyId}/v/${v.number}/check`} className="mt-3 inline-flex min-h-11 items-center text-small font-semibold underline underline-offset-4">
              Open the checklist
            </Link>
          )}
        </section>
        <section aria-labelledby="history">
          <h2 id="history" className="text-h3">
            Versions
          </h2>
          <ol className="mt-3 grid gap-2">
            {versions.data!.map((h) => (
              <li key={h.id}>
                <Link to={`/lab/${strategyId}/v/${h.number}/${h.locked ? 'check' : 'name'}`} className="block rounded-md border border-border bg-surface p-3 hover:border-control">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">Version {h.number}</span>
                    <span className="text-caption text-subtle">{new Date(h.created_at).toLocaleDateString()}</span>
                  </span>
                  <span className="block text-small text-muted">
                    {h.locked ? 'Locked · Gate 3 passed' : 'Draft'} · {h.trades ?? 0} {h.trades === 1 ? 'trade' : 'trades'}
                  </span>
                  {h.reason && <span className="mt-1 block text-small">&ldquo;{h.reason}&rdquo;</span>}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      </aside>

      <BottomSheet
        open={sheet}
        onOpenChange={setSheet}
        title="Save as new version"
        description={`Version ${v.number} stays locked with its tests and trades. Changes go into version ${v.number + 1}.`}
        footer={
          <Button onClick={newVersion} disabled={busy || reason.trim().length < 10}>
            {busy ? 'Creating…' : `Create version ${v.number + 1}`}
          </Button>
        }
      >
        <label htmlFor="reason" className="mb-1 block text-small font-semibold">
          What&rsquo;s changing and why?
        </label>
        <textarea id="reason" rows={3} maxLength={280} value={reason} onChange={(e) => setReason(e.target.value)} className="block w-full rounded-sm border border-control bg-raised px-3 py-2 text-body" />
        <p className="mt-1 text-caption text-subtle">At least 10 characters. It&rsquo;s kept with the version, so later you can see why results changed.</p>
      </BottomSheet>
    </div>
  )
}
