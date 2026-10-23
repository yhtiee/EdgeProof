import { useState } from 'react'
import { Link } from 'react-router'
import { Clock } from 'lucide-react'
import { EmptyState, SelectField } from '../../components/ui'
import { usePairs, type Label, type PairRow } from './api'
import { LABEL_ORDER, LABEL_TEXT, filterPairs, formatScore, instrumentName, sortByBias } from './format'
import { LabelChip, ScannerProblem, ScoreBar, Skeleton, TrustLine, WowChange } from './parts'

/**
 * Pair rankings (docs/scanner §5, docs/scanner/scoreboard.md): ranked by the final bias, which
 * adds the two models together: half the regime score (where each economy and central bank
 * stands) and half the momentum score (how the latest data compared with forecasts, from the
 * scoreboard). Each row shows both parts and flags when they pull opposite ways.
 * Filters run on the client: it's 29 rows.
 */
const CURRENCIES = ['EUR', 'GBP', 'AUD', 'NZD', 'USD', 'CAD', 'CHF', 'JPY', 'XAU']

export default function PairsPage() {
  const pairs = usePairs()
  const [label, setLabel] = useState('')
  const [currency, setCurrency] = useState('')
  const [strong, setStrong] = useState(false)

  if (pairs.isError) return <ScannerProblem error={pairs.error} />
  const data = pairs.data
  const rows = data ? sortByBias(filterPairs(data.pairs, { label, currency, strong })) : []

  return (
    <div>
      <p className="mb-6 max-w-prose text-small text-muted">
        The final bias adds two views together: the regime (rates, inflation, growth, jobs, business confidence, positioning) and momentum
        (how the latest releases compared with forecasts, from the Scoreboard). When they disagree strongly, the pair is marked Mixed.
      </p>
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <SelectField
          label="Bias"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          options={[{ value: '', label: 'All labels' }, ...LABEL_ORDER.map((l) => ({ value: l, label: LABEL_TEXT[l] }))]}
        />
        <SelectField
          label="Currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          options={[{ value: '', label: 'All' }, ...CURRENCIES.map((c) => ({ value: c, label: c === 'XAU' ? 'Gold' : c }))]}
        />
        <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-control px-3 text-small font-semibold has-[:checked]:border-text has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus">
          <input type="checkbox" checked={strong} onChange={(e) => setStrong(e.target.checked)} className="size-4 accent-[var(--text)]" />
          Strong only
        </label>
      </div>

      {!data ? (
        <Skeleton rows={8} />
      ) : rows.length === 0 ? (
        <EmptyState message="No pairs match these filters this week." />
      ) : (
        <>
          <div className="mb-2 hidden grid-cols-[2.5rem_6rem_1fr_4rem_8rem_9rem_4.5rem] gap-4 px-3 text-caption text-subtle md:grid" aria-hidden="true">
            <span title="Most bullish first, most bearish last">Rank</span>
            <span>Pair</span>
            <span className="flex justify-between">
              <span>−10</span>
              <span>0</span>
              <span>+10</span>
            </span>
            <span className="text-right">Final</span>
            <span>Bias</span>
            <span title="The two parts of the final bias">Regime · momentum</span>
            <span>Week</span>
          </div>
          <ol className="grid gap-1">
            {rows.map((p) => (
              <PairItem key={p.symbol} p={p} />
            ))}
          </ol>
        </>
      )}
      <TrustLine meta={data} />
    </div>
  )
}

function Parts({ p }: { p: PairRow }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 font-mono text-caption text-muted">
      <span title="Regime score">{formatScore(p.score)}</span>
      <span aria-hidden="true">·</span>
      <span title={p.momentum === null ? 'Momentum: waiting for releases with forecasts' : 'Momentum score'}>{formatScore(p.momentum)}</span>
      {p.mixed && (
        <span className="rounded-sm border border-warning/50 px-1.5 font-sans font-semibold text-warning" title="Regime and momentum point opposite ways">
          Mixed
        </span>
      )}
    </span>
  )
}

function PairItem({ p }: { p: PairRow }) {
  const stale = p.stale_factors.length
  const label = p.final_label as Label
  return (
    <li>
      <Link
        to={`/scanner/${p.symbol}`}
        className="grid grid-cols-[2rem_1fr_auto] items-center gap-x-3 gap-y-2 rounded-md border border-border bg-surface px-3 py-3 hover:border-control md:grid-cols-[2.5rem_6rem_1fr_4rem_8rem_9rem_4.5rem] md:gap-4"
        aria-label={`${instrumentName(p.symbol)}: ${LABEL_TEXT[label]}, final score ${formatScore(p.final_score)}, regime ${formatScore(p.score)}, momentum ${formatScore(p.momentum)}${p.mixed ? ', mixed' : ''}`}
      >
        <span className="font-mono text-small text-subtle">{p.final_rank ?? '—'}</span>
        <span className="flex items-center gap-2 font-mono text-body font-semibold">
          {instrumentName(p.symbol)}
          {stale > 0 && (
            <span title={`${stale} factor${stale > 1 ? 's' : ''} stale this week`} className="text-warning">
              <Clock className="size-3.5" strokeWidth={2} aria-hidden="true" />
            </span>
          )}
        </span>
        <span className="justify-self-end md:hidden">
          <LabelChip label={label} />
        </span>
        <ScoreBar score={p.final_score} label={label} className="col-span-2 md:col-span-1" />
        <span className="text-right font-mono text-body font-medium">{formatScore(p.final_score)}</span>
        <span className="hidden md:block">
          <LabelChip label={label} />
        </span>
        <span className="hidden md:block">
          <Parts p={p} />
        </span>
        <span className="hidden md:block">
          <WowChange change={p.change_wow} />
        </span>
        <span className="col-span-3 -mt-1 flex flex-wrap items-center gap-3 md:hidden">
          <Parts p={p} />
          <WowChange change={p.change_wow} />
        </span>
      </Link>
    </li>
  )
}
