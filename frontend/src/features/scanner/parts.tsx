import { ArrowDownRight, ArrowRight, ArrowUpRight, Clock } from 'lucide-react'
import { Banner, EmptyState } from '../../components/ui'
import { ApiError } from '../../lib/api/client'
import type { Label, RunMeta } from './api'
import { LABEL_TEXT, barGeometry, formatDate, formatScore } from './format'

/**
 * Shared scanner pieces (docs/scanner §5): five label colours from the gain/loss
 * tokens (so colour-blind mode carries over), always with the word; the diverging
 * score bar; and the trust line every screen ends with.
 */
export const CHIP: Record<Label, string> = {
  very_bullish: 'bg-gain text-bg border-gain',
  bullish: 'bg-gain/12 text-gain border-gain/40',
  neutral: 'bg-neutral-data/12 text-neutral-data border-neutral-data/40',
  bearish: 'bg-loss/12 text-loss border-loss/40',
  very_bearish: 'bg-loss text-bg border-loss',
  insufficient: 'bg-transparent text-muted border-dashed border-control',
}

export const FILL: Record<Label, string> = {
  very_bullish: 'bg-gain',
  bullish: 'bg-gain/55',
  neutral: 'bg-neutral-data',
  bearish: 'bg-loss/55',
  very_bearish: 'bg-loss',
  insufficient: 'bg-border',
}

export function LabelChip({ label, size = 'sm' }: { label: Label; size?: 'sm' | 'lg' }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border font-semibold ${CHIP[label]} ${
        size === 'lg' ? 'px-3 py-1 text-small' : 'px-2 py-0.5 text-caption'
      }`}
    >
      {LABEL_TEXT[label]}
    </span>
  )
}

/** −10…+10 with a marked zero line; the bar grows from zero towards the score. */
export function ScoreBar({ score, label, className = '' }: { score: number | null; label: Label; className?: string }) {
  const g = score === null ? null : barGeometry(score)
  return (
    <div className={`relative h-3 rounded-full bg-raised ${className}`} aria-hidden="true">
      {g && <div className={`absolute inset-y-0 rounded-full ${FILL[label]}`} style={{ left: `${g.left}%`, width: `${Math.max(g.width, 0.8)}%` }} />}
      <div className="absolute -inset-y-1 left-1/2 w-px -translate-x-1/2 bg-text" />
    </div>
  )
}

export function WowChange({ change }: { change: number | null }) {
  if (change === null) return <span className="font-mono text-caption text-subtle">new</span>
  const flat = Math.abs(change) < 0.05
  const Icon = flat ? ArrowRight : change > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-mono text-caption ${flat ? 'text-subtle' : change > 0 ? 'text-gain' : 'text-loss'}`}
      title="Change since last week's snapshot"
    >
      <Icon className="size-3.5" strokeWidth={2} aria-hidden="true" />
      <span className="sr-only">{flat ? 'Unchanged' : change > 0 ? 'Up' : 'Down'} week on week</span>
      {flat ? '0.0' : formatScore(change)}
    </span>
  )
}

export function StaleBadge({ title }: { title?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm border border-warning/50 px-1.5 py-px text-caption font-semibold text-warning"
      title={title ?? 'Past its refresh window, so it is left out of the score'}
    >
      <Clock className="size-3" strokeWidth={2} aria-hidden="true" />
      Stale
    </span>
  )
}

/** "Last updated" and the disclaimer: on every scanner screen (docs/scanner §5). */
export function TrustLine({ meta }: { meta?: Pick<RunMeta, 'as_of' | 'updated_at' | 'disclaimer'> }) {
  return (
    <footer className="mt-10 border-t border-border pt-4 text-caption text-subtle">
      {meta && (
        <p>
          Scores as of {formatDate(meta.as_of)}
          {meta.updated_at && ` · Last updated ${new Date(meta.updated_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`}
        </p>
      )}
      <p className="mt-1 font-semibold text-muted">{meta?.disclaimer ?? 'Educational analysis of fundamentals, not a trade signal.'}</p>
    </footer>
  )
}

export function ScannerProblem({ error }: { error: unknown }) {
  if (error instanceof ApiError && error.status === 404) {
    return <EmptyState message="The scanner hasn't scored anything yet. Scores appear after the first daily run." />
  }
  return (
    <Banner kind="danger" title="Couldn't load the scanner">
      {(error as Error).message}
    </Banner>
  )
}

export function Skeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="grid gap-2" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-md bg-surface motion-reduce:animate-none" />
      ))}
    </div>
  )
}
