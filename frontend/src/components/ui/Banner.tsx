import type { ReactNode } from 'react'
import { CircleAlert, Info, TriangleAlert, WifiOff } from 'lucide-react'

/**
 * Persistent notice (DESIGN.md §7): risk warnings, waking server, offline,
 * AI off. Always an icon and a word, never colour alone.
 */
type Kind = 'info' | 'warning' | 'danger' | 'offline'

const ICON = { info: Info, warning: TriangleAlert, danger: CircleAlert, offline: WifiOff }
const TONE = { info: 'text-info', warning: 'text-warning', danger: 'text-danger', offline: 'text-muted' }

export function Banner({ kind = 'info', title, children }: { kind?: Kind; title: string; children?: ReactNode }) {
  const Icon = ICON[kind]
  return (
    <div
      role={kind === 'danger' ? 'alert' : 'status'}
      className="flex gap-3 rounded-md border border-border bg-surface px-4 py-3"
    >
      <Icon className={`mt-0.5 size-5 shrink-0 ${TONE[kind]}`} strokeWidth={1.75} aria-hidden="true" />
      <div className="text-small">
        <p className="font-semibold text-text">{title}</p>
        {children && <div className="text-muted">{children}</div>}
      </div>
    </div>
  )
}
