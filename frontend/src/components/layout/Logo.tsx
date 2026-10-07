import { Link } from 'react-router'

/**
 * Wordmark: the name beside a tiny range bar (whisker, zero tick, amber dot),
 * the brand's one motif (DESIGN.md §1).
 */
export function Logo({ className = '', to = '/' }: { className?: string; to?: string }) {
  return (
    <Link to={to} className={`inline-flex min-h-11 items-center gap-2 text-text ${className}`} aria-label="EdgeProof home">
      <LogoMark className="h-4 w-7" />
      <span className="text-h3 font-semibold tracking-[-0.01em]">EdgeProof</span>
    </Link>
  )
}

export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 16" className={className} aria-hidden="true" focusable="false">
      <line x1="2" y1="8" x2="26" y2="8" stroke="var(--neutral-data)" strokeWidth="2" />
      <line x1="2" y1="4" x2="2" y2="12" stroke="var(--neutral-data)" strokeWidth="2" />
      <line x1="26" y1="4" x2="26" y2="12" stroke="var(--neutral-data)" strokeWidth="2" />
      <line x1="9" y1="1" x2="9" y2="15" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="17" cy="8" r="4" fill="var(--accent)" />
    </svg>
  )
}
