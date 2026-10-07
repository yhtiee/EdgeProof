import { api, setAccessToken } from '../../lib/api/client'

type TokenResponse = { access: string }

export async function signIn(email: string, password: string) {
  const res = await api<TokenResponse>('/auth/login', { method: 'POST', auth: false, body: { email, password } })
  setAccessToken(res.access)
}

export async function signUp(input: { email: string; password: string; name: string; over_18: boolean }) {
  const res = await api<TokenResponse>('/auth/register', { method: 'POST', auth: false, body: input })
  setAccessToken(res.access)
}

export async function signOut() {
  await api('/auth/logout', { method: 'POST' }).finally(() => setAccessToken(null))
}
