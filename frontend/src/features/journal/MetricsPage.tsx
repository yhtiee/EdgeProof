import { useState } from 'react'
import { Link } from 'react-router'
import { Banner, EmptyState, RangeBar, SelectField, Stat, buttonClass } from '../../components/ui'
import { formatCount, formatPct, formatR, tone } from '../../lib/format'
import { useSession } from '../../lib/session'
import { EMOTION_LABEL, SESSION_LABEL, WEEKDAYS, useAccounts, useMetrics, type Breakdown, type Metrics, type TradeFilters } from './api'

/**
 * Core metrics (spec §8) for practice trades, in R. Stripe-style tiles,
 * ranges instead of single numbers (DESIGN.md §1), breakdowns as sorted
 * horizontal bars with a zero line (DESIGN.md §8). Practice results never
 * feed a verdict; the page says so.
 */
const pct = (x: number | null, digits = 0) => (x === null ? '—' : formatPct(x * 100, { digits }))

const PERIODS = [
  { value: '', label: 'All time' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 12 months' },
]

export default function MetricsPage() {
  const session = useSession()
  const userId = session.status === 'signed-in' ? session.me.id : undefined
  const accounts = useAccounts(userId)
  const [account, setAccount] = useState('')
  const [period, setPeriod] = useState('')
  const from = period ? new Date(Date.now() - Number(period) * 86_400_000).toISOString().slice(0, 10) : undefined
  const filters: TradeFilters = { account: account || undefined, from }
  const metrics = useMetrics(filters, !!userId)
  const m = metrics.data

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-end gap-3">
        <SelectField
          label="Account"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          options={[{ value: '', label: 'All accounts' }, ...(accounts.data ?? []).map((a) => ({ value: a.id, label: a.name }))]}
        />
        <SelectField label="Period" value={period} onChange={(e) => setPeriod(e.target.value)} options={PERIODS} />
      </div>

      {metrics.isError ? (
        <Banner kind="danger" title="Couldn't load metrics">
          {(metrics.error as Error).message} Metrics are worked out on the server, so they need a connection.
        </Banner>
      ) : !m ? (
        <div className="grid gap-4 md:grid-cols-4" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-surface motion-reduce:animate-none" />
          ))}
        </div>
      ) : m.trades === 0 ? (
        <EmptyState
          message={m.closed ? 'None of these closed trades has an initial stop, so there are no R results to measure yet.' : 'Metrics appear once you have closed trades with an initial stop.'}
          action={
            <Link to="/journal/new" className={buttonClass('primary')}>
              Log trade
            </Link>
          }
        />
      ) : (
        <Report m={m} />
      )}
    </div>
  )
}

