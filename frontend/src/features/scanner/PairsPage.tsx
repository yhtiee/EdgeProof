import { useState } from 'react'
import { Link } from 'react-router'
import { Clock } from 'lucide-react'
import { EmptyState, SelectField } from '../../components/ui'
import { usePairs, type Label, type PairRow } from './api'
import { LABEL_ORDER, LABEL_TEXT, filterPairs, formatScore, sortByBias } from './format'
import { LabelChip, ScannerProblem, ScoreBar, Skeleton, TrustLine, WowChange } from './parts'

/**
 * Pair rankings (docs/scanner §5): Very Bullish at the top down to Very Bearish, a diverging bar per pair,
 * the score in mono, the label chip with its word, and the week-on-week change.
 * Filters run on the client: it's 28 rows.
 */
const CURRENCIES = ['EUR', 'GBP', 'AUD', 'NZD', 'USD', 'CAD', 'CHF', 'JPY']

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
          options={[{ value: '', label: 'All currencies' }, ...CURRENCIES.map((c) => ({ value: c, label: c }))]}
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
          <div className="mb-2 hidden grid-cols-[2.5rem_6rem_1fr_4rem_8rem_4.5rem_4rem] gap-4 px-3 text-caption text-subtle md:grid" aria-hidden="true">
            <span title="Rank by strength of bias, bullish or bearish">Rank</span>
            <span>Pair</span>
            <span className="flex justify-between">
              <span>−10</span>
              <span>0</span>
              <span>+10</span>
            </span>
            <span className="text-right">Score</span>
            <span>Bias</span>
            <span>Week</span>
            <span title="Factors pointing the same way as the score">Agree</span>
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

function PairItem({ p }: { p: PairRow }) {
  const stale = p.stale_factors.length
  return (
    <li>
      <Link
        to={`/scanner/${p.symbol}`}
        className="grid grid-cols-[2rem_1fr_auto] items-center gap-x-3 gap-y-2 rounded-md border border-border bg-surface px-3 py-3 hover:border-control md:grid-cols-[2.5rem_6rem_1fr_4rem_8rem_4.5rem_4rem] md:gap-4"
        aria-label={`${p.symbol}: ${LABEL_TEXT[p.label as Label]}, score ${formatScore(p.score)}`}
      >
        <span className="font-mono text-small text-subtle">{p.rank ?? '—'}</span>
        <span className="flex items-center gap-2 font-mono text-body font-semibold">
          {p.base}/{p.quote}
          {stale > 0 && (
            <span title={`${stale} factor${stale > 1 ? 's' : ''} stale this week`} className="text-warning">
              <Clock className="size-3.5" strokeWidth={2} aria-hidden="true" />
            </span>
          )}
        </span>
        <span className="justify-self-end md:hidden">
          <LabelChip label={p.label} />
        </span>
        <ScoreBar score={p.score} label={p.label} className="col-span-2 md:col-span-1" />
        <span className="text-right font-mono text-body font-medium">{formatScore(p.score)}</span>
        <span className="hidden md:block">
          <LabelChip label={p.label} />
        </span>
        <span className="hidden md:block">
          <WowChange change={p.change_wow} />
        </span>
        <span className="hidden font-mono text-caption text-muted md:block">{p.agreement?.of ? `${p.agreement.agree}/${p.agreement.of}` : '—'}</span>
        <span className="col-span-3 -mt-1 flex items-center gap-3 md:hidden">
          <WowChange change={p.change_wow} />
          {p.agreement?.of ? <span className="font-mono text-caption text-muted">{`${p.agreement.agree} of ${p.agreement.of} factors agree`}</span> : null}
        </span>
      </Link>
    </li>
  )
}
