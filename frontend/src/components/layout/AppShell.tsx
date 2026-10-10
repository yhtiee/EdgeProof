import { NavLink, Outlet } from 'react-router'
import { BookOpen, FlaskConical, Menu, NotebookPen, Route } from 'lucide-react'
import { ServerStatusBanner } from '../ui'
import { AppHeader } from './AppHeader'
import { Logo } from './Logo'

/**
 * App shell (DESIGN.md §5): five destinations. Bottom tab bar on mobile,
 * left sidebar at 1024 px and up.
 */
const NAV = [
  { to: '/learn', label: 'Learn', icon: BookOpen },
  { to: '/journal', label: 'Journal', icon: NotebookPen },
  { to: '/lab', label: 'Lab', icon: FlaskConical },
  { to: '/progress', label: 'Progress', icon: Route },
  { to: '/more', label: 'More', icon: Menu },
] as const

export function AppShell() {
  return (
    <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-[240px_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-raised focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      <aside className="hidden border-r border-border bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:gap-6 lg:px-4">
        <div className="flex h-16 items-center">
          <Logo className="px-3" to="/learn" />
        </div>
        <nav aria-label="Main">
          <ul className="flex flex-col gap-1">
            {NAV.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center gap-3 rounded-md px-3 text-small font-semibold ${
                      isActive ? 'bg-raised text-text' : 'text-muted hover:text-text'
                    }`
                  }
                >
                  <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col pb-20 lg:pb-0">
        <AppHeader />
        <div className="px-4 pt-4 md:px-6 lg:px-8 empty:hidden">
          <ServerStatusBanner />
        </div>
        <main id="main" className="flex-1 px-4 py-6 md:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="grid grid-cols-5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex min-h-14 flex-col items-center justify-center gap-0.5 text-caption ${
                    isActive ? 'font-semibold text-text' : 'text-muted'
                  }`
                }
              >
                <Icon className="size-6" strokeWidth={1.75} aria-hidden="true" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
