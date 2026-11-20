import { NavLink, Outlet } from 'react-router'
import { PageHeader } from '../../components/layout/PageHeader'

/**
 * News (docs/news.md): the economic calendar and official headlines, open to every
 * signed-in learner. Two tabs; each event and headline links to its source.
 */
const TABS = [
  { to: '/news', label: 'Calendar', end: true },
  { to: '/news/headlines', label: 'Headlines' },
]

export default function NewsLayout() {
  return (
    <div>
      <PageHeader
        title="News"
        description="This week's economic releases with what was expected and what came out, and the latest from central banks and statistics agencies. Every item links to its source."
      />
      <nav aria-label="News" className="-mt-4 mb-6 flex gap-1 overflow-x-auto border-b border-border">
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
