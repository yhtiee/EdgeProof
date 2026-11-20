import { ExternalLink } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Impact } from './api'
import { IMPACT_TEXT } from './format'

/**
 * Impact levels (docs/news.md): the word, bars that fill with the level, and a colour from
 * the existing tokens, never colour alone. High uses the loss token and Medium the warning
 * token, so colour-blind mode carries over; Low is muted and Holiday a dashed outline.
 */
const IMPACT_STYLE: Record<Impact, { tone: string; bars: number }> = {
  High: { tone: 'border-loss/50 text-loss', bars: 3 },
  Medium: { tone: 'border-warning/50 text-warning', bars: 2 },
  Low: { tone: 'border-control text-muted', bars: 1 },
  Holiday: { tone: 'border-dashed border-control text-subtle', bars: 0 },
}

export function ImpactChip({ impact }: { impact: Impact }) {
  const { tone, bars } = IMPACT_STYLE[impact]
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-caption font-semibold ${tone}`}>
      {impact !== 'Holiday' && (
        <span className="flex items-end gap-px" aria-hidden="true">
          {[1, 2, 3].map((i) => (
            <span key={i} className={`w-1 rounded-sm bg-current ${i <= bars ? '' : 'opacity-25'}`} style={{ height: `${4 + i * 2}px` }} />
          ))}
        </span>
      )}
      {IMPACT_TEXT[impact]}
      <span className="sr-only"> impact</span>
    </span>
  )
}

export function ExternalA({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-accent-text hover:underline">
      {children}
      <ExternalLink className="size-3" strokeWidth={2} aria-hidden="true" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}

export function NewsFooter({ fetchedAt, disclaimer, children }: { fetchedAt: string | null | undefined; disclaimer?: string; children?: ReactNode }) {
  return (
    <footer className="mt-10 border-t border-border pt-4 text-caption text-subtle">
      {children}
      {fetchedAt && <p className="mt-1">Last fetched {new Date(fetchedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
      <p className="mt-1 font-semibold text-muted">{disclaimer ?? 'Educational information, not trading advice.'}</p>
    </footer>
  )
}
