import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useInfiniteQuery } from '@tanstack/react-query'
import { AlertTriangle, Check, CloudOff, Download, Search, X } from 'lucide-react'
import { Banner, EmptyState, SelectField, buttonClass } from '../../components/ui'
import { api, apiRaw } from '../../lib/api/client'
import { formatCount, formatR, tone } from '../../lib/format'
import { useSession } from '../../lib/session'
import { qs, useAccounts, useActivity, type Trade, type TradeFilters, type TradingAccount } from './api'
import { calcTrade } from './calc'
import { useOutbox, type Pending } from './outbox'

/**
 * Journal list (DESIGN.md §12): grouped by day; each row shows pair,
 * direction, R (mono, signed, coloured), the rule-followed icon with its
 * label, and an "after a loss" tag. Trades waiting to sync appear in place.
 */
type Page = { results: Trade[]; next: string | null }
type Row = Pick<Trade, 'instrument' | 'side' | 'opened_at' | 'outcome' | 'r_result' | 'r_estimated' | 'rules_followed' | 'after_loss' | 'plan_warnings'> & {
  key: string
  href: string
  state?: 'waiting' | 'rejected'
}

const TONE = { gain: 'text-gain', loss: 'text-loss', neutral: 'text-text' } as const

const OUTCOMES = [
  { value: '', label: 'All results' },
  { value: 'win', label: 'Wins' },
  { value: 'loss', label: 'Losses' },
  { value: 'breakeven', label: 'Breakeven' },
  { value: 'open', label: 'Open' },
]
const RULES = [
  { value: '', label: 'All trades' },
  { value: 'followed', label: 'Rules followed' },
  { value: 'broken', label: 'Rules broken' },
]

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

function pendingRow(p: Pending, accounts: TradingAccount[] | undefined): Row | null {
  if (p.op !== 'save' || !p.body) return null
  const b = p.body
  const account = accounts?.find((a) => a.id === b.account)
  const num = (s: string | null) => (s === null || s === '' ? null : Number(s))
  const c = calcTrade({
    instrument: b.instrument, side: b.side, entry: num(b.entry), stop: num(b.initial_stop), exit: num(b.exit_price),
    size: num(b.size), accountCurrency: account?.currency ?? 'USD', riskCcy: num(b.initial_risk_ccy), grossPnl: num(b.gross_pnl),
    fees: num(b.fees), swap: num(b.swap),
  })
  return {
    key: p.key,
    href: `/journal/${p.key}`,
    instrument: b.instrument,
    side: b.side,
    opened_at: b.opened_at,
    outcome: c.outcome,
    r_result: c.r,
    r_estimated: c.rEstimated,
    rules_followed: b.initial_stop !== null && b.rule_checks.every((r) => r.followed),
    after_loss: false,
    state: p.error ? 'rejected' : 'waiting',
  }
}

const cacheKey = (userId: string) => `edgeproof.cache.${userId}.trades`
function readCachedPage(userId: string): Page | undefined {
  try {
    const raw = localStorage.getItem(cacheKey(userId))
    return raw ? (JSON.parse(raw) as Page) : undefined
  } catch {
    return undefined
  }
}

const dayLabel = (iso: string) => {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(Date.now() - 86_400_000)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
}

