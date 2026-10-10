import { Navigate, Outlet, useLocation } from 'react-router'
import { Banner } from '../components/ui'
import { useSession } from '../lib/session'

/**
 * Route guards. The server enforces every gate (spec §8); these only send
 * people to the right screen.
 */

function SessionPending() {
  return (
    <div className="px-4 py-6 md:px-6 lg:px-8" aria-busy="true">
      <div className="h-8 w-48 animate-pulse rounded-sm bg-surface motion-reduce:animate-none" />
      <div className="mt-4 h-4 w-80 max-w-full animate-pulse rounded-sm bg-surface motion-reduce:animate-none" />
    </div>
  )
}

function SessionOffline() {
  return (
    <div className="px-4 py-6 md:px-6 lg:px-8">
      <Banner kind="offline" title="Couldn't reach the server">
        Your sign-in is kept. Lessons you've opened before still work offline. Reload when you're back online.
      </Banner>
    </div>
  )
}

/** App screens: signed in and onboarded. */
export function RequireOnboarded() {
  const session = useSession()
  const location = useLocation()
  if (session.status === 'loading') return <SessionPending />
  if (session.status === 'offline') return <SessionOffline />
  if (session.status === 'signed-out') {
    return <Navigate to={`/sign-in?next=${encodeURIComponent(location.pathname)}`} replace />
  }
  if (!session.onboarded) return <Navigate to="/onboarding" replace />
  return <Outlet />
}

/** Onboarding: signed in, plan not yet accepted. */
export function RequireOnboarding() {
  const session = useSession()
  if (session.status === 'loading') return <SessionPending />
  if (session.status === 'offline') return <SessionOffline />
  if (session.status === 'signed-out') return <Navigate to="/sign-in?next=/onboarding" replace />
  if (session.onboarded) return <Navigate to="/learn" replace />
  return <Outlet />
}
