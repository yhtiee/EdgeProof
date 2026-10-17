import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { Banner, Button, Field, SelectField } from '../../components/ui'
import { api } from '../../lib/api/client'
import { useSession } from '../../lib/session'
import { ACCOUNTS, NEVER_AGAIN, RULES, useAccounts, useNeverAgain, useRules, type TradingAccount } from './api'

/**
 * Journal setup: trading accounts (JR-2), the practice checklist ticked on
 * every trade (JR-5) and the never-again list shown on the form (DE-5).
 * When a strategy rulebook exists, its rules replace the practice checklist.
 */
export default function SetupPage() {
  const session = useSession()
  const userId = session.status === 'signed-in' ? session.me.id : undefined
  return (
    <div className="grid gap-10 xl:grid-cols-2 xl:items-start">
      <Accounts userId={userId} />
      <div className="grid gap-10">
        <ListEditor
          userId={userId}
          title="Practice checklist"
          description="Ticked on every trade. An unticked rule counts as broken. Once you build a strategy rulebook, its rules take over."
          path="/me/practice-rules"
          queryKey={RULES}
          useItems={useRules}
          placeholder="e.g. I waited for a candle close"
          max={160}
          togglable
        />
        <ListEditor
          userId={userId}
          title="Never-again list"
          description="Mistakes you've decided not to repeat. Shown on the log form as a reminder."
          path="/me/never-again"
          queryKey={NEVER_AGAIN}
          useItems={useNeverAgain}
          placeholder="e.g. Never move my stop further away"
          max={200}
        />
      </div>
    </div>
  )
}

const KINDS = [
  { value: 'demo', label: 'Demo' },
  { value: 'live', label: 'Live' },
  { value: 'prop', label: 'Prop firm' },
]

function Accounts({ userId }: { userId: string | undefined }) {
  const accounts = useAccounts(userId)
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  return (
    <section aria-labelledby="accounts-h" className="grid gap-4">
      <div>
        <h2 id="accounts-h" className="text-h3">
          Trading accounts
        </h2>
        <p className="mt-1 text-small text-muted">The balance and planned risk per trade work out your risk % and suggest a size on each trade.</p>
      </div>
      <ul className="grid gap-3">
        {(accounts.data ?? []).map((a) =>
          editing === a.id ? (
            <li key={a.id}>
              <AccountForm account={a} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li key={a.id} className={`flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-4 ${a.archived ? 'opacity-60' : ''}`}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {a.name}
                  {a.archived && <span className="ml-2 text-caption font-normal text-subtle">Archived</span>}
                </p>
                <p className="text-small text-muted">
                  {KINDS.find((k) => k.value === a.kind)?.label} · {a.currency}
                  {a.balance && ` · balance ${Number(a.balance).toLocaleString()}`} · {Number(a.risk_per_trade_pct)}% a trade
                  {a.broker && ` · ${a.broker}`}
                </p>
              </div>
              <button type="button" onClick={() => setEditing(a.id)} className="min-h-11 px-2 text-small font-semibold text-muted hover:text-text">
                Edit
              </button>
            </li>
          ),
        )}
      </ul>
      {editing === 'new' ? (
        <AccountForm onDone={() => setEditing(null)} />
      ) : (
        <Button variant="secondary" className="w-fit" onClick={() => setEditing('new')}>
          Add account
        </Button>
      )}
    </section>
  )
}

