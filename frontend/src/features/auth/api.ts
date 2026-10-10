import { api, setAccessToken } from '../../lib/api/client'

type TokenResponse = { access: string }

export async function signIn(email: string, password: string) {
  const res = await api<TokenResponse>('/auth/login', { method: 'POST', auth: false, body: { email, password } })
  setAccessToken(res.access)
}

export type SignUpInput = {
  first_name: string
  last_name: string
  email: string
  password: string
  over_18: boolean
  timezone?: string
}

/**
 * Registration. A 202 means the email may already have an account: the
 * server answers generically (spec §16), so the user is pointed to sign in.
 */
export async function signUp(input: SignUpInput): Promise<'created' | 'check_email'> {
  const res = await api<TokenResponse | { code: string }>('/auth/register', {
    method: 'POST',
    auth: false,
    body: input,
  })
  if ('access' in res) {
    setAccessToken(res.access)
    return 'created'
  }
  return 'check_email'
}

export async function signOut() {
  await api('/auth/logout', { method: 'POST' }).finally(() => setAccessToken(null))
}

export function browserTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return undefined
  }
}
