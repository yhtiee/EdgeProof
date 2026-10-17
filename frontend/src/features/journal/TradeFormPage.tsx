import { useEffect, useMemo, useState, type ClipboardEvent, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ImagePlus, X } from 'lucide-react'
import { Banner, Button, CheckboxRow, Field, Segmented, SelectField, buttonClass } from '../../components/ui'
import { formatMoney, formatPct, formatR } from '../../lib/format'
import { useSession } from '../../lib/session'
import {
  EMOTIONS,
  EMOTION_LABEL,
  INSTRUMENTS,
  JOURNAL_KEYS,
  getTrade,
  useAccounts,
  useNeverAgain,
  useRules,
  type Trade,
  type TradeImage,
  type TradeInput,
} from './api'
import { calcTrade, sizeForRisk, type Side } from './calc'
import { uploadScreenshot, useScreenshot } from './images'
import { useStrategies, useVersion } from '../strategy-lab/api'
import { describeCondition, describeEntry, describeNoTrade, describeStop } from '../strategy-lab/describe'
import type { VersionDoc } from '../strategy-lab/types'
import { flushOutbox, newClientId, queueDelete, queueSave, readOutbox, useOutbox } from './outbox'

/**
 * Log trade (DESIGN.md §12): one scrolling form in this order: account and
 * pair, direction, entry, initial stop, exit, size (risk % and R update
 * live), rule checklist, then the optional context, screenshots and notes.
 * Saves on the device first and syncs (DESIGN.md §10).
 */
type Form = {
  account: string
  strategy_version: string
  instrument: string
  side: Side | undefined
  opened_at: string // datetime-local
  entry: string
  initial_stop: string
  target: string
  closed: boolean
  exit_price: string
  closed_at: string
  partial: boolean
  exits: { price: string; size: string }[]
  size: string
  initial_risk_ccy: string
  gross_pnl: string
  fees: string
  swap: string
  checks: Record<string, boolean>
  setup_key: string
  emotion_before: string
  emotion_after: string
  confidence: string
  sleep: string
  distracted: string
  tags: string
  notes: string
  images: TradeImage[]
}

const LAST_KEY = 'edgeproof.journal-last'
const OUTCOME_WORD = { open: 'Open', win: 'Win', loss: 'Loss', breakeven: 'Breakeven' } as const
const pad = (n: number) => String(n).padStart(2, '0')
const toLocal = (iso: string | null | undefined) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null)
const num = (s: string) => (s.trim() === '' || Number.isNaN(Number(s)) ? null : Number(s))
const dec = (s: string) => (s.trim() === '' ? null : s.trim().replace(',', '.'))

function blank(): Form {
  let last: Partial<Form> = {}
  try {
    last = JSON.parse(localStorage.getItem(LAST_KEY) ?? '{}')
  } catch {
    /* none */
  }
  return {
    account: last.account ?? '', strategy_version: last.strategy_version ?? '', instrument: last.instrument ?? 'EUR/USD', side: undefined, opened_at: toLocal(new Date().toISOString()),
    entry: '', initial_stop: '', target: '', closed: true, exit_price: '', closed_at: '', partial: false, exits: [],
    size: last.size ?? '', initial_risk_ccy: '', gross_pnl: '', fees: '', swap: '', checks: {}, setup_key: last.setup_key ?? '',
    emotion_before: '', emotion_after: '', confidence: '', sleep: '', distracted: '', tags: '', notes: '', images: [],
  }
}

function fromTrade(t: TradeInput): Form {
  const s = (v: string | number | null | undefined) => (v === null || v === undefined ? '' : String(v))
  const exits = (t.exits ?? []).map((e) => ({ price: s(e.price), size: s(e.size) }))
  return {
    account: t.account, strategy_version: t.strategy_version ?? '', instrument: t.instrument, side: t.side, opened_at: toLocal(t.opened_at), entry: s(t.entry),
    initial_stop: s(t.initial_stop), target: s(t.target), closed: t.exit_price !== null || exits.length > 0,
    exit_price: exits.length ? '' : s(t.exit_price), closed_at: toLocal(t.closed_at), partial: exits.length > 0, exits,
    size: s(t.size), initial_risk_ccy: s(t.initial_risk_ccy), gross_pnl: s(t.gross_pnl),
    fees: Number(t.fees) ? s(t.fees) : '', swap: Number(t.swap) ? s(t.swap) : '',
    checks: Object.fromEntries(t.rule_checks.map((c) => [c.rule, c.followed])), setup_key: t.setup_key,
    emotion_before: t.emotion_before, emotion_after: t.emotion_after, confidence: s(t.confidence), sleep: t.sleep,
    distracted: t.distracted === null ? '' : t.distracted ? 'yes' : 'no', tags: t.tags.join(', '), notes: t.notes, images: t.images,
  }
}

