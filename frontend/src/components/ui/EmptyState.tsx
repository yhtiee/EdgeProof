import type { ReactNode } from 'react'

/** Empty state (DESIGN.md §7): one sentence, one action, left-aligned (§5). */
export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-md border border-dashed border-control px-4 py-8 md:px-6">
      <p className="max-w-[60ch] text-body text-muted">{message}</p>
      {action}
    </div>
  )
}
