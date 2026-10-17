import { useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Banner, Button, Field } from '../../components/ui'
import { ApiError, api } from '../../lib/api/client'
import { ME_KEY, useSession, type Me } from '../../lib/session'
import { PLAN_KEY, PROFILE_KEY, getProfile } from '../onboarding/api'
import { ProgressSection } from './ProgressSection'
import type { Profile } from '../onboarding/constants'
import {
  ExperienceFields,
  TimeFields,
  experienceToValues,
  validateExperience,
  validateTime,
  valuesToExperience,
  type FieldErrors,
  type TimeValues,
} from '../onboarding/fields'

/**
 * Profile section: user data (name, timezone) and trader profile (study
 * setup, trading background). Each section saves on its own. Layout per
 * DESIGN.md §5: label and description on the left, the form on the right.
 */
export default function ProfilePage() {
  const session = useSession()
  const profile = useQuery({ queryKey: PROFILE_KEY, queryFn: getProfile })

  if (session.status !== 'signed-in' || profile.isPending) {
    return <div className="h-64 animate-pulse rounded-md bg-surface motion-reduce:animate-none" aria-busy="true" />
  }
  if (profile.isError) {
    return (
      <Banner kind="danger" title="Couldn't load your profile">
        {(profile.error as Error).message}
      </Banner>
    )
  }

  return (
    <div>
      <PageHeader title="Profile" description="Your progress, your details and the answers your plan is built from." />
      <div className="grid gap-12">
        <ProgressSection />
        <PersonalSection me={session.me} />
        <StudySection me={session.me} profile={profile.data} />
        <BackgroundSection profile={profile.data} />
      </div>
    </div>
  )
}

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={id}
      className="grid gap-6 border-t border-border pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-12"
    >
      <div>
        <h2 id={id} className="text-h3">
          {title}
        </h2>
        <p className="mt-1 max-w-[40ch] text-small text-muted">{description}</p>
      </div>
      <div className="max-w-[720px]">{children}</div>
    </section>
  )
}

function SaveRow({ pending, saved, error }: { pending: boolean; saved: boolean; error?: string }) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-4">
      <Button type="submit" variant="secondary" loading={pending} loadingLabel="Saving…">
        Save changes
      </Button>
      <span aria-live="polite" className="text-small">
        {saved && !pending && (
          <span className="inline-flex items-center gap-1 text-gain">
            <Check className="size-4" strokeWidth={2} aria-hidden="true" />
            Changes saved
          </span>
        )}
        {error && <span className="text-danger">{error}</span>}
      </span>
    </div>
  )
}

function apiFieldErrors(err: unknown): FieldErrors {
  if (!(err instanceof ApiError)) return {}
  return Object.fromEntries(Object.entries(err.fields).map(([k, v]) => [k, v[0]]))
}

/* ---------------- Personal details (User) ---------------- */

function PersonalSection({ me }: { me: Me }) {
  const queryClient = useQueryClient()
  const [first, setFirst] = useState(me.first_name)
  const [last, setLast] = useState(me.last_name)
  const [errors, setErrors] = useState<FieldErrors>({})
  const save = useMutation({
    mutationFn: () => api<Me>('/me', { method: 'PATCH', body: { first_name: first.trim(), last_name: last.trim() } }),
    onSuccess: (data) => queryClient.setQueryData(ME_KEY, data),
    onError: (err) => setErrors(apiFieldErrors(err)),
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    const next: FieldErrors = {}
    if (!first.trim()) next.first_name = 'Enter your first name.'
    if (!last.trim()) next.last_name = 'Enter your last name.'
    setErrors(next)
    if (Object.values(next).some(Boolean)) return
    save.mutate()
  }

  return (
    <Section id="personal" title="Personal details" description="How your name appears in EdgeProof.">
      <form onSubmit={submit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="First name"
            name="first_name"
            autoComplete="given-name"
            value={first}
            onChange={(e) => setFirst(e.target.value)}
            error={errors.first_name}
          />
          <Field
            label="Last name"
            name="last_name"
            autoComplete="family-name"
            value={last}
            onChange={(e) => setLast(e.target.value)}
            error={errors.last_name}
          />
          <Field
            label="Email"
            name="email"
            value={me.email}
            readOnly
            helper="Changing your email needs re-verification, which arrives with account security settings."
            className="sm:col-span-2"
          />
        </div>
        <SaveRow
          pending={save.isPending}
          saved={save.isSuccess}
          error={save.isError && !Object.keys(apiFieldErrors(save.error)).length ? (save.error as Error).message : undefined}
        />
      </form>
    </Section>
  )
}

/* ---------------- Study setup (Profile + User.timezone) ---------------- */

function StudySection({ me, profile }: { me: Me; profile: Profile }) {
  const queryClient = useQueryClient()
  const [value, setValue] = useState<TimeValues>({
    weekly_hours: profile.weekly_hours ? String(profile.weekly_hours) : '',
    timezone: me.timezone,
    sessions: profile.sessions ?? [],
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const save = useMutation({
    mutationFn: async () => {
      const user = await api<Me>('/me', { method: 'PATCH', body: { timezone: value.timezone } })
      const p = await api<Profile>('/me/profile', {
        method: 'PATCH',
        body: { weekly_hours: Number(value.weekly_hours), sessions: value.sessions },
      })
      return { user, p }
    },
    onSuccess: ({ user, p }) => {
      queryClient.setQueryData(ME_KEY, user)
      queryClient.setQueryData(PROFILE_KEY, p)
      queryClient.invalidateQueries({ queryKey: PLAN_KEY })
    },
    onError: (err) => setErrors(apiFieldErrors(err)),
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    const next = validateTime(value)
    setErrors(next)
    if (Object.values(next).some(Boolean)) return
    save.mutate()
  }

  return (
    <Section
      id="study"
      title="Study setup"
      description="Your weekly hours, timezone and sessions. Reminders and Academy pace follow these."
    >
      <form onSubmit={submit} noValidate>
        <TimeFields value={value} onChange={setValue} errors={errors} />
        <SaveRow
          pending={save.isPending}
          saved={save.isSuccess}
          error={save.isError && !Object.keys(apiFieldErrors(save.error)).length ? (save.error as Error).message : undefined}
        />
      </form>
    </Section>
  )
}

/* ---------------- Trading background (Profile.answers.experience) ---------------- */

function BackgroundSection({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient()
  const [value, setValue] = useState(() => experienceToValues(profile.experience))
  const [errors, setErrors] = useState<FieldErrors>({})
  const save = useMutation({
    mutationFn: () => api<Profile>('/me/profile', { method: 'PATCH', body: { experience: valuesToExperience(value) } }),
    onSuccess: (p) => {
      queryClient.setQueryData(PROFILE_KEY, p)
      queryClient.invalidateQueries({ queryKey: PLAN_KEY })
    },
    onError: (err) => setErrors(apiFieldErrors(err)),
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    const next = validateExperience(value)
    setErrors(next)
    if (Object.values(next).some(Boolean)) return
    save.mutate()
  }

  return (
    <Section
      id="background"
      title="Trading background"
      description="What you've tried before. New mistakes you tick are added to your never-again list; existing lines stay."
    >
      <form onSubmit={submit} noValidate>
        <ExperienceFields value={value} onChange={setValue} errors={errors} />
        <SaveRow
          pending={save.isPending}
          saved={save.isSuccess}
          error={save.isError && !Object.keys(apiFieldErrors(save.error)).length ? (save.error as Error).message : undefined}
        />
      </form>
    </Section>
  )
}