export default function TradesPage() {
  const session = useSession()
  const userId = session.status === 'signed-in' ? session.me.id : undefined
  const accounts = useAccounts(userId)
  const outbox = useOutbox(userId)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<TradeFilters>({})
  const q = useDebounced(search.trim())
  const active: TradeFilters = { ...filters, q: q || undefined }
  const filtered = Object.values(active).some(Boolean)

  const trades = useInfiniteQuery({
    queryKey: ['trades', active],
    queryFn: ({ pageParam }) => api<Page>(`/me/trades${qs({ ...active, cursor: pageParam, limit: '50' })}`),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.next ? (new URL(last.next, location.origin).searchParams.get('cursor') ?? undefined) : undefined),
    enabled: !!userId,
    // Offline (or before the server wakes), show the last trades seen on this device.
    placeholderData: () => {
      const cached = !filtered && userId ? readCachedPage(userId) : undefined
      return cached ? { pages: [cached], pageParams: [undefined] } : undefined
    },
  })
  useEffect(() => {
    if (!userId || filtered || trades.isPlaceholderData || !trades.data?.pages[0]) return
    try {
      localStorage.setItem(cacheKey(userId), JSON.stringify(trades.data.pages[0]))
    } catch {
      /* storage blocked */
    }
  }, [userId, filtered, trades.data, trades.isPlaceholderData])

  const rows = useMemo(() => {
    const pending = Object.values(outbox)
    const hidden = new Set(pending.filter((p) => p.op === 'delete' || p.id).map((p) => p.id ?? p.key))
    const server: Row[] = (trades.data?.pages ?? [])
      .flatMap((p) => p.results)
      .filter((t) => !hidden.has(t.id) || pending.some((p) => p.id === t.id && p.op === 'save'))
      .map((t) => {
        const local = pending.find((p) => p.id === t.id && p.op === 'save')
        const preview = local ? pendingRow(local, accounts.data) : null
        return preview ? { ...preview, key: t.id, href: `/journal/${t.id}` } : { ...t, key: t.id, href: `/journal/${t.id}` }
      })
    const fresh = filtered ? [] : pending.filter((p) => !p.id).map((p) => pendingRow(p, accounts.data)).filter((r): r is Row => !!r)
    return [...fresh, ...server].sort((a, b) => b.opened_at.localeCompare(a.opened_at))
  }, [trades.data, outbox, accounts.data, filtered])

  const groups = useMemo(() => {
    const out: { label: string; rows: Row[] }[] = []
    for (const r of rows) {
      const label = dayLabel(r.opened_at)
      if (out.at(-1)?.label !== label) out.push({ label, rows: [] })
      out.at(-1)!.rows.push(r)
    }
    return out
  }, [rows])

  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const exportCsv = async () => {
    setExporting(true)
    setExportError(null)
    try {
      const blob = await (await apiRaw('/me/trades/export.csv')).blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'edgeproof-journal.csv'
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (err) {
      setExportError((err as Error).message)
    } finally {
      setExporting(false)
    }
  }

  const accountOptions = [{ value: '', label: 'All accounts' }, ...(accounts.data ?? []).map((a) => ({ value: a.id, label: a.name }))]

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:items-start lg:gap-12">
      <div className="min-w-0">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-end">
          <div>
            <label htmlFor="journal-search" className="mb-1 block text-small font-semibold">
              Search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" strokeWidth={1.75} aria-hidden="true" />
              <input
                id="journal-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Notes, setup, pair, tag or broken rule"
                className="block min-h-11 w-full rounded-sm border border-control bg-raised pl-9 pr-3 text-body"
              />
            </div>
          </div>
          <SelectField label="Account" value={filters.account ?? ''} options={accountOptions} onChange={(e) => setFilters({ ...filters, account: e.target.value || undefined })} />
          <SelectField label="Result" value={filters.outcome ?? ''} options={OUTCOMES} onChange={(e) => setFilters({ ...filters, outcome: e.target.value || undefined })} />
          <SelectField label="Rules" value={filters.rules ?? ''} options={RULES} onChange={(e) => setFilters({ ...filters, rules: e.target.value || undefined })} />
        </div>
        {filtered && (
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setFilters({})
            }}
            className="mt-2 inline-flex min-h-11 items-center gap-1 text-small font-semibold text-muted hover:text-text"
          >
            <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Clear filters
          </button>
        )}

        <div className="mt-6">
          {trades.isError && !rows.length ? (
            <Banner kind="danger" title="Couldn't load your trades">
              {(trades.error as Error).message} Trades you log now are saved on this device and sync later.
            </Banner>
          ) : trades.isPending && !rows.length ? (
            <div className="grid gap-2" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-md bg-surface motion-reduce:animate-none" />
              ))}
            </div>
          ) : !rows.length ? (
            filtered ? (
              <EmptyState message="No trades match these filters." />
            ) : (
              <EmptyState
                message="No trades yet. Log your first practice trade to start building your record. Practice trades never count toward a verdict."
                action={
                  <Link to="/journal/new" className={buttonClass('primary')}>
                    Log trade
                  </Link>
                }
              />
            )
          ) : (
            <div className="grid gap-6">
              {groups.map((g) => (
                <section key={g.label} aria-label={g.label}>
                  <h2 className="mb-1 text-small font-semibold text-muted">{g.label}</h2>
                  <ul className="grid">
                    {g.rows.map((r) => (
                      <TradeRow key={r.key} row={r} />
                    ))}
                  </ul>
                </section>
              ))}
              {trades.hasNextPage && (
                <button type="button" onClick={() => trades.fetchNextPage()} disabled={trades.isFetchingNextPage} className={`${buttonClass('secondary')} w-fit`}>
                  {trades.isFetchingNextPage ? 'Loading…' : 'Show older trades'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <aside className="grid gap-6 lg:sticky lg:top-24">
        <StreakCard enabled={!!userId} />
        <button type="button" onClick={exportCsv} disabled={exporting} className={`${buttonClass('secondary')} w-fit`}>
          <Download className="size-4" strokeWidth={1.75} aria-hidden="true" />
          {exporting ? 'Preparing…' : 'Export CSV'}
        </button>
        {exportError && (
          <p role="alert" className="-mt-4 text-small text-loss">
            {exportError}
          </p>
        )}
      </aside>
    </div>
  )
}

function TradeRow({ row }: { row: Row }) {
  const r = row.r_result
  const closed = row.outcome !== 'open'
  return (
    <li>
      <Link to={row.href} className="flex min-h-14 items-center gap-3 border-t border-border px-2 hover:bg-surface md:px-3">
        <span className="w-20 shrink-0 font-mono text-small font-medium md:w-24">{row.instrument}</span>
        <span className={`w-10 shrink-0 text-caption font-semibold uppercase ${row.side === 'buy' ? 'text-gain' : 'text-loss'}`}>{row.side}</span>
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-caption">
          {row.rules_followed ? (
            <span className="inline-flex items-center gap-1 text-muted">
              <Check className="size-3.5" strokeWidth={2} aria-hidden="true" />
              Rules followed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-loss">
              <AlertTriangle className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              Rule broken
            </span>
          )}
          {row.after_loss && <span className="rounded-sm border border-border px-1.5 text-subtle">After a loss</span>}
          {(row.plan_warnings?.length ?? 0) > 0 && <span className="rounded-sm border border-warning px-1.5 text-warning">Outside plan</span>}
          {row.state === 'waiting' && (
            <span className="inline-flex items-center gap-1 text-subtle">
              <CloudOff className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              On this device
            </span>
          )}
          {row.state === 'rejected' && <span className="font-semibold text-loss">Not saved · open to fix</span>}
        </span>
        <span className={`shrink-0 text-right font-mono text-body ${closed && r !== null ? TONE[tone(r)] : 'text-subtle'}`}>
          {!closed ? 'Open' : r === null ? 'No stop' : `${row.r_estimated ? '≈' : ''}${formatR(r)}`}
        </span>
      </Link>
    </li>
  )
}

/** Journaling streak and a 12-week calendar (DE-9; Strava's training calendar). Never about profit. */
function StreakCard({ enabled }: { enabled: boolean }) {
  const activity = useActivity(enabled)
  const a = activity.data
  if (activity.isError && !a) return null
  if (!a) return <div className="h-40 animate-pulse rounded-lg bg-surface motion-reduce:animate-none" aria-hidden="true" />
  const end = new Date(`${a.today}T00:00:00`)
  const start = new Date(end)
  start.setDate(end.getDate() - ((end.getDay() + 6) % 7) - 7 * 11) // Monday, 12 weeks back
  const weeks: { date: string; n: number | undefined; future: boolean }[][] = []
  for (let w = 0; w < 12; w++) {
    const col = []
    for (let d = 0; d < 7; d++) {
      const day = new Date(start)
      day.setDate(start.getDate() + w * 7 + d)
      const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
      col.push({ date: iso, n: a.days[iso], future: day > end })
    }
    weeks.push(col)
  }
  const activeDays = Object.keys(a.days).length
  return (
    <section aria-labelledby="streak" className="rounded-lg border border-border bg-surface p-4 md:p-6">
      <p id="streak" className="text-small font-semibold text-muted">
        Journaling streak
      </p>
      <p className="mt-1 font-mono text-figure font-medium">{formatCount(a.streak, 'day')}</p>
      <p className="text-caption text-subtle">
        Best {formatCount(a.best_streak, 'day')} · {formatCount(a.total_trades, 'trade')} logged
        {!a.logged_today && a.streak > 0 ? ' · log or review today to keep it going' : ''}
      </p>
      <div className="mt-4 flex gap-1" role="img" aria-label={`Journal activity, last 12 weeks: ${activeDays} active days.`}>
        {weeks.map((col, i) => (
          <div key={i} className="grid gap-1">
            {col.map((d) => (
              <span
                key={d.date}
                title={d.future ? undefined : `${d.date}: ${d.n === undefined ? 'nothing logged' : d.n ? formatCount(d.n, 'trade') : 'review'}`}
                className={`size-3 rounded-[2px] ${d.future ? 'bg-transparent' : d.n === undefined ? 'bg-border' : d.n >= 3 ? 'bg-text' : 'bg-neutral-data'}`}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}
