import type { ReactNode } from 'react'

/** Empty state (DESIGN.md §7): one sentence, one action. */
export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 px-4 py-16 text-center">
      <p className="max-w-[40ch] text-body text-muted">{message}</p>
      {action}
    </div>
  )
}
