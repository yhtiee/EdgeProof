import { NavLink, Outlet } from 'react-router'
import { PageHeader } from '../../components/layout/PageHeader'

/**
 * Fundamental Bias Scanner home (docs/scanner/fundamental-bias-scanner.md §5).
 * Open to every signed-in learner, no gate. Three tabs: the pair rankings, the
 * currency strength board and the evidence for how well the labels have held up.
 */
const TABS = [
  { to: '/scanner', label: 'Pairs', end: true },
  { to: '/scanner/currencies', label: 'Currencies' },
  { to: '/scanner/evidence', label: 'Evidence' },
]

export default function ScannerLayout() {
  return (
    <div>
      <PageHeader
        title="Scanner"                                                            
        description="Where the fundamentals lean for 28 major pairs, scored from rates, inflation, growth, jobs, business confidence and positioning. A starting point for your own analysis."
      />
      <nav aria-label="Scanner" className="-mt-4 mb-6 flex gap-1 overflow-x-auto border-b border-border">
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
      </nav>
      <Outlet />
    </div>
  )
}
