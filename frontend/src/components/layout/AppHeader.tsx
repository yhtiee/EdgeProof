import { useLocation, useNavigate, Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import * as Popover from '@radix-ui/react-popover'
import { Bell, CircleUser, LogOut, Plus, Settings, UserRound } from 'lucide-react'
import { signOut } from '../../features/auth/api'
import { useSession } from '../../lib/session'
import { buttonClass } from '../ui'
import { Logo } from './Logo'

/**
 * App header (DESIGN.md §5 "App shell"). Sticky across the content area:
 * the current destination on the left, quick actions on the right.
 * No amber here, so each screen's own primary action stays the only one.
 */
const SECTION: Record<string, string> = {
  '/learn': 'Learn',
  '/journal': 'Journal',
  '/lab': 'Strategy Lab',
  '/scanner': 'Scanner',
  '/settings': 'Settings',
  '/profile': 'Profile',
}

const iconButton =
  'inline-flex size-11 items-center justify-center rounded-md text-muted hover:bg-raised hover:text-text data-[state=open]:bg-raised data-[state=open]:text-text'

const menuPanel =
  'z-50 min-w-60 rounded-md border border-border bg-raised p-2 shadow-pop'

export function AppHeader() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const session = useSession()
  const me = session.status === 'signed-in' ? session.me : null
  const section = Object.entries(SECTION).find(([path]) => pathname.startsWith(path))?.[1]

  async function onSignOut() {
    await signOut().catch(() => undefined)
    queryClient.clear()
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface">
      <div className="flex h-14 items-center gap-2 px-4 md:px-6 lg:h-16 lg:px-8">
        <div className="lg:hidden">
          <Logo to="/learn" />
        </div>
        {section && <p className="hidden text-small font-semibold text-muted lg:block">{section}</p>}

        <div className="ml-auto flex items-center gap-2">
          {/* The journal screen owns this action, so the shortcut hides there. */}
          {!pathname.startsWith('/journal') && (
            <span className="hidden md:block">
              <Link to="/journal/new" className={buttonClass('secondary')}>
                <Plus className="size-4" strokeWidth={1.75} aria-hidden="true" />
                Log trade
              </Link>
            </span>
          )}

          <Popover.Root>
            <Popover.Trigger className={iconButton} aria-label="Notifications">
              <Bell className="size-5" strokeWidth={1.75} aria-hidden="true" />
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content align="end" sideOffset={8} className={`${menuPanel} w-72 p-4`}>
                <p className="text-small font-semibold">Notifications</p>
                <p className="mt-2 text-small text-muted">
                  Nothing new. Study reminders and import results will show up here.
                </p>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

          <Popover.Root>
            <Popover.Trigger className={iconButton} aria-label="Account">
              <CircleUser className="size-5" strokeWidth={1.75} aria-hidden="true" />
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content align="end" sideOffset={8} className={menuPanel}>
                {me && (
                  <div className="border-b border-border px-3 pb-2 pt-1">
                    <p className="text-small font-semibold">
                      {me.first_name} {me.last_name}
                    </p>
                    <p className="truncate text-caption text-subtle">{me.email}</p>
                  </div>
                )}
                <nav aria-label="Account" className="pt-1">
                  <Popover.Close asChild>
                    <Link
                      to="/profile"
                      className="flex min-h-11 items-center gap-3 rounded-sm px-3 text-small hover:bg-surface"
                    >
                      <UserRound className="size-5 text-muted" strokeWidth={1.75} aria-hidden="true" />
                      Profile
                    </Link>
                  </Popover.Close>
                  <Popover.Close asChild>
                    <Link
                      to="/settings"
                      className="flex min-h-11 items-center gap-3 rounded-sm px-3 text-small hover:bg-surface"
                    >
                      <Settings className="size-5 text-muted" strokeWidth={1.75} aria-hidden="true" />
                      Settings
                    </Link>
                  </Popover.Close>
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="flex min-h-11 w-full items-center gap-3 rounded-sm px-3 text-small hover:bg-surface"
                  >
                    <LogOut className="size-5 text-muted" strokeWidth={1.75} aria-hidden="true" />
                    Sign out
                  </button>
                </nav>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      </div>
    </header>
  )
}
