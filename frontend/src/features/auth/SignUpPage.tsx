import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Banner, Button, CheckboxRow, Field } from '../../components/ui'
import { ApiError } from '../../lib/api/client'
import { ME_KEY, homeFor, useSession } from '../../lib/session'
import { browserTimezone, signUp } from './api'
import { AuthLayout } from './AuthLayout'

type Errors = Partial<Record<'first_name' | 'last_name' | 'email' | 'password' | 'over_18' | 'form', string>>

/** Account creation: onboarding step 1 (spec §4), with the age statement (AS-4). */
export default function SignUpPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const session = useSession()
  const [errors, setErrors] = useState<Errors>({})
  const [over18, setOver18] = useState(false)
  const [loading, setLoading] = useState(false)
  const [existing, setExisting] = useState(false)

  if (session.status === 'signed-in') return <Navigate to={homeFor(session.me)} replace />

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formEl = e.currentTarget
    const form = new FormData(formEl)
    const values = {
      first_name: String(form.get('first_name')).trim(),
      last_name: String(form.get('last_name')).trim(),
      email: String(form.get('email')).trim(),
      password: String(form.get('password')),
    }

    const next: Errors = {}
    if (!values.first_name) next.first_name = 'Enter your first name.'
    if (!values.last_name) next.last_name = 'Enter your last name.'
    if (!values.email) next.email = 'Enter your email.'
    if (values.password.length < 10) next.password = 'Use at least 10 characters.'
    if (!over18) next.over_18 = 'EdgeProof is for adults. Confirm you are 18 or older to continue.'
    setErrors(next)
    if (Object.keys(next).length) {
      formEl.querySelector<HTMLElement>('[aria-invalid="true"], input[name="over_18"]')?.focus()
      return
    }

    setLoading(true)
    try {
      const result = await signUp({ ...values, over_18: true, timezone: browserTimezone() })
      if (result === 'check_email') {
        setExisting(true)
        return
      }
      await queryClient.invalidateQueries({ queryKey: ME_KEY })
      navigate('/onboarding', { replace: true })
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) {
        setErrors(Object.fromEntries(Object.entries(err.fields).map(([k, v]) => [k, v[0]])))
      } else {
        setErrors({ form: (err as Error).message })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      description="Step 1 of 4. The whole setup takes about 3 minutes."
      aside={<SignUpAside />}
    >
      {existing && (
        <div className="mb-6">
          <Banner kind="info" title="Check your email to continue">
            If you already have an account with this email,{' '}
            <Link to="/sign-in" className="font-semibold text-accent-text underline underline-offset-2">
              sign in
            </Link>{' '}
            instead.
          </Banner>
        </div>
      )}
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" name="first_name" autoComplete="given-name" required error={errors.first_name} />
          <Field label="Last name" name="last_name" autoComplete="family-name" required error={errors.last_name} />
        </div>
        <Field label="Email" name="email" type="email" autoComplete="email" required error={errors.email} />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          helper="At least 10 characters."
          required
          error={errors.password}
        />
        <CheckboxRow name="over_18" label="I am 18 or older" checked={over18} onChange={setOver18} />
        {errors.over_18 && (
          <p className="-mt-2 text-caption text-danger" aria-live="polite">
            {errors.over_18}
          </p>
        )}
        {errors.form && (
          <p className="text-small text-danger" role="alert">
            {errors.form}
          </p>
        )}
        <Button type="submit" full loading={loading} loadingLabel="Creating account…" className="mt-2">
          Create account
        </Button>
        <p className="text-caption text-subtle">
          EdgeProof is education only. It never gives trade calls or personal financial advice.
        </p>
      </form>
      <p className="mt-6 text-small text-muted">
        Already have an account?{' '}
        <Link to="/sign-in" className="font-semibold text-accent-text underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}

const NEXT_STEPS = [
  { title: 'Time and sessions', body: 'How many hours a week you have, and which market sessions you can watch.' },
  { title: 'Experience', body: 'What you’ve tried before and what usually went wrong. It starts your never-again list.' },
  { title: 'Your plan', body: 'A suggested learning style, Academy pace and time to the Strategy Lab. Accept it to open the Academy.' },
]

function SignUpAside() {
  return (
    <>
      <p className="text-h2 md:text-h2-lg">After this, three short steps</p>
      <ol className="mt-6 grid gap-6">
        {NEXT_STEPS.map((s, i) => (
          <li key={s.title} className="grid grid-cols-[2rem_1fr] gap-4">
            <span
              className="flex size-8 items-center justify-center rounded-full border border-control font-mono text-small"
              aria-hidden="true"
            >
              {i + 2}
            </span>
            <div>
              <p className="text-body font-semibold">{s.title}</p>
              <p className="text-small text-muted">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-8 border-t border-border pt-4 text-small text-muted">
        Each step saves as you go, so you can finish on another device.
      </p>
    </>
  )
}
