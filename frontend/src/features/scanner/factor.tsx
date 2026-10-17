import { Link } from 'react-router'
import { BookOpen } from 'lucide-react'
import type { Factor, FactorText, FactorValue } from './api'
import { describeFactor, formatPeriod } from './format'
import { EvidenceButton } from './Evidence'
import { StaleBadge } from './parts'

/** Factor scores run −2…+2: mono, signed, toned, with the word for screen readers. */
export function FactorScoreTag({ value }: { value: FactorValue | undefined }) {
  const s = value?.score
  if (s === null || s === undefined) return <span className="font-mono text-small text-subtle">—</span>
  const tone = value?.stale ? 'text-subtle line-through' : s > 0 ? 'text-gain' : s < 0 ? 'text-loss' : 'text-muted'
  return <span className={`font-mono text-small font-semibold ${tone}`}>{s > 0 ? `+${s}` : s < 0 ? `−${-s}` : '0'}</span>
}

/** The reading behind a score, its period, its source, and a stale badge when it's past its window. */
export function FactorReading({ factor, value }: { factor: Factor; value: FactorValue | undefined }) {
  const period = value?.detail.period ?? value?.detail.as_of
  return (
    <div className="min-w-0">
      <p className="text-small text-text">{describeFactor(factor, value)}</p>
      {value && (value.score !== null || value.raw !== null) && (
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-subtle">
          <span>{formatPeriod(period, value.detail.freq)}</span>
          {value.source && <span>· {value.source}</span>}
          {value.stale && <StaleBadge />}
          {factor === 'retail' && value.detail.small_sample === true && (
            <span className="font-semibold text-warning" title="Fewer than 500 traders: read with care">
              Small sample
            </span>
          )}
        </p>
      )}
    </div>
  )
}

/**
 * Factor name with "What this measures" and the Academy lesson that teaches it (docs/scanner §5),
 * and, given a subject, the link to the evidence behind it (docs/scanner §7).
 */
export function FactorName({ factor, text, subject }: { factor: Factor; text: FactorText; subject?: string }) {
  const t = text[factor]
  return (
    <div className="min-w-0">
      <details className="group min-w-0">
        <summary className="cursor-pointer list-none text-small font-semibold text-text marker:hidden [&::-webkit-details-marker]:hidden">
          <span className="underline decoration-control decoration-dotted underline-offset-4 group-open:decoration-text">{t.name}</span>
          <span className="sr-only"> (what this measures)</span>
        </summary>
        <div className="mt-2 max-w-[48ch] text-caption text-muted">
          <p>{t.about}</p>
          <Link
            to={`/learn/${t.lesson}`}
            className="mt-1 inline-flex min-h-8 items-center gap-1 font-semibold text-accent-text hover:underline"
          >
            <BookOpen className="size-3.5" strokeWidth={2} aria-hidden="true" />
            The lesson on this
          </Link>
        </div>
      </details>
      {subject && <EvidenceButton subject={subject} factor={factor} name={t.name} />}
    </div>
  )
}