export default function TradeFormPage() {
  const { key: routeKey } = useParams()
  const session = useSession()
  const userId = session.status === 'signed-in' ? session.me.id : undefined
  const outbox = useOutbox(userId)
  const local = routeKey ? outbox[routeKey] : undefined
  const existing = useQuery({
    queryKey: ['trade', routeKey],
    queryFn: () => getTrade(routeKey!),
    enabled: !!routeKey && !!userId && !(local && !local.id),
    retry: false,
  })

  if (routeKey && !local?.body && existing.isPending) {
    return <div className="h-96 animate-pulse rounded-lg bg-surface motion-reduce:animate-none" aria-busy="true" />
  }
  if (routeKey && !local?.body && existing.isError) {
    return (
      <div className="grid max-w-xl gap-4">
        <Banner kind="danger" title="Couldn't open this trade">
          {(existing.error as Error).message}
        </Banner>
        <Link to="/journal" className={`${buttonClass('secondary')} w-fit`}>
          Back to the journal
        </Link>
      </div>
    )
  }
  const key = routeKey ?? undefined
  const saved = local?.body ? undefined : existing.data
  const initial = local?.body ? fromTrade(local.body) : saved ? fromTrade(saved) : blank()
  return (
    <TradeForm
      key={key ?? 'new'}
      userId={userId}
      initial={initial}
      tradeKey={key}
      serverId={local?.id ?? saved?.id}
      stopLocked={!!(local?.id ?? saved?.id)}
      rejection={local?.error}
      saved={saved}
    />
  )
}

