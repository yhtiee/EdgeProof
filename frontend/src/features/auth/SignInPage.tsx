import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button, Field } from '../../components/ui'
import { ApiError } from '../../lib/api/client'
import { signIn } from './api'
import { AuthLayout } from './AuthLayout'

export default function SignInPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setLoading(true)
    setError(undefined)
    try {
      await signIn(String(form.get('email')), String(form.get('password')))
      navigate('/learn')
    } catch (err) {
      // Generic on purpose: never reveal whether an account exists (§16).
      setError(err instanceof ApiError ? 'That email and password don’t match an account. Check both and try again.' : (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Sign in">
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field label="Password" name="password" type="password" autoComplete="current-password" required error={error} />
        <Button type="submit" full loading={loading} loadingLabel="Signing in…" className="mt-2">
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-small text-muted">
        New here?{' '}
        <Link to="/sign-up" className="font-semibold text-accent-text underline underline-offset-2">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  )
}
