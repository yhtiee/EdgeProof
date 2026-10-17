import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { Plus } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { buttonClass } from '../../components/ui'
import { useSession } from '../../lib/session'
import { useJournalSync } from './sync'

/**
 * Journal home (JR-1: open from day one, no gate). Tabs for the trade list,
 * metrics, reviews and setup; "Log trade" is the one primary action, also
 * on N (DESIGN.md §12).
 */
const TABS = [
  { to: '/journal', label: 'Trades', end: true },
  { to: '/journal/metrics', label: 'Metrics' },
  { to: '/journal/reviews', label: 'Reviews' },
  { to: '/journal/setup', label: 'Setup' },
]

export default function JournalLayout() {
  const session = useSession()
  const userId = session.status === 'signed-in' ? session.me.id : undefined
  const { waiting, rejected } = useJournalSync(userId)
  const navigate = useNavigate()
  const notice = (useLocation().state as { notice?: string } | null)?.notice

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (e.key.toLowerCase() !== 'n' || e.metaKey || e.ctrlKey || e.altKey) return
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return
      e.preventDefault()
      navigate('/journal/new')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  return (
    <div>
      <PageHeader
        title="Journal"
        description="Practice trades, rule checks and reviews. Practice trades never count toward a verdict."
        action={
          // Wrapped: the button's own inline-flex would override `hidden` (phones use the floating button).
          <span className="hidden md:block">
            <Link to="/journal/new" className={buttonClass('primary')} aria-keyshortcuts="N">
              <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
              Log trade
              <kbd className="ml-1 rounded-sm border border-on-accent/30 px-1 font-mono text-caption">N</kbd>
            </Link>
          </span>
        }
      />
      <nav aria-label="Journal" className="-mt-4 mb-6 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `-mb-px inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 text-small font-semibold ${
                isActive ? 'border-text text-text' : 'border-transparent text-muted hover:text-text'
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
        {(waiting > 0 || rejected > 0) && (
          <p role="status" className="ml-auto hidden shrink-0 items-center text-caption text-subtle sm:flex">
            {rejected > 0 ? `${rejected} not saved · needs a fix` : `Saved on this device · Syncing ${waiting}`}
          </p>
        )}
      </nav>
      {notice && (
        <p role="status" className="-mt-2 mb-6 text-small font-semibold text-muted">
          {notice}
        </p>
      )}
      <Outlet />
      {/* Floating Log trade on mobile (DESIGN.md §12), above the tab bar. */}
      <Link
        to="/journal/new"
        className="fixed bottom-24 right-4 z-30 inline-flex size-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-sheet md:hidden"
        aria-label="Log trade"
      >
        <Plus className="size-6" strokeWidth={2} aria-hidden="true" />
      </Link>
    </div>
  )
}