function TradeForm({
  userId,
  initial,
  tradeKey,
  serverId,
  stopLocked,
  rejection,
  saved,
}: {
  userId: string | undefined
  initial: Form
  tradeKey?: string
  serverId?: string
  stopLocked: boolean
  rejection?: { message: string; fields: Record<string, string[]> }
  saved?: Trade
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const accounts = useAccounts(userId)
  const rules = useRules(userId)
  const neverAgain = useNeverAgain(userId)
  // Saving returns to the list; load its code now, so that works even if the connection drops meanwhile.
  useEffect(() => {
    void import('./JournalLayout')
    void import('./TradesPage')
  }, [])
  const [form, setForm] = useState<Form>(initial)
  const [errors, setErrors] = useState<Record<string, string>>(() => flatten(rejection?.fields))
  const [banner, setBanner] = useState<string | null>(rejection?.message ?? null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))

  const liveAccounts = (accounts.data ?? []).filter((a) => !a.archived || a.id === form.account)
  // No account chosen yet (or the remembered one is gone): default to the first.
  const accountId = liveAccounts.some((a) => a.id === form.account) ? form.account : (liveAccounts[0]?.id ?? '')
  const account = liveAccounts.find((a) => a.id === accountId)
  const ccy = account?.currency ?? 'USD'

  // A Strategy Lab version, when chosen, supplies the checklist and the planned risk (SL-8).
  const strategies = useStrategies(userId)
  const strategyOptions = (strategies.data ?? []).filter((s) => s.latest && (s.status === 'active' || s.latest.id === form.strategy_version))
  const version = useVersion(form.strategy_version || undefined)
  const versionDoc = form.strategy_version ? version.data : undefined

  // The checklist: saved checks keep their wording; new trades use the strategy's rules or the practice checklist.
  const ruleList = useMemo(() => {
    const active = versionDoc ? versionRules(versionDoc) : (rules.data ?? []).filter((r) => r.active).map((r) => r.text)
    const savedRules = Object.keys(initial.checks)
    return savedRules.length ? [...savedRules, ...active.filter((r) => !savedRules.includes(r))] : active
  }, [rules.data, initial.checks, versionDoc])

  const exitValue = form.partial ? weightedExit(form.exits) : num(form.exit_price)
  const calc = calcTrade({
    instrument: form.instrument, side: form.side ?? 'buy', entry: num(form.entry), stop: num(form.initial_stop),
    exit: form.closed ? exitValue : null, size: num(form.size), accountCurrency: ccy,
    riskCcy: num(form.initial_risk_ccy), grossPnl: num(form.gross_pnl), fees: num(form.fees), swap: num(form.swap),
    balance: account?.balance ? Number(account.balance) : null,
  })
  const planPct = versionDoc ? versionDoc.risk_plan.risk_pct : account ? Number(account.risk_per_trade_pct) : null
  const planRisk = account?.balance && planPct ? (Number(account.balance) * planPct) / 100 : null
  const suggested = calc.sameCurrency && planRisk && num(form.entry) !== null && num(form.initial_stop) !== null && !calc.stopError
    ? sizeForRisk(num(form.entry)!, num(form.initial_stop)!, planRisk)
    : null

  const validate = () => {
    const e: Record<string, string> = {}
    if (!accountId) e.account = 'Choose an account.'
    if (!/^[A-Za-z]{3}\/?[A-Za-z]{3}$/.test(form.instrument.trim())) e.instrument = 'Use a currency pair, like EUR/USD.'
    if (!form.side) e.side = 'Choose buy or sell.'
    if (!form.opened_at) e.opened_at = 'When did you enter?'
    if (num(form.entry) === null) e.entry = 'Enter the entry price.'
    if (calc.stopError) e.initial_stop = calc.stopError
    if (!(num(form.size) ?? 0)) e.size = 'Enter the size in lots, like 0.10.'
    if (form.closed) {
      if (!form.partial && num(form.exit_price) === null) e.exit_price = 'Enter the exit price, or mark the trade as still open.'
      if (form.partial && exitValue === null) e.exits = 'Each part needs a price and a size.'
      if (!form.closed_at) e.closed_at = 'When did it close?'
      if (form.closed_at && form.opened_at && form.closed_at < form.opened_at) e.closed_at = 'The close is before the entry.'
    }
    return e
  }

  const body = (): TradeInput => ({
    account: accountId,
    strategy_version: form.strategy_version || null,
    instrument: form.instrument.trim().toUpperCase(),
    side: form.side!,
    entry: dec(form.entry)!,
    initial_stop: dec(form.initial_stop),
    target: dec(form.target),
    exit_price: form.closed && !form.partial ? dec(form.exit_price) : null,
    exits: form.closed && form.partial ? form.exits.map((x) => ({ price: dec(x.price)!, size: dec(x.size)! })) : [],
    size: dec(form.size)!,
    opened_at: fromLocal(form.opened_at)!,
    closed_at: form.closed ? fromLocal(form.closed_at) : null,
    initial_risk_ccy: calc.sameCurrency ? null : dec(form.initial_risk_ccy),
    gross_pnl: calc.sameCurrency || !form.closed ? null : dec(form.gross_pnl),
    fees: dec(form.fees) ?? '0',
    swap: dec(form.swap) ?? '0',
    setup_key: form.setup_key.trim(),
    rule_checks: ruleList.map((rule) => ({ rule, followed: !!form.checks[rule] })),
    emotion_before: form.emotion_before,
    emotion_after: form.emotion_after,
    confidence: form.confidence ? Number(form.confidence) : null,
    sleep: form.sleep,
    distracted: form.distracted === '' ? null : form.distracted === 'yes',
    tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    notes: form.notes,
    images: form.images,
  })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!userId) return
    const found = validate()
    setErrors(found)
    setBanner(null)
    if (Object.keys(found).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    setBusy(true)
    const k = tradeKey ?? newClientId()
    queueSave(userId, k, body(), serverId)
    try {
      localStorage.setItem(LAST_KEY, JSON.stringify({ strategy_version: form.strategy_version, account: accountId, instrument: form.instrument, size: form.size, setup_key: form.setup_key }))
    } catch {
      /* not critical */
    }
    const result = await flushOutbox(userId)
    setBusy(false)
    if (result[k] === 'rejected') {
      const item = readOutbox(userId)[k]
      setErrors(flatten(item?.error?.fields))
      setBanner(item?.error?.message ?? 'Some fields need attention.')
      if (!tradeKey) navigate(`/journal/${k}`, { replace: true })
      return
    }
    for (const q of JOURNAL_KEYS) void queryClient.invalidateQueries({ queryKey: q })
    void queryClient.invalidateQueries({ queryKey: ['trade', tradeKey] })
    navigate('/journal', { state: { notice: result[k] === 'synced' ? (tradeKey ? 'Trade saved' : 'Trade logged') : 'Saved on this device · Syncs when you’re online' } })
  }

  const remove = async () => {
    if (!userId) return
    const k = tradeKey ?? ''
    queueDelete(userId, k, serverId)
    await flushOutbox(userId)
    for (const q of JOURNAL_KEYS) void queryClient.invalidateQueries({ queryKey: q })
    navigate('/journal', { state: { notice: 'Trade deleted' } })
  }

  // Paste a screenshot anywhere on the form (BT-6).
  const [uploading, setUploading] = useState<string | null>(null)
  const addImage = async (file: Blob, kind: TradeImage['kind']) => {
    if (form.images.length >= 4) return setErrors((e) => ({ ...e, images: 'Up to 4 screenshots per trade.' }))
    setUploading(kind)
    setErrors(({ images: _drop, ...rest }) => rest)
    try {
      const imageKey = await uploadScreenshot(file)
      setForm((f) => ({ ...f, images: [...f.images, { key: imageKey, kind }] }))
    } catch (err) {
      setErrors((e) => ({ ...e, images: (err as Error).message }))
    } finally {
      setUploading(null)
    }
  }
  const onPaste = (e: ClipboardEvent) => {
    const file = [...e.clipboardData.files].find((f) => f.type.startsWith('image/'))
    if (file) {
      e.preventDefault()
      void addImage(file, form.closed && exitValue !== null ? 'after' : 'before')
    }
  }

  const isNew = !tradeKey
  return (
    <form onSubmit={submit} onPaste={onPaste} noValidate className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start lg:gap-12">
      <div className="grid min-w-0 gap-8">
        <div>
          <Link to="/journal" className="inline-flex min-h-11 items-center gap-1 text-small font-semibold text-muted hover:text-text">
            <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Journal
          </Link>
          <h1 className="mt-1 text-h1 md:text-h1-lg">{isNew ? 'Log trade' : `${form.instrument} ${form.side ?? ''}`}</h1>
          <p className="mt-1 text-body text-muted">Practice trades never count toward a verdict.</p>
        </div>

        {banner && (
          <Banner kind="danger" title="This trade isn't saved yet">
            {banner}
          </Banner>
        )}

        <Section title="The trade">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Account"
              value={accountId}
              onChange={(e) => set('account', e.target.value)}
              options={liveAccounts.map((a) => ({ value: a.id, label: `${a.name} · ${a.currency}` }))}
              error={errors.account}
              aria-invalid={!!errors.account}
            />
            <Field
              label="Pair"
              value={form.instrument}
              onChange={(e) => set('instrument', e.target.value.toUpperCase())}
              list="instruments"
              autoComplete="off"
              error={errors.instrument}
              aria-invalid={!!errors.instrument}
            />
            {strategyOptions.length > 0 && (
              <SelectField
                label="Strategy (optional)"
                className="sm:col-span-2"
                value={form.strategy_version}
                onChange={(e) => set('strategy_version', e.target.value)}
                helper={form.strategy_version ? 'Its rules are the checklist below, and its risk limits are checked on save.' : 'Without one, the practice checklist is used.'}
                options={[{ value: '', label: 'None: practice checklist' }, ...strategyOptions.map((s) => ({ value: s.latest!.id, label: `${s.name} · version ${s.latest!.number}${s.latest!.locked ? '' : ' (draft)'}` }))]}
              />
            )}
            <datalist id="instruments">
              {INSTRUMENTS.map((i) => (
                <option key={i} value={i} />
              ))}
            </datalist>
          </div>
          <Segmented
            label="Direction"
            value={form.side}
            options={[{ value: 'buy', label: 'Buy' }, { value: 'sell', label: 'Sell' }]}
            onChange={(v) => set('side', v)}
            error={errors.side}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Entered at" type="datetime-local" value={form.opened_at} onChange={(e) => set('opened_at', e.target.value)} error={errors.opened_at} aria-invalid={!!errors.opened_at} />
            <Field label="Entry price" numeric inputMode="decimal" value={form.entry} onChange={(e) => set('entry', e.target.value)} error={errors.entry} aria-invalid={!!errors.entry} />
            <Field
                label="Initial stop"
                numeric
                inputMode="decimal"
                value={form.initial_stop}
                onChange={(e) => set('initial_stop', e.target.value)}
                readOnly={stopLocked}
                helper={stopLocked ? "Can't change after saving" : form.initial_stop ? undefined : 'No stop counts as a rule break'}
                error={errors.initial_stop}
                aria-invalid={!!errors.initial_stop}
              />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Target (optional)" numeric inputMode="decimal" value={form.target} onChange={(e) => set('target', e.target.value)} />
            <div>
              <Field label="Size" numeric inputMode="decimal" suffix="lots" value={form.size} onChange={(e) => set('size', e.target.value)} error={errors.size} aria-invalid={!!errors.size} />
              {suggested !== null && suggested > 0 && Number(form.size) !== suggested && (
                <button type="button" onClick={() => set('size', suggested.toFixed(2))} className="mt-1 min-h-11 text-small font-semibold text-accent-text underline underline-offset-4">
                  Use {suggested.toFixed(2)} lots ({planPct}% risk)
                </button>
              )}
            </div>
          </div>
        </Section>

        <Section title="Result">
          <Segmented
            label="Status"
            value={form.closed ? 'closed' : 'open'}
            options={[{ value: 'closed', label: 'Closed' }, { value: 'open', label: 'Still open' }]}
            onChange={(v) => set('closed', v === 'closed')}
          />
          {form.closed && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                {!form.partial && (
                  <Field label="Exit price" numeric inputMode="decimal" value={form.exit_price} onChange={(e) => set('exit_price', e.target.value)} error={errors.exit_price} aria-invalid={!!errors.exit_price} />
                )}
                <Field label="Closed at" type="datetime-local" value={form.closed_at} onFocus={() => !form.closed_at && set('closed_at', toLocal(new Date().toISOString()))} onChange={(e) => set('closed_at', e.target.value)} error={errors.closed_at} aria-invalid={!!errors.closed_at} />
              </div>
              {form.partial ? (
                <fieldset className="grid gap-2">
                  <legend className="mb-1 text-small font-semibold">Closed in parts</legend>
                  {form.exits.map((x, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                      <Field label={`Part ${i + 1} price`} numeric inputMode="decimal" value={x.price} onChange={(e) => set('exits', form.exits.map((y, j) => (j === i ? { ...y, price: e.target.value } : y)))} />
                      <Field label="Lots" numeric inputMode="decimal" value={x.size} onChange={(e) => set('exits', form.exits.map((y, j) => (j === i ? { ...y, size: e.target.value } : y)))} />
                      <button type="button" aria-label={`Remove part ${i + 1}`} onClick={() => set('exits', form.exits.filter((_, j) => j !== i))} className="inline-flex size-11 items-center justify-center rounded-md text-muted hover:bg-surface">
                        <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                  {(errors.exits || exitsMismatch(form)) && <p className="text-caption text-danger">{errors.exits ?? exitsMismatch(form)}</p>}
                  <div className="flex flex-wrap gap-4">
                    <button type="button" onClick={() => set('exits', [...form.exits, { price: '', size: '' }])} className="min-h-11 text-small font-semibold text-muted hover:text-text">
                      + Add a part
                    </button>
                    <button type="button" onClick={() => setForm((f) => ({ ...f, partial: false, exits: [] }))} className="min-h-11 text-small font-semibold text-muted hover:text-text">
                      Closed in one go
                    </button>
                  </div>
                </fieldset>
              ) : (
                <button type="button" onClick={() => setForm((f) => ({ ...f, partial: true, exits: [{ price: f.exit_price, size: f.size }, { price: '', size: '' }] }))} className="w-fit min-h-11 text-small font-semibold text-muted hover:text-text">
                  Closed in parts?
                </button>
              )}
            </>
          )}
          {!calc.sameCurrency && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={`Risk at the stop, in ${ccy}`} numeric inputMode="decimal" value={form.initial_risk_ccy} onChange={(e) => set('initial_risk_ccy', e.target.value)} helper="From your platform. Without it, R is estimated from prices." />
              {form.closed && <Field label={`Profit or loss, in ${ccy}`} numeric inputMode="decimal" value={form.gross_pnl} onChange={(e) => set('gross_pnl', e.target.value)} helper="Before commission and swap" />}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`Commission, in ${ccy}`} numeric inputMode="decimal" value={form.fees} onChange={(e) => set('fees', e.target.value)} placeholder="0" />
            <Field label={`Swap, in ${ccy}`} numeric inputMode="decimal" value={form.swap} onChange={(e) => set('swap', e.target.value)} placeholder="0" helper="Negative if you paid it" />
          </div>
        </Section>

        <Section title="Rule check" description="Tick each rule you followed. An unticked rule counts as broken.">
          {ruleList.length ? (
            <div className="grid gap-1">
              {ruleList.map((rule) => (
                <CheckboxRow key={rule} label={rule} checked={!!form.checks[rule]} onChange={(v) => set('checks', { ...form.checks, [rule]: v })} />
              ))}
            </div>
          ) : (
            <p className="text-small text-muted">
              No rules yet. <Link to="/journal/setup" className="font-semibold underline">Add your checklist</Link>.
            </p>
          )}
          {(neverAgain.data?.length ?? 0) > 0 && (
            <aside aria-label="Never again" className="rounded-md border border-border bg-surface p-4">
              <p className="text-small font-semibold">Your never-again list</p>
              <ul className="mt-2 grid gap-1 text-small text-muted">
                {neverAgain.data!.map((n) => (
                  <li key={n.id}>· {n.text}</li>
                ))}
              </ul>
            </aside>
          )}
        </Section>

        <Section title="Context" description="Optional, but it's what makes the journal useful later.">
          <Field label="Setup" value={form.setup_key} onChange={(e) => set('setup_key', e.target.value)} placeholder="e.g. pullback to 20 MA" helper="Use the same name each time, so results can be grouped" />
          <Chips label="Feeling before" value={form.emotion_before} onChange={(v) => set('emotion_before', v)} />
          {form.closed && <Chips label="Feeling after" value={form.emotion_after} onChange={(v) => set('emotion_after', v)} />}
          <div className="grid gap-4 md:grid-cols-3">
            <Segmented label="Confidence" value={form.confidence || undefined} options={['1', '2', '3', '4', '5'].map((v) => ({ value: v, label: v }))} onChange={(v) => set('confidence', form.confidence === v ? '' : v)} />
            <Segmented label="Sleep" value={form.sleep || undefined} options={[{ value: 'good', label: 'Good' }, { value: 'ok', label: 'OK' }, { value: 'poor', label: 'Poor' }]} onChange={(v) => set('sleep', form.sleep === v ? '' : v)} />
            <Segmented label="Distracted?" value={form.distracted || undefined} options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]} onChange={(v) => set('distracted', form.distracted === v ? '' : v)} />
          </div>
          <Field label="Tags" value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="e.g. replay, news day" helper="Separate with commas" />
        </Section>

        <Section title="Screenshots" description="Before and after charts. Paste one straight into the form, or pick a file.">
          <div className="grid gap-3 sm:grid-cols-2">
            {form.images.map((img) => (
              <Thumb key={img.key} image={img} onRemove={() => set('images', form.images.filter((i) => i.key !== img.key))} />
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {(['before', 'after'] as const).map((kind) => (
              <label key={kind} className={`${buttonClass('secondary')} cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus`}>
                <ImagePlus className="size-4" strokeWidth={1.75} aria-hidden="true" />
                {uploading === kind ? 'Uploading…' : `Add ${kind} screenshot`}
                <input type="file" accept="image/*" className="sr-only" disabled={!!uploading} onChange={(e) => e.target.files?.[0] && void addImage(e.target.files[0], kind)} />
              </label>
            ))}
          </div>
          {errors.images && <p role="alert" className="text-small text-danger">{errors.images}</p>}
        </Section>

        <Section title="Notes">
          <label htmlFor="notes" className="sr-only">
            Notes
          </label>
          <textarea id="notes" rows={5} maxLength={5000} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="What did you see? What would you do differently?" className="block w-full rounded-sm border border-control bg-raised px-3 py-2 text-body" />
        </Section>

        <div className="flex flex-wrap items-center gap-4 border-t border-border pb-12 pt-6 lg:pb-0">
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : isNew ? 'Log trade' : 'Save changes'}
          </Button>
          <Link to="/journal" className="inline-flex min-h-11 items-center text-small font-semibold text-muted hover:text-text">
            Cancel
          </Link>
          {!isNew &&
            (confirmDelete ? (
              <span className="ml-auto flex flex-wrap items-center gap-3" role="group" aria-label="Confirm delete">
                <span className="text-small">Delete this trade? This can&rsquo;t be undone.</span>
                <Button type="button" variant="danger" onClick={remove}>
                  Delete trade
                </Button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="min-h-11 text-small font-semibold text-muted hover:text-text">
                  Keep it
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="ml-auto min-h-11 text-small font-semibold text-danger">
                Delete trade
              </button>
            ))}
        </div>
      </div>

      <LiveSummary calc={calc} ccy={ccy} closed={form.closed} plan={planPct} saved={saved} />

      {/* Phones: the live figures stay in view above the tab bar while the form scrolls. */}
      <div aria-hidden="true" className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-surface px-4 py-2 lg:hidden">
        <div className="flex justify-between gap-3 font-mono text-small">
          <span>
            <span className="font-sans text-caption text-subtle">Risk </span>
            {calc.riskCcy !== null ? formatMoney(calc.riskCcy, ccy) : '—'}
            {calc.riskPct !== null && <span className="text-subtle"> · {formatPct(calc.riskPct)}</span>}
          </span>
          {form.closed && (
            <span className={calc.r === null ? '' : calc.r > 0 ? 'text-gain' : calc.r < 0 ? 'text-loss' : ''}>
              <span className="font-sans text-caption text-subtle">R </span>
              {calc.r !== null ? `${calc.rEstimated ? '≈' : ''}${formatR(calc.r)}` : '—'}
            </span>
          )}
        </div>
      </div>
    </form>
  )
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-4">
      <legend className="contents">
        <span className="block text-h3">{title}</span>
      </legend>
      {description && <p className="-mt-2 text-small text-muted">{description}</p>}
      {children}
    </fieldset>
  )
}

