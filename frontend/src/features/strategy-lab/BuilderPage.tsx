import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CircleAlert, CircleCheck, Eye, Info, ListOrdered, Lock } from 'lucide-react'
import { Banner, Button, buttonClass } from '../../components/ui'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { ApiError } from '../../lib/api/client'
import { useSession } from '../../lib/session'
import { LAB_KEYS, listVersions, passGate3, runClarity, updateStrategy, useVersion, versionKey, type Version } from './api'
import { checkRulebook } from './clarity'
import { useDraft, type SaveState } from './draft'
import { ExamplesStep } from './ExamplesStep'
import { profileFit } from './fit'
import { STEPS, STEP_INDEX } from './labels'
import { Preview } from './Preview'
import { CostsStep, EntryStep, ExitStep, MarketStep, NameStep, NoTradeStep, RiskStep, SetupStep, StopStep, type StepProps } from './steps'
import type { CheckItem, ClarityReport, FitItem } from './types'

/**
 * The guided builder (SL-1, rulebook-builder.md §4.2–4.3): one part per step,
 * a step rail, the live preview, autosave, and the clarity checklist that
 * leads to Gate 3. Route: /lab/:strategyId/v/:number/:step.
 */
export default function BuilderPage() {
  const { strategyId = '', number = '1' } = useParams()
  const versions = useQuery({ queryKey: ['strategy-versions', strategyId], queryFn: () => listVersions(strategyId) })
  const summary = versions.data?.find((v) => v.number === Number(number))
  const version = useVersion(summary?.id)

  if (versions.isError || version.isError) {
    return (
      <div className="grid max-w-xl gap-4">
        <Banner kind="danger" title="Couldn't open this rulebook">
          {((versions.error ?? version.error) as Error).message}
        </Banner>
        <Link to="/lab" className={`${buttonClass('secondary')} w-fit`}>
          Back to the Lab
        </Link>
      </div>
    )
  }
  if (!version.data) return <div className="h-96 animate-pulse rounded-lg bg-surface motion-reduce:animate-none" aria-busy="true" />
  // A cached copy is used while offline; when fresh data replaces it, the builder restarts on the server's
  // revision. Later refetches (after our own saves or new examples) must not remount it mid-edit.
  return <Builder key={`${version.data.id}-${version.isPlaceholderData ? 'cached' : 'live'}`} version={version.data} />
}

const SAVE_TEXT: Record<SaveState, string> = {
  saved: 'Saved',
  saving: 'Saving…',
  pending: 'Saving…',
  offline: 'Saved on this device · Syncing',
  error: 'Not saved',
}

