import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button, Field } from '../../components/ui'
import { ApiError } from '../../lib/api/client'
import { signUp } from './api'
import { AuthLayout } from './AuthLayout'

/** Account creation, onboarding step 1 (§4), with the age statement (AS-4). */
export default function SignUpPage() {
  const navigate = useNavigate()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const over18 = form.get('over_18') === 'on'
    if (!over18) {
      setErrors({ over_18: 'EdgeProof is for adults. Confirm you are 18 or older to continue.' })
      return
    }
    setLoading(true)
    setErrors({})
    try {
      await signUp({
        name: String(form.get('name')),
        email: String(form.get('email')),
        password: String(form.get('password')),
        over_18: over18,
      })
      navigate('/learn')
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(Object.fromEntries(Object.entries(err.fields).map(([k, v]) => [k, v[0]])))
      } else {
        setErrors({ form: (err as Error).message })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Create your account">
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <Field label="Name" name="name" autoComplete="name" required error={errors.name} />
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
        <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2 text-small">
          <input type="checkbox" name="over_18" className="mt-0.5 size-5 shrink-0 accent-[var(--text)]" />
          <span>I am 18 or older.</span>
        </label>
        {errors.over_18 && (
          <p className="text-caption text-danger" aria-live="polite">
            {errors.over_18}
          </p>
        )}
        {errors.form && (
          <p className="text-caption text-danger" aria-live="polite">
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