function AccountForm({ account, onDone }: { account?: TradingAccount; onDone: () => void }) {
  const queryClient = useQueryClient()
  const [v, setV] = useState({
    name: account?.name ?? '',
    kind: account?.kind ?? 'demo',
    broker: account?.broker ?? '',
    currency: account?.currency ?? 'USD',
    balance: account?.balance ?? '',
    risk_per_trade_pct: account ? String(Number(account.risk_per_trade_pct)) : '1',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    setBanner(null)
    try {
      const body = { ...v, balance: v.balance === '' ? null : v.balance, currency: v.currency.toUpperCase() }
      await api(account ? `/me/trading-accounts/${account.id}` : '/me/trading-accounts', { method: account ? 'PATCH' : 'POST', body })
      await queryClient.invalidateQueries({ queryKey: ACCOUNTS })
      onDone()
    } catch (err) {
      const fields = (err as { fields?: Record<string, string[]> }).fields ?? {}
      setErrors(Object.fromEntries(Object.entries(fields).map(([k, x]) => [k, x[0]])))
      if (!Object.keys(fields).length) setBanner((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const archive = async () => {
    if (!account) return
    await api(`/me/trading-accounts/${account.id}`, { method: 'PATCH', body: { archived: !account.archived } })
    await queryClient.invalidateQueries({ queryKey: ACCOUNTS })
    onDone()
  }

  return (
    <form onSubmit={save} className="grid gap-4 rounded-lg border border-border bg-surface p-4" noValidate>
      {banner && <Banner kind="danger" title="Couldn't save">{banner}</Banner>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} error={errors.name} maxLength={60} required />
        <SelectField label="Type" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value as TradingAccount['kind'] })} options={KINDS} />
        <Field label="Currency" value={v.currency} onChange={(e) => setV({ ...v, currency: e.target.value.toUpperCase() })} error={errors.currency} maxLength={3} helper="3 letters, like USD or NGN" />
        <Field label="Broker (optional)" value={v.broker} onChange={(e) => setV({ ...v, broker: e.target.value })} maxLength={80} />
        <Field label="Balance (optional)" numeric inputMode="decimal" value={v.balance} onChange={(e) => setV({ ...v, balance: e.target.value })} error={errors.balance} />
        <Field label="Planned risk per trade" numeric inputMode="decimal" suffix="%" value={v.risk_per_trade_pct} onChange={(e) => setV({ ...v, risk_per_trade_pct: e.target.value })} error={errors.risk_per_trade_pct} helper="1% or less while you learn" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : account ? 'Save account' : 'Add account'}
        </Button>
        <button type="button" onClick={onDone} className="min-h-11 px-2 text-small font-semibold text-muted hover:text-text">
          Cancel
        </button>
        {account && (
          <button type="button" onClick={archive} className="ml-auto min-h-11 px-2 text-small font-semibold text-muted hover:text-text">
            {account.archived ? 'Unarchive' : 'Archive'}
          </button>
        )}
      </div>
    </form>
  )
}

type Item = { id: string; text: string; order: number; active?: boolean }

function ListEditor({
  userId,
  title,
  description,
  path,
  queryKey,
  useItems,
  placeholder,
  max,
  togglable,
}: {
  userId: string | undefined
  title: string
  description: string
  path: string
  queryKey: readonly string[]
  useItems: (userId: string | undefined) => { data?: Item[] }
  placeholder: string
  max: number
  togglable?: boolean
}) {
  const queryClient = useQueryClient()
  const items = useItems(userId).data ?? []
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const refresh = () => queryClient.invalidateQueries({ queryKey })
  const run = async (fn: () => Promise<unknown>) => {
    setError(null)
    try {
      await fn()
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const add = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    void run(async () => {
      await api(path, { method: 'POST', body: { text: text.trim(), order: (items.at(-1)?.order ?? -1) + 1 } })
      setText('')
    })
  }
  const move = (i: number, dir: -1 | 1) => {
    const a = items[i]
    const b = items[i + dir]
    if (!b) return
    void run(() =>
      Promise.all([
        api(`${path}/${a.id}`, { method: 'PATCH', body: { order: b.order === a.order ? a.order + dir : b.order } }),
        api(`${path}/${b.id}`, { method: 'PATCH', body: { order: a.order } }),
      ]),
    )
  }

  const titleId = `${path.replace(/\W/g, '')}-h`
  return (
    <section aria-labelledby={titleId} className="grid gap-4">
      <div>
        <h2 id={titleId} className="text-h3">
          {title}
        </h2>
        <p className="mt-1 text-small text-muted">{description}</p>
      </div>
      <ol className="grid">
        {items.map((item, i) => (
          <li key={item.id} className="flex min-h-12 items-center gap-2 border-t border-border">
            <span className={`min-w-0 flex-1 text-body ${item.active === false ? 'text-subtle line-through' : ''}`}>{item.text}</span>
            {togglable && (
              <button type="button" onClick={() => run(() => api(`${path}/${item.id}`, { method: 'PATCH', body: { active: !item.active } }))} className="min-h-11 px-2 text-caption font-semibold text-muted hover:text-text">
                {item.active === false ? 'Turn on' : 'Turn off'}
              </button>
            )}
            <IconButton label={`Move "${item.text}" up`} onClick={() => move(i, -1)} disabled={i === 0}>
              <ArrowUp className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </IconButton>
            <IconButton label={`Move "${item.text}" down`} onClick={() => move(i, 1)} disabled={i === items.length - 1}>
              <ArrowDown className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </IconButton>
            <IconButton label={`Delete "${item.text}"`} onClick={() => run(() => api(`${path}/${item.id}`, { method: 'DELETE' }))}>
              <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </IconButton>
          </li>
        ))}
      </ol>
      <form onSubmit={add} className="flex items-end gap-2">
        <div className="flex-1">
          <Field label={`Add to ${title.toLowerCase()}`} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} maxLength={max} />
        </div>
        <Button type="submit" variant="secondary" disabled={!text.trim()}>
          Add
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-small text-loss">
          {error}
        </p>
      )}
    </section>
  )
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} disabled={disabled} className="inline-flex size-11 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-text disabled:opacity-30">
      {children}
    </button>
  )
}
