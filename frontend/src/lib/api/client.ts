import { setServerStatus } from './serverStatus'

/**
 * API client (spec §13, §15, §16).
 *
 * - Every call goes to /api/v1 on the same origin; Vercel (or the Vite dev
 *   proxy) forwards it to Django, so the refresh cookie is first-party.
 * - The access token lives in memory only. The refresh token is an HttpOnly
 *   cookie the browser sends to /api/v1/auth/refresh.
 * - If the API takes more than 2 s, the app shows a waking state and retries
 *   with backoff for up to 60 s, then reports offline. A network failure
 *   during refresh never logs the user out; only a 401 from refresh does.
 */

const BASE = '/api/v1'
const WAKING_AFTER_MS = 2_000
const GIVE_UP_AFTER_MS = 60_000

let accessToken: string | null = null
let refreshing: Promise<boolean> | null = null
const authListeners = new Set<(signedIn: boolean) => void>()

export function setAccessToken(token: string | null) {
  accessToken = token
  authListeners.forEach((l) => l(token !== null))
}

export function onAuthChange(listener: (signedIn: boolean) => void) {
  authListeners.add(listener)
  return () => authListeners.delete(listener)
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fields: Record<string, string[]>
  /** The whole error body, for endpoints that add context (e.g. `next`, `cooldown_until`). */
  readonly data: Record<string, unknown>

  constructor(status: number, body: { code?: string; message?: string; fields?: Record<string, string[]> }) {
    super(body.message ?? `Request failed with status ${status}`)
    this.status = status
    this.code = body.code ?? 'error'
    this.fields = body.fields ?? {}
    this.data = body as Record<string, unknown>
  }
}

export class OfflineError extends Error {
  constructor() {
    super("Couldn't reach the server. Your work is saved on this device and will sync when you're back online.")
  }
}

/** Double-submit CSRF token set by the auth endpoints (spec §16). */
function csrfToken(): string | undefined {
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith('ep_csrf='))
    ?.split('=')[1]
}

export function hasAccessToken() {
  return accessToken !== null
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** fetch with the waking/backoff behaviour. Throws OfflineError after 60 s. */
async function resilientFetch(input: string, init: RequestInit): Promise<Response> {
  const started = Date.now()
  const wakingTimer = setTimeout(() => setServerStatus('waking'), WAKING_AFTER_MS)
  let delay = 1_000
  try {
    for (;;) {
      try {
        const res = await fetch(input, init)
        // 502/503/504 from the proxy usually means the container is still starting.
        if (res.status >= 502 && res.status <= 504 && Date.now() - started < GIVE_UP_AFTER_MS) {
          setServerStatus('waking')
        } else {
          setServerStatus('online')
          return res
        }
      } catch {
        if (Date.now() - started >= GIVE_UP_AFTER_MS) break
        setServerStatus('waking')
      }
      await sleep(delay)
      delay = Math.min(delay * 2, 8_000)
      if (Date.now() - started >= GIVE_UP_AFTER_MS) break
    }
  } finally {
    clearTimeout(wakingTimer)
  }
  setServerStatus('offline')
  throw new OfflineError()
}

/** Restores or renews the session from the refresh cookie. False means signed out. */
export async function refreshAccessToken(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await resilientFetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRFToken': csrfToken() ?? '' },
      })
      // Only a 401 means the session is over. A throttled or failing refresh
      // keeps the session; the caller shows an error and can retry (spec §16).
      if (res.status === 401) {
        setAccessToken(null)
        return false
      }
      if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})))
      const body = (await res.json()) as { access: string }
      setAccessToken(body.access)
      return true
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

type Options = Omit<RequestInit, 'body'> & {
  body?: unknown
  auth?: boolean
  /**
   * Wait through cold starts (the default). Background work such as progress
   * sync passes false: it fails fast and retries on the next 'online' event.
   */
  resilient?: boolean
}

/** One attempt with a 15 s cap: a hung connection on a flaky network can't block the caller. */
async function quickFetch(input: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(input, { ...init, signal: AbortSignal.timeout(15_000) })
  } catch {
    throw new OfflineError()
  }
}

/**
 * A raw request for binary data (screenshot uploads and downloads). Same
 * token and refresh handling as api(); one attempt with a timeout, because
 * uploads only run while online. Absolute URLs (an R2 presigned PUT) are
 * sent without credentials.
 */
export async function apiRaw(url: string, init: RequestInit & { auth?: boolean } = {}): Promise<Response> {
  const { auth = true, headers, ...rest } = init
  const external = /^https?:\/\//.test(url)
  const target = external ? url : `${BASE}${url}`
  const send = () =>
    fetch(target, {
      ...rest,
      credentials: external ? 'omit' : 'include',
      signal: AbortSignal.timeout(60_000),
      headers: {
        ...(!external ? { 'X-CSRFToken': csrfToken() ?? '' } : {}),
        ...(auth && !external && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
    }).catch(() => {
      throw new OfflineError()
    })
  let res = await send()
  if (res.status === 401 && auth && !external && (await refreshAccessToken())) res = await send()
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})))
  return res
}

export async function api<T>(
  path: string,
  { body, auth = true, resilient = true, headers, ...init }: Options = {},
): Promise<T> {
  const send = () =>
    (resilient ? resilientFetch : quickFetch)(`${BASE}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        'X-CSRFToken': csrfToken() ?? '',
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

  let res = await send()
  if (res.status === 401 && auth && (await refreshAccessToken())) {
    res = await send()
  }
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data)
  return data as T
}
