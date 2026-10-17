import type { ReactNode } from 'react'
import { LockOpen } from 'lucide-react'

/**
 * Development builds open every gate so features can be tested. This note
 * marks where a deployed build would show a lock, and says what would open
 * it, so the production nudge can be reviewed too. Never shown when deployed.
 */
export function DevGateNote({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  if (compact) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-caption text-subtle" title="Open for development only">
        <LockOpen className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
        {children}
      </span>
    )
  }
  return (
    <p className="flex items-start gap-2 rounded-md border border-dashed border-control px-3 py-2 text-small text-muted" role="note">
      <LockOpen className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <span>
        <span className="font-semibold text-text">Open for development.</span> {children}
      </span>
    </p>
  )
}