function Report({ m }: { m: Metrics }) {
  const range = m.expectancy_range
  const small = m.trades < m.min_for_ranges
  return (
    <>
      <p className="max-w-[70ch] text-small text-muted">
        {formatCount(m.trades, 'closed trade')} with a stop
        {m.independent_trades < m.trades && ` (${formatCount(m.independent_trades, 'independent result')}, counting overlapping trades in the same currency once)`}.
        {m.excluded_no_stop > 0 && ` ${formatCount(m.excluded_no_stop, 'trade')} without a stop ${m.excluded_no_stop === 1 ? 'is' : 'are'} left out of R results and counted as rule breaks.`}
        {m.open > 0 && ` ${formatCount(m.open, 'open trade')} not counted yet.`} Practice trades never count toward a verdict.
      </p>

      <section aria-label="Headline figures" className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
        <Tile>
          <Stat label="Expectancy" value={m.expectancy !== null ? formatR(m.expectancy) : '—'} tone={tone(m.expectancy ?? 0)} sample={`per trade · ${formatCount(m.trades, 'trade')}`}>
            {range && <RangeBar label="Likely range" estimate={m.expectancy!} low={range.low} high={range.high} compact />}
          </Stat>
        </Tile>
        <Tile>
          <Stat label="Win rate" value={pct(m.win_rate)} sample={`${m.wins} won · ${m.losses} lost · ${m.breakevens} breakeven`} />
        </Tile>
        <Tile>
          <Stat label="Profit factor" value={m.profit_factor === null ? '—' : m.profit_factor.toFixed(2)} sample={m.profit_factor === null ? 'No losing trades yet' : 'Winning R ÷ losing R'} />
        </Tile>
        <Tile>
          <Stat label="Total" value={formatR(m.total_r, 1)} tone={tone(m.total_r)} sample={`Avg win ${m.avg_win !== null ? formatR(m.avg_win) : '—'} · avg loss ${m.avg_loss !== null ? formatR(m.avg_loss) : '—'}`} />
        </Tile>
      </section>

      {small ? (
        <Banner kind="info" title={`Ranges appear at ${m.min_for_ranges} trades`}>
          With {formatCount(m.trades, 'trade')}, luck can make almost any result. Keep logging; the likely range for your expectancy and the drawdown to expect show up at {m.min_for_ranges}.
        </Banner>
      ) : (
        range && (
          <section aria-labelledby="range-h" className="rounded-lg border border-border bg-surface p-4 md:p-6">
            <h2 id="range-h" className="text-h3">
              How sure is this?
            </h2>
            <p className="mt-1 max-w-[70ch] text-small text-muted">
              Resampling your trades week by week 10,000 times, the average trade most likely sits between {formatR(range.low)} and {formatR(range.high)}.
              {range.no_edge_pct !== null && ` Results this good can occur with no real edge ${Math.round(range.no_edge_pct)}% of the time.`}
            </p>
            <RangeBar className="mt-4 max-w-xl" label="Expectancy per trade" estimate={m.expectancy!} low={range.low} high={range.high} />
          </section>
        )
      )}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="curve-h" className="min-w-0 rounded-lg border border-border bg-surface p-4 md:p-6">
          <h2 id="curve-h" className="text-h3">
            Running total, in R
          </h2>
          <Curve points={m.curve} />
        </section>

        <section aria-labelledby="dd-h" className="grid content-start gap-4 rounded-lg border border-border bg-surface p-4 md:p-6">
          <h2 id="dd-h" className="text-h3">
            Drawdown
          </h2>
          <dl className="grid grid-cols-2 gap-4">
            <Fact label="Worst so far" value={formatR(-m.max_drawdown_r, 1)} note={`≈ ${formatPct(m.max_drawdown_r * m.risk_per_trade_pct, { digits: 1 })} at ${m.risk_per_trade_pct}% a trade`} />
            <Fact label="Longest losing run" value={formatCount(m.longest_losing_streak, 'trade')} />
          </dl>
          {m.expected ? (
            <>
              <RangeBar
                label="Drawdown to expect"
                estimate={-m.expected.drawdown_r[1]}
                low={-m.expected.drawdown_r[2]}
                high={-m.expected.drawdown_r[0]}
                format={(n) => formatR(n, 1)}
              />
              <p className="text-small text-muted">
                Shuffling your trades into 10,000 different orders: typically {formatR(-m.expected.drawdown_r[1], 1)}; in the worst 5% of orders, {formatR(-m.expected.drawdown_r[2], 1)} or deeper, with losing runs of {m.expected.losing_streak[2]} or more.
              </p>
            </>
          ) : (
            <p className="text-small text-muted">The drawdown to expect appears at {m.min_for_ranges} trades.</p>
          )}
        </section>
      </div>

      <section aria-labelledby="discipline-h" className="grid gap-4 rounded-lg border border-border bg-surface p-4 md:p-6 md:grid-cols-3">
        <h2 id="discipline-h" className="text-h3 md:col-span-3">
          Discipline and costs
        </h2>
        <Fact label="Rule-following" value={pct(m.rule_following_rate)} note={`${formatCount(m.rule_broken_trades, 'trade')} with a broken rule`} />
        <Fact label="Cost of broken rules" value={formatR(m.rule_breaking_cost_r, 1)} note="Total R of trades that broke a rule" tone={tone(m.rule_breaking_cost_r)} />
        <Fact
          label="Costs"
          value={m.costs_share !== null ? pct(m.costs_share) : formatR(-m.costs_r, 1)}
          note={m.costs_share !== null ? `of gross R went on commission and swap (${formatR(-m.costs_r, 1)})` : 'Commission and swap, in R'}
        />
        {m.warnings.includes('costs_high') && (
          <div className="md:col-span-3">
            <Banner kind="warning" title="Costs take more than 20% of your gross results">
              Small targets or tight stops make spreads and commission a big share of each trade. The Level 1 lesson on trading costs shows why.
            </Banner>
          </div>
        )}
        {m.warnings.includes('stops_small') && (
          <div className="md:col-span-3">
            <Banner kind="warning" title={`Your average stop is ${m.avg_stop_pips?.toFixed(1)} pips`}>
              Under 10 pips, the spread and slippage are a large part of the risk on every trade.
            </Banner>
          </div>
        )}
        {m.estimated_r_trades > 0 && (
          <p className="text-caption text-subtle md:col-span-3">
            {formatCount(m.estimated_r_trades, 'trade')} use R estimated from prices (no money figures for that pair), so costs aren&rsquo;t included for them.
          </p>
        )}
      </section>

      <section aria-labelledby="breakdowns-h" className="grid gap-6">
        <h2 id="breakdowns-h" className="text-h2">
          Breakdowns
        </h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <Bars title="Rules followed or broken" rows={m.breakdowns.rules} label={(k) => (k === 'followed' ? 'Followed' : 'Broken')} />
          <Bars title="By session" rows={m.breakdowns.session} label={(k) => SESSION_LABEL[k] ?? k} />
          <Bars title="By pair" rows={m.breakdowns.instrument} />
          <Bars title="By setup" rows={m.breakdowns.setup} empty="Name your setups on the log form to compare them." />
          <Bars title="By weekday" rows={m.breakdowns.weekday} label={(k) => WEEKDAYS[Number(k)] ?? k} />
          <Bars title="By feeling before the trade" rows={m.breakdowns.emotion} label={(k) => EMOTION_LABEL[k] ?? k} empty="Tag how you felt before a trade to see this." />
          {m.breakdowns.account.length > 1 && <Bars title="By account" rows={m.breakdowns.account} />}
          {m.breakdowns.year.length > 1 && <Bars title="By year" rows={m.breakdowns.year} />}
        </div>
      </section>
    </>
  )
}