function Builder({ version }: { version: Version }) {
  const { step = 'name' } = useParams()
  const [search, setSearch] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const session = useSession()
  const readOnly = version.locked
  const draft = useDraft(version.id, version, readOnly)
  const [name, setName] = useState(version.strategy.name)
  const [steps, setSteps] = useState(false)
  const [preview, setPreview] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  const base = `/lab/${version.strategy.id}/v/${version.number}`
  const index = STEP_INDEX[step] ?? 0
  const current = STEPS[index]
  const exampleRefs = useMemo(() => version.examples.map((e) => ({ rule_key: e.rule_key, valid: e.valid })), [version.examples])
  const report = useMemo(() => checkRulebook(name, draft.doc, exampleRefs), [name, draft.doc, exampleRefs])
  const errors = useMemo(() => Object.fromEntries(report.items.filter((i) => i.severity === 'fail').map((i) => [i.path, i.message])), [report])
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => import('../onboarding/api').then((m) => m.getProfile()), staleTime: 300_000 })
  const fit = useMemo(
    () =>
      profileFit(draft.doc.rules, {
        weekly_hours: profile.data?.weekly_hours ?? null,
        sessions: profile.data?.sessions ?? [],
        timezone: session.status === 'signed-in' ? session.me.timezone : 'UTC',
      }),
    [draft.doc.rules, profile.data, session],
  )

  // Rename: saved on its own, shortly after typing stops.
  useEffect(() => {
    if (readOnly || name.trim() === version.strategy.name || name.trim().length < 3) return
    const t = setTimeout(() => {
      void updateStrategy(version.strategy.id, { name: name.trim() }).then(() => queryClient.invalidateQueries({ queryKey: LAB_KEYS.strategies }))
    }, 800)
    return () => clearTimeout(t)
  }, [name, readOnly, version.strategy, queryClient])

  // Focus: the field a "Fix" link points to, otherwise the step heading.
  useEffect(() => {
    const target = search.get('focus')
    requestAnimationFrame(() => {
      const el = target ? document.querySelector<HTMLElement>(`[data-path="${CSS.escape(target)}"]`) : null
      if (el) {
        el.focus()
        el.scrollIntoView({ block: 'center' })
        setSearch({}, { replace: true })
      } else headingRef.current?.focus()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return
      const next = STEPS[index + (e.key === 'ArrowRight' ? 1 : -1)]
      if (next) {
        e.preventDefault()
        navigate(`${base}/${next.key}`)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, base, navigate])

  const stepStatus = (key: string) => {
    if (key === 'check') return report.passed ? 'done' : 'todo'
    const fails = report.items.filter((i) => i.fix === key && i.severity === 'fail').length
    return fails ? 'fail' : 'done'
  }

  const props: StepProps = { doc: draft.doc, update: draft.update, errors, readOnly }
  const next = STEPS[index + 1]

  return (
    <div className="grid gap-6 xl:grid-cols-[13rem_minmax(0,40rem)_minmax(0,22rem)] xl:items-start xl:gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
      {/* Step rail (desktop) */}
      <nav aria-label="Rulebook steps" className="hidden lg:sticky lg:top-24 lg:block">
        <Link to={`/lab/${version.strategy.id}`} className="mb-3 inline-flex min-h-11 items-center gap-1 text-small font-semibold text-muted hover:text-text">
          <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
          {name.trim() || version.strategy.name}
        </Link>
        <StepList base={base} current={step} status={stepStatus} />
        <p className="mt-4 text-caption text-subtle">Alt + → next step · Alt + ← previous</p>
      </nav>

      <div className="min-w-0 pb-28">
        {/* Mobile top: progress and the two sheets */}
        <div className="mb-4 flex items-center gap-2 lg:hidden">
          <button type="button" onClick={() => setSteps(true)} className="inline-flex min-h-11 flex-1 items-center gap-2 rounded-md border border-border bg-surface px-3 text-left text-small font-semibold">
            <ListOrdered className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">
              Step {index + 1} of {STEPS.length} · {current.title}
            </span>
          </button>
          <button type="button" onClick={() => setPreview(true)} className="inline-flex min-h-11 items-center gap-1 rounded-md border border-border bg-surface px-3 text-small font-semibold xl:hidden">
            <Eye className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Preview
          </button>
        </div>
        <div className="mb-6 h-1 rounded-full bg-border lg:hidden" aria-hidden="true">
          <div className="h-full rounded-full bg-accent" style={{ width: `${((index + 1) / STEPS.length) * 100}%` }} />
        </div>

        <p className="text-caption text-subtle">
          Step {index + 1} of {STEPS.length} · Version {version.number}
          {version.kind === 'discretionary' || report.kind === 'discretionary' ? ' · Discretionary, lower reliability' : ''}
        </p>
        <h1 ref={headingRef} tabIndex={-1} className="mt-1 text-h1 outline-none md:text-h1-lg">
          {current.title}
        </h1>
        <p className="mt-2 text-body text-muted">{current.why}</p>

        <div className="mt-6 grid gap-6">
          {readOnly && (
            <Banner kind="info" title={`Version ${version.number} is locked`}>
              Locked rules keep tests and journal trades tied to one fixed rulebook.{' '}
              <Link to={`/lab/${version.strategy.id}`} className="font-semibold underline">
                Edit rules
              </Link>{' '}
              to start version {version.number + 1}.
            </Banner>
          )}
          {draft.error && (
            <Banner kind="danger" title="Couldn't save">
              {draft.error}
            </Banner>
          )}
          {step === 'market' && fit.length > 0 && <FitNotes fit={fit} />}
          <div className="ep-screen-in grid gap-6" key={step}>
            {step === 'name' && <NameStep {...props} name={name} onRename={setName} />}
            {step === 'market' && <MarketStep {...props} />}
            {step === 'setup' && <SetupStep {...props} />}
            {step === 'entry' && <EntryStep {...props} />}
            {step === 'stop' && <StopStep {...props} />}
            {step === 'exit' && <ExitStep {...props} />}
            {step === 'risk' && <RiskStep {...props} />}
            {step === 'costs' && <CostsStep {...props} />}
            {step === 'no_trade' && <NoTradeStep {...props} />}
            {step === 'examples' && (
              <ExamplesStep versionId={version.id} conditions={draft.doc.rules.setup.conditions} examples={version.examples} readOnly={readOnly} locked={version.locked} errors={errors} />
            )}
            {step === 'check' && <CheckStep version={version} local={report} fit={fit} base={base} flush={draft.flush} />}
          </div>
        </div>
      </div>

      <aside className="hidden max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-lg border border-border bg-surface p-4 xl:sticky xl:top-24 xl:block">
        <p className="mb-3 text-caption font-semibold text-subtle">
          Version {version.number} · {version.locked ? 'Locked' : 'Draft'}
        </p>
        <Preview name={name} doc={draft.doc} items={report.items} stepHref={(s) => `${base}/${s}`} />
      </aside>

      {/* Action bar */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-surface lg:bottom-0 lg:left-[240px]">
        <div className="mx-auto flex max-w-[80rem] items-center gap-3 px-4 py-3 md:px-6 lg:px-8">
          {index > 0 && (
            <Link to={`${base}/${STEPS[index - 1].key}`} className="inline-flex min-h-11 items-center px-2 text-small font-semibold text-muted hover:text-text">
              Back
            </Link>
          )}
          <span className="flex-1 truncate text-caption text-subtle" role="status">
            {readOnly ? 'Locked · read only' : SAVE_TEXT[draft.save]}
          </span>
          {next && (
            <Link to={`${base}/${next.key}`} className={buttonClass('primary')}>
              Next: {next.title}
            </Link>
          )}
        </div>
      </div>

      <BottomSheet open={steps} onOpenChange={setSteps} title="Rulebook steps">
        <StepList base={base} current={step} status={stepStatus} onPick={() => setSteps(false)} />
      </BottomSheet>
      <BottomSheet open={preview} onOpenChange={setPreview} title="Preview" description="Your rulebook as it reads now.">
        <Preview name={name} doc={draft.doc} items={report.items} stepHref={(s) => `${base}/${s}`} />
      </BottomSheet>
      <BottomSheet
        open={!!draft.conflict}
        onOpenChange={() => {}}
        title="This draft changed on another device"
        description="Choose which copy to keep. The other is replaced."
        footer={
          <div className="flex flex-wrap gap-3">
            <Button onClick={draft.keepMine}>Keep this device’s version</Button>
            <Button variant="secondary" onClick={draft.useTheirs}>
              Use the other version
            </Button>
          </div>
        }
      >
        <p className="text-body text-muted">Both copies are drafts of version {version.number}. Nothing is locked or lost until you choose.</p>
      </BottomSheet>
    </div>
  )
}

function StepList({ base, current, status, onPick }: { base: string; current: string; status: (k: string) => 'done' | 'fail' | 'todo'; onPick?: () => void }) {
  return (
    <ol className="grid gap-0.5">
      {STEPS.map((s, i) => {
        const st = status(s.key)
        const active = s.key === current
        return (
          <li key={s.key}>
            <Link
              to={`${base}/${s.key}`}
              onClick={onPick}
              aria-current={active ? 'step' : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-small ${active ? 'bg-raised font-semibold text-text' : 'text-muted hover:text-text'}`}
            >
              <span className="w-4 text-right font-mono text-caption text-subtle">{i + 1}</span>
              <span className="min-w-0 flex-1">{s.title}</span>
              {st === 'fail' ? (
                <CircleAlert className="size-4 shrink-0 text-danger" strokeWidth={1.75} aria-label="Has failing checks" />
              ) : st === 'done' ? (
                <CircleCheck className="size-4 shrink-0 text-gain" strokeWidth={1.75} aria-label="Passes" />
              ) : null}
            </Link>
          </li>
        )
      })}
    </ol>
  )
}

function FitNotes({ fit }: { fit: FitItem[] }) {
  return (
    <Banner kind="info" title="Fit with your plan">
      <ul className="grid gap-1">
        {fit.map((f) => (
          <li key={f.code}>{f.message}</li>
        ))}
      </ul>
    </Banner>
  )
}

/** The clarity checklist (GitHub-checks style) and the Gate 3 lock. */
function CheckStep({ version, local, fit, base, flush }: { version: Version; local: ClarityReport; fit: FitItem[]; base: string; flush: () => Promise<void> }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [server, setServer] = useState<ClarityReport | null>(null)
  const [offline, setOffline] = useState(false)
  const [locking, setLocking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (version.locked) return
    let alive = true
    void (async () => {
      try {
        await flush()
        const r = await runClarity(version.id)
        if (alive) setServer(r)
      } catch {
        if (alive) setOffline(true)
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version.id])

  const report = server ?? local
  const failing = report.items.filter((i) => i.severity === 'fail')
  const notes = report.items.filter((i) => i.severity === 'warn')

  const lock = async () => {
    setLocking(true)
    setError(null)
    try {
      await flush()
      await passGate3(version.id)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: LAB_KEYS.strategies }),
        queryClient.invalidateQueries({ queryKey: versionKey(version.id) }),
        queryClient.invalidateQueries({ queryKey: ['strategy-versions', version.strategy.id] }),
      ])
      navigate(`/lab/${version.strategy.id}`, { state: { notice: `Version ${version.number} locked. Gate 3 passed.` } })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'clarity_failing') setServer(err.data.report as ClarityReport)
      setError((err as Error).message)
      setLocking(false)
    }
  }

  if (version.locked) {
    return (
      <GateCard passed>
        <p className="text-small text-muted">Locked {version.locked_at ? new Date(version.locked_at).toLocaleDateString() : ''}. Tests and journal trades attach to this version.</p>
      </GateCard>
    )
  }

  return (
    <div className="grid gap-6">
      <p className="text-body font-semibold" role="status">
        {failing.length ? `${failing.length} ${failing.length === 1 ? 'check fails' : 'checks fail'}` : 'All checks pass'}
        {notes.length ? ` · ${notes.length} ${notes.length === 1 ? 'note' : 'notes'}` : ''}
      </p>
      {offline && <p className="text-small text-muted">Checked on this device. Locking needs the server.</p>}
      <ul className="grid gap-2">
        {STEPS.filter((s) => s.key !== 'check').map((s) => {
          const items = report.items.filter((i) => i.fix === s.key)
          const fails = items.filter((i) => i.severity === 'fail')
          return (
            <li key={s.key} className="rounded-md border border-border bg-surface">
              <div className="flex min-h-11 items-center gap-3 px-3">
                {fails.length ? (
                  <CircleAlert className="size-5 shrink-0 text-danger" strokeWidth={1.75} aria-hidden="true" />
                ) : (
                  <CircleCheck className="size-5 shrink-0 text-gain" strokeWidth={1.75} aria-hidden="true" />
                )}
                <span className="flex-1 text-body">
                  <span className="sr-only">{fails.length ? 'Fails: ' : 'Passes: '}</span>
                  {s.title}
                </span>
                {fails.length > 0 && <span className="text-caption font-semibold text-danger">Fails</span>}
              </div>
              {items.length > 0 && (
                <ul className="grid gap-1 border-t border-border px-3 py-2">
                  {items.map((i, n) => (
                    <CheckRow key={n} item={i} base={base} />
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
      {fit.length > 0 && <FitNotes fit={fit} />}
      {error && (
        <Banner kind="danger" title="Couldn't lock this version">
          {error}
        </Banner>
      )}
      <GateCard passed={false} ready={!failing.length}>
        <p className="text-small text-muted">Locking fixes these rules. Tests and journal trades attach to this version. Changes later become version {version.number + 1}.</p>
        <Button className="mt-3 w-fit" onClick={lock} disabled={locking || failing.length > 0 || offline}>
          <Lock className="size-4" strokeWidth={1.75} aria-hidden="true" />
          {locking ? 'Locking…' : `Lock version ${version.number}`}
        </Button>
      </GateCard>
    </div>
  )
}

function CheckRow({ item, base }: { item: CheckItem; base: string }) {
  const fail = item.severity === 'fail'
  return (
    <li className="flex items-start gap-2 text-small">
      {fail ? (
        <span className="mt-0.5 shrink-0 font-semibold text-danger">Fails</span>
      ) : (
        <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 font-semibold text-warning">
          <Info className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
          Note
        </span>
      )}
      <span className="min-w-0 flex-1">{item.message}</span>
      <Link to={`${base}/${item.fix}?focus=${encodeURIComponent(item.path)}`} className="shrink-0 font-semibold underline underline-offset-2" aria-label={`Fix: ${item.message}`}>
        Fix
      </Link>
    </li>
  )
}

function GateCard({ passed, ready, children }: { passed: boolean; ready?: boolean; children: React.ReactNode }) {
  return (
    <section aria-label="Gate 3" className="rounded-lg border border-border bg-surface p-4 md:p-6">
      <p className="flex items-center gap-2 text-h3">
        {passed || ready ? <CircleCheck className="size-5 text-gain" strokeWidth={1.75} aria-hidden="true" /> : <CircleAlert className="size-5 text-muted" strokeWidth={1.75} aria-hidden="true" />}
        Gate 3: rules are clear enough to test
      </p>
      <p className="mt-1 text-small font-semibold text-muted">{passed ? 'Passed' : ready ? 'Every check passes' : 'Not yet: some checks fail'}</p>
      <div className="mt-2">{children}</div>
    </section>
  )
}
