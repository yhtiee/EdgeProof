import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Button, Field, RangeBar } from '../../components/ui'
import { ApiError, api } from '../../lib/api/client'
import { ME_KEY, homeFor, useSession, type Me } from '../../lib/session'
import { signIn } from './api'
import { AuthLayout } from './AuthLayout'

export default function SignInPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const queryClient = useQueryClient()
  const session = useSession()
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({})
  const [loading, setLoading] = useState(false)

  if (session.status === 'signed-in') return <Navigate to={homeFor(session.me)} replace />

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const email = String(form.get('email')).trim()
    const password = String(form.get('password'))
    const next: typeof errors = {}
    if (!email) next.email = 'Enter your email.'
    if (!password) next.password = 'Enter your password.'
    setErrors(next)
    if (next.email || next.password) {
      e.currentTarget.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus()
      return
    }

    setLoading(true)
    try {
      await signIn(email, password)
      const me = await api<Me>('/me')
      queryClient.setQueryData(ME_KEY, me)
      const target = params.get('next')
      navigate(me.plan_accepted_at && target?.startsWith('/') ? target : homeFor(me), { replace: true })
    } catch (err) {
      // Generic on purpose: never reveal whether an account exists (spec §16).
      setErrors({
        form:
          err instanceof ApiError
            ? 'That email and password don’t match an account. Check both and try again.'
            : (err as Error).message,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Sign in" description="Pick up where you left off." aside={<SignInAside />}>
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <Field label="Email" name="email" type="email" autoComplete="email" required error={errors.email} />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          error={errors.password}
        />
        {errors.form && (
          <p className="text-small text-danger" role="alert">
            {errors.form}
          </p>
        )}
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

function SignInAside() {
  return (
    <>
      <p className="text-h2 md:text-h2-lg">Every number here comes with its range.</p>
      <p className="mt-3 text-body text-muted">
        Your journal, rulebook and results stay private to you. Nothing is shared unless you choose to share it.
      </p>
      <div className="mt-8 rounded-lg border border-border bg-bg p-4 md:p-6">
        <RangeBar label="Expectancy, example" estimate={0.21} low={-0.04} high={0.46} domain={[-0.2, 0.6]} />
        <p className="mt-2 text-caption text-subtle">54 trades. Example figures.</p>
      </div>
    </>
  )
}
