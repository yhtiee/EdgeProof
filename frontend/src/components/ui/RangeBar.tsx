import { formatR } from '../../lib/format'

/**
 * The range bar (DESIGN.md §1, §7): an estimate as a dot, its range as a
 * whisker, and a marked zero line. The brand made visible: we show the
 * uncertainty.
 */
export type RangeBarProps = {
  label: string
  estimate: number
  low: number
  high: number
  /** Visible domain. Defaults to the range padded, always including zero. */
  domain?: [number, number]
  format?: (n: number) => string
  /** Hide the label/estimate row when the parent already shows them. */
  compact?: boolean
  className?: string
}

export function RangeBar({
  label,
  estimate,
  low,
  high,
  domain,
  format = formatR,
  compact = false,
  className = '',
}: RangeBarProps) {
  const [min, max] = domain ?? padDomain(Math.min(low, 0), Math.max(high, 0))
  const pos = (v: number) => `${((clamp(v, min, max) - min) / (max - min)) * 100}%`
  const zeroInView = min <= 0 && max >= 0
  const summary = `${label} ${format(estimate)}, range ${format(low)} to ${format(high)}`

  return (
    <figure className={`m-0 ${className}`} aria-label={summary} role="img">
      {!compact && (
        <figcaption className="mb-2 flex items-baseline justify-between gap-4" aria-hidden="true">
          <span className="text-small text-muted">{label}</span>
          <span className="font-mono text-body text-text">{format(estimate)}</span>
        </figcaption>
      )}
      <div className="relative h-6" aria-hidden="true">
        {/* baseline */}
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
        {/* zero line */}
        {zeroInView && (
          <div className="absolute top-0 h-6 w-px bg-text" style={{ left: pos(0) }} />
        )}
        {/* whisker */}
        <div
          className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-neutral-data"
          style={{ left: pos(low), width: `calc(${pos(high)} - ${pos(low)})` }}
        />
        <div className="absolute top-1.5 h-3 w-0.5 -translate-x-1/2 bg-neutral-data" style={{ left: pos(low) }} />
        <div className="absolute top-1.5 h-3 w-0.5 -translate-x-1/2 bg-neutral-data" style={{ left: pos(high) }} />
        {/* estimate */}
        <div
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-2 ring-surface"
          style={{ left: pos(estimate) }}
        />
      </div>
      <div className="relative mt-1 h-4 font-mono text-caption text-subtle" aria-hidden="true">
        <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: pos(low) }}>
          {format(low)}
        </span>
        <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: pos(high) }}>
          {format(high)}
        </span>
      </div>
    </figure>
  )
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v))
}

function padDomain(lo: number, hi: number): [number, number] {
  const pad = (hi - lo) * 0.15 || 0.1
  return [lo - pad, hi + pad]
}