function Chips({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <fieldset>
      <legend className="mb-1 text-small font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {EMOTIONS.map((e) => {
          const on = value === e
          return (
            <button
              key={e}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? '' : e)}
              className={`min-h-11 rounded-full border px-4 text-small font-semibold ${on ? 'border-text bg-text text-bg' : 'border-control text-muted hover:text-text'}`}
            >
              {EMOTION_LABEL[e]}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function Thumb({ image, onRemove }: { image: TradeImage; onRemove: () => void }) {
  const shot = useScreenshot(image.key)
  return (
    <figure className="relative overflow-hidden rounded-md border border-border bg-surface">
      {shot.url ? (
        <img src={shot.url} alt={`${image.kind} screenshot`} className="aspect-video w-full object-cover" />
      ) : (
        <button type="button" onClick={shot.load} className="flex aspect-video w-full items-center justify-center text-small text-muted">
          {shot.loading ? 'Loading…' : shot.error ? "Couldn't load" : 'Show screenshot'}
        </button>
      )}
      <figcaption className="flex items-center justify-between px-3 py-1 text-caption capitalize text-muted">
        {image.kind}
        <button type="button" onClick={onRemove} aria-label={`Remove ${image.kind} screenshot`} className="inline-flex size-11 items-center justify-center rounded-md hover:bg-raised">
          <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </figcaption>
    </figure>
  )
}

function LiveSummary({ calc, ccy, closed, plan, saved }: { calc: ReturnType<typeof calcTrade>; ccy: string; closed: boolean; plan: number | null; saved?: Trade }) {
  const over = calc.riskPct !== null && plan !== null && calc.riskPct > plan * 1.25
  return (
    <aside aria-label="Trade summary" className="grid gap-4 rounded-lg border border-border bg-surface p-4 md:p-6 lg:sticky lg:top-24">
      <p className="text-small font-semibold text-muted">As it stands</p>
      <dl className="grid grid-cols-2 gap-4">
        <SummaryItem label="Risk" value={calc.riskCcy !== null ? formatMoney(calc.riskCcy, ccy) : '—'} note={calc.riskPct !== null ? `${formatPct(calc.riskPct)} of balance` : calc.stopPips === null ? 'Needs a stop' : undefined} warn={over} />
        <SummaryItem label="Stop" value={calc.stopPips !== null ? `${calc.stopPips.toFixed(1)} pips` : '—'} />
        {closed && <SummaryItem label="Net P&L" value={calc.pnl !== null ? formatMoney(calc.pnl, ccy, { signed: true }) : '—'} />}
        {closed && (
          <SummaryItem
            label="Result"
            value={calc.r !== null ? `${calc.rEstimated ? '≈' : ''}${formatR(calc.r)}` : '—'}
            note={calc.rEstimated ? 'From prices; costs not included' : calc.r !== null ? OUTCOME_WORD[calc.outcome] : undefined}
            tone={calc.r !== null ? (calc.r > 0 ? 'gain' : calc.r < 0 ? 'loss' : undefined) : undefined}
          />
        )}
      </dl>
      {over && <p className="text-small text-loss">That&rsquo;s more than 1.25× your planned {plan}% risk.</p>}
      {saved?.after_loss && <p className="text-small text-muted">Opened after a losing trade.</p>}
      {(saved?.plan_warnings?.length ?? 0) > 0 && (
        <div className="grid gap-1 border-t border-border pt-3">
          <p className="text-small font-semibold">Outside the plan</p>
          <ul className="grid gap-1 text-small text-muted">
            {saved!.plan_warnings!.map((w) => (
              <li key={w.code}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-caption text-subtle">R = net profit or loss ÷ the risk at your initial stop. The server recalculates when the trade saves.</p>
    </aside>
  )
}

function SummaryItem({ label, value, note, warn, tone }: { label: string; value: string; note?: string; warn?: boolean; tone?: 'gain' | 'loss' }) {
  return (
    <div>
      <dt className="text-caption text-subtle">{label}</dt>
      <dd className={`font-mono text-h3 ${tone === 'gain' ? 'text-gain' : tone === 'loss' ? 'text-loss' : warn ? 'text-loss' : ''}`}>{value}</dd>
      {note && <dd className="text-caption text-muted">{note}</dd>}
    </div>
  )
}

function weightedExit(exits: Form['exits']): number | null {
  const parts = exits.map((x) => [num(x.price), num(x.size)] as const)
  if (!parts.length || parts.some(([p, s]) => p === null || !s)) return null
  const total = parts.reduce((a, [, s]) => a + s!, 0)
  return parts.reduce((a, [p, s]) => a + p! * s!, 0) / total
}

function exitsMismatch(form: Form): string | null {
  const total = form.exits.reduce((a, x) => a + (num(x.size) ?? 0), 0)
  const size = num(form.size) ?? 0
  return form.exits.length && size && Math.abs(total - size) > 0.001 ? `The parts add up to ${total.toFixed(2)} lots; the trade is ${size.toFixed(2)}.` : null
}

function flatten(fields?: Record<string, string[]>): Record<string, string> {
  return Object.fromEntries(Object.entries(fields ?? {}).map(([k, v]) => [k, v[0]]))
}

/** A version's rules as checklist sentences: setup conditions, entry, stop and no-trade rules. */
function versionRules(v: VersionDoc): string[] {
  const r = v.rules
  return [
    ...r.setup.conditions.map(describeCondition),
    ...(r.entry ? [describeEntry(r)] : []),
    ...(r.stop ? [describeStop(r)] : []),
    ...describeNoTrade(r).filter((x) => x !== 'No no-trade rules.'),
  ]
}