function Tile({ children }: { children: React.ReactNode }) {
  return <div className="bg-surface p-4 md:p-6">{children}</div>
}

function Fact({ label, value, note, tone: t }: { label: string; value: string; note?: string; tone?: 'gain' | 'loss' | 'neutral' }) {
  return (
    <div>
      <dt className="text-small text-muted">{label}</dt>
      <dd className={`font-mono text-h2 ${t === 'gain' ? 'text-gain' : t === 'loss' ? 'text-loss' : ''}`}>{value}</dd>
      {note && <dd className="text-caption text-subtle">{note}</dd>}
    </div>
  )
}

/** Cumulative R as a step-free line with a zero line; a table for screen readers (DESIGN.md §8). */
function Curve({ points }: { points: Metrics['curve'] }) {
  const [table, setTable] = useState(false)
  const W = 640
  const H = 220
  const pad = { l: 44, r: 12, t: 12, b: 24 }
  const values = [0, ...points.map((p) => p.r)]
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  const span = max - min || 1
  const x = (i: number) => pad.l + (i / Math.max(1, values.length - 1)) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + ((max - v) / span) * (H - pad.t - pad.b)
  const path = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const last = values.at(-1)!
  const ticks = [max, (max + min) / 2, min]
  return (
    <div className="mt-4">
      {table ? (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-small">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1 font-semibold">Trade</th>
                <th className="py-1 font-semibold">Closed</th>
                <th className="py-1 text-right font-semibold">Running total</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {points.map((p, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-1">{i + 1}</td>
                  <td className="py-1">{new Date(p.t).toLocaleDateString()}</td>
                  <td className="py-1 text-right">{formatR(p.r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Running total over ${points.length} trades, ending at ${formatR(last)}.`}>
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth="1" />
              <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" className="fill-subtle font-mono text-[11px]">
                {formatR(t, 1)}
              </text>
            </g>
          ))}
          <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} className="stroke-text" strokeWidth="1" />
          <path d={path} fill="none" className={last >= 0 ? 'stroke-gain' : 'stroke-loss'} strokeWidth="2" strokeLinejoin="round" />
          <circle cx={x(values.length - 1)} cy={y(last)} r="4" className="fill-accent" />
          <text x={pad.l} y={H - 6} className="fill-subtle text-[11px]">
            First trade
          </text>
          <text x={W - pad.r} y={H - 6} textAnchor="end" className="fill-subtle text-[11px]">
            Latest
          </text>
        </svg>
      )}
      <button type="button" onClick={() => setTable(!table)} className="mt-2 min-h-11 text-small font-semibold text-muted hover:text-text">
        {table ? 'View as chart' : 'View as table'}
      </button>
    </div>
  )
}

/** Horizontal bars sorted by total R, labelled directly, with a zero line (DESIGN.md §8). */
function Bars({ title, rows, label = (k) => k, empty }: { title: string; rows: Breakdown[]; label?: (k: string) => string; empty?: string }) {
  const maxAbs = Math.max(0.01, ...rows.map((r) => Math.abs(r.total_r)))
  const hasNeg = rows.some((r) => r.total_r < 0)
  const hasPos = rows.some((r) => r.total_r > 0)
  const zero = hasNeg && hasPos ? 50 : hasNeg ? 100 : 0
  const scale = hasNeg && hasPos ? 50 : 100
  return (
    <section aria-label={title} className="rounded-lg border border-border bg-surface p-4 md:p-6">
      <h3 className="text-small font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-small text-subtle">{empty ?? 'Nothing to show yet.'}</p>
      ) : (
        <table className="mt-3 w-full text-small">
          <thead className="sr-only">
            <tr>
              <th>Group</th>
              <th>Total</th>
              <th>Trades</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const w = (Math.abs(r.total_r) / maxAbs) * scale
              const left = r.total_r >= 0 ? zero : zero - w
              return (
                <tr key={r.key} className="align-middle">
                  <th scope="row" className="w-28 py-1.5 pr-3 text-left font-normal text-muted md:w-36">
                    <span className="line-clamp-1">{label(r.key)}</span>
                  </th>
                  <td className="py-1.5">
                    <div className="relative h-5" aria-hidden="true">
                      <div className="absolute inset-y-0 w-px bg-text" style={{ left: `${zero}%` }} />
                      <div className={`absolute inset-y-1 rounded-[2px] ${r.total_r >= 0 ? 'bg-gain' : 'bg-loss'}`} style={{ left: `${left}%`, width: `${Math.max(w, 0.5)}%` }} />
                    </div>
                  </td>
                  <td className="w-28 py-1.5 pl-3 text-right font-mono">
                    {formatR(r.total_r, 1)}
                    <span className="block text-caption text-subtle">{formatCount(r.trades, 'trade')}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}
