import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, hasAccessToken, refreshAccessToken } from './api/client'

/**
 * The signed-in user (GET /me). On a fresh page load the access token is gone
 * (it lives in memory), so the session is restored from the refresh cookie.
 * A server that is waking or offline never signs the user out (spec §16).
 */
export type Me = {
  id: string
  email: string
  first_name: string
  last_name: string
  timezone: string
  role: 'learner' | 'mentor' | 'editor' | 'admin'
  email_verified_at: string | null
  /** Next onboarding step: 2 time · 3 experience · 4 plan · 5 done. */
  onboarding_step: number
  plan_accepted_at: string | null
  created_at: string
}

export const ME_KEY = ['me'] as const

async function loadMe(): Promise<Me | null> {
  if (!hasAccessToken() && !(await refreshAccessToken())) return null
  return api<Me>('/me')
}

export type Session =
  | { status: 'loading' }
  | { status: 'offline' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; me: Me; onboarded: boolean }

export function useSession(): Session {
  const query = useQuery({ queryKey: ME_KEY, queryFn: loadMe, staleTime: 5 * 60_000 })
  if (query.isPending) return { status: 'loading' }
  if (query.isError) {
    // Only a 401 signs the user out. Offline, waking, throttled or failing
    // servers keep the session and show the "couldn't reach" state.
    return query.error instanceof ApiError && query.error.status === 401 ? { status: 'signed-out' } : { status: 'offline' }
  }
  if (!query.data) return { status: 'signed-out' }
  return { status: 'signed-in', me: query.data, onboarded: query.data.plan_accepted_at !== null }
}

/** Where a signed-in user belongs right now. */
export function homeFor(me: Me): string {
  return me.plan_accepted_at ? '/learn' : '/onboarding'
}

export function useRefreshSession() {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: ME_KEY })
}
