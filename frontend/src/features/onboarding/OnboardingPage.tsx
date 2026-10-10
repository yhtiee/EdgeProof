import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Banner, Button } from '../../components/ui'
import { ApiError } from '../../lib/api/client'
import { ME_KEY, useSession } from '../../lib/session'
import { browserTimezone } from '../auth/api'
import { PLAN_KEY, PROFILE_KEY, acceptPlan, getPlan, getProfile, saveExperienceStep, saveTimeStep } from './api'
import { MISTAKES, SESSIONS, YEARS_TRADING, localWindow, type Profile } from './constants'
import {
  ExperienceFields,
  TimeFields,
  experienceToValues,
  validateExperience,
  validateTime,
  valuesToExperience,
  type FieldErrors,
  type TimeValues,
} from './fields'
import { OnboardingLayout, StepActions } from './OnboardingLayout'

/**
 * Onboarding steps 2–4 (spec §4). Step 1 is account creation. Each step saves
 * on completion and the server remembers the next step (ON-1), so a user can
 * resume on any device. Back moves to earlier steps without losing answers.
 */
export default function OnboardingPage() {
  const session = useSession()
  const profile = useQuery({ queryKey: PROFILE_KEY, queryFn: getProfile })
  const savedStep = session.status === 'signed-in' ? Math.min(session.me.onboarding_step, 4) : 2
  const [viewStep, setViewStep] = useState<number | null>(null)
  const step = viewStep ?? savedStep

  if (session.status !== 'signed-in' || profile.isPending) {
    return (
      <OnboardingLayout step={step} title="Loading your setup…">
        <div className="h-40 animate-pulse rounded-md bg-surface motion-reduce:animate-none" aria-busy="true" />
      </OnboardingLayout>
    )
  }
  if (profile.isError) {
    return (
      <OnboardingLayout step={step} title="Your setup">
        <Banner kind="danger" title="Couldn't load your answers">
          {(profile.error as Error).message} Reload the page to try again.
        </Banner>
      </OnboardingLayout>
    )
  }

  const summary = <AnswersSummary profile={profile.data} timezone={session.me.timezone} />
  const go = (n: number) => {
    setViewStep(n)
    window.scrollTo({ top: 0 })
  }

  if (step === 2) {
    return (
      <TimeStep
        profile={profile.data}
        timezone={session.me.timezone}
        summary={summary}
        onDone={() => go(3)}
      />
    )
  }
  if (step === 3) {
    return <ExperienceStep profile={profile.data} summary={summary} onBack={() => go(2)} onDone={() => go(4)} />
  }
  return <PlanStep summary={summary} onBack={() => go(3)} />
}

function useStepSaved() {
  const queryClient = useQueryClient()
  return (p: Profile) => {
    queryClient.setQueryData(PROFILE_KEY, p)
    queryClient.invalidateQueries({ queryKey: ME_KEY })
    queryClient.invalidateQueries({ queryKey: PLAN_KEY })
  }
}

function fieldErrors(err: unknown): FieldErrors {
  if (err instanceof ApiError) return Object.fromEntries(Object.entries(err.fields).map(([k, v]) => [k, v[0]]))
  return {}
}

/* ---------------- Step 2: time and sessions (ON-2) ---------------- */

function TimeStep({
  profile,
  timezone,
  summary,
  onDone,
}: {
  profile: Profile
  timezone: string
  summary: React.ReactNode
  onDone: () => void
}) {
  const saved = useStepSaved()
  const [value, setValue] = useState<TimeValues>({
    weekly_hours: profile.weekly_hours ? String(profile.weekly_hours) : '',
    timezone: timezone || browserTimezone() || 'UTC',
    sessions: profile.sessions ?? [],
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const save = useMutation({
    mutationFn: () => saveTimeStep({ ...value, weekly_hours: Number(value.weekly_hours) }),
    onSuccess: (p) => {
      saved(p)
      onDone()
    },
    onError: (err) => setErrors(fieldErrors(err)),
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const next = validateTime(value)
    setErrors(next)
    if (Object.values(next).some(Boolean)) return
    save.mutate()
  }

  return (
    <OnboardingLayout
      step={2}
      title="Time and sessions"
      description="Your plan is built around the time you really have."
      summary={summary}
    >
      <form onSubmit={submit} noValidate>
        <TimeFields value={value} onChange={setValue} errors={errors} />
        {save.isError && !Object.keys(fieldErrors(save.error)).length && (
          <p className="mt-4 text-small text-danger" role="alert">
            {(save.error as Error).message}
          </p>
        )}
        <StepActions>
          <Button type="submit" loading={save.isPending} loadingLabel="Saving…">
            Save and continue
          </Button>
        </StepActions>
      </form>
    </OnboardingLayout>
  )
}

/* ---------------- Step 3: experience and history (ON-3) ---------------- */

function ExperienceStep({
  profile,
  summary,
  onBack,
  onDone,
}: {
  profile: Profile
  summary: React.ReactNode
  onBack: () => void
  onDone: () => void
}) {
  const saved = useStepSaved()
  const [value, setValue] = useState(() => experienceToValues(profile.experience))
  const [errors, setErrors] = useState<FieldErrors>({})
  const save = useMutation({
    mutationFn: () => saveExperienceStep(valuesToExperience(value)),
    onSuccess: (p) => {
      saved(p)
      onDone()
    },
    onError: (err) => setErrors(fieldErrors(err)),
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const next = validateExperience(value)
    setErrors(next)
    if (Object.values(next).some(Boolean)) return
    save.mutate()
  }

  return (
    <OnboardingLayout
      step={3}
      title="Experience and history"
      description="No wrong answers. This decides where you start, not whether you can."
      summary={summary}
    >
      <form onSubmit={submit} noValidate>
        <ExperienceFields value={value} onChange={setValue} errors={errors} />
        {save.isError && !Object.keys(fieldErrors(save.error)).length && (
          <p className="mt-4 text-small text-danger" role="alert">
            {(save.error as Error).message}
          </p>
        )}
        <StepActions onBack={onBack}>
          <Button type="submit" loading={save.isPending} loadingLabel="Saving…">
            Save and continue
          </Button>
        </StepActions>
      </form>
    </OnboardingLayout>
  )
}

/* ---------------- Step 4: plan review and acceptance (ON-4, ON-5) ---------------- */

function PlanStep({ summary, onBack }: { summary: React.ReactNode; onBack: () => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const plan = useQuery({ queryKey: PLAN_KEY, queryFn: getPlan })
  const accept = useMutation({
    mutationFn: acceptPlan,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ME_KEY })
      navigate('/learn', { replace: true })
    },
  })

  return (
    <OnboardingLayout
      step={4}
      title="Your plan"
      description="Built from your answers. You can change any of it later in your profile."
      summary={summary}
    >
      {plan.isPending && <div className="h-64 animate-pulse rounded-md bg-surface motion-reduce:animate-none" />}
      {plan.isError && (
        <Banner kind="danger" title="Couldn't build your plan">
          {(plan.error as Error).message}
        </Banner>
      )}
      {plan.data && (
        <div className="grid gap-8">
          <section aria-labelledby="plan-style">
            <h2 id="plan-style" className="text-small font-semibold text-muted">
              Suggested style while you learn
            </h2>
            <p className="mt-1 text-h2 md:text-h2-lg">{plan.data.style.label}</p>
            <p className="mt-1 text-body text-muted">
              On {plan.data.style.charts}. {plan.data.style.reason}
            </p>
          </section>

          <section aria-labelledby="plan-pace" className="border-t border-border pt-6">
            <h2 id="plan-pace" className="text-small font-semibold text-muted">
              Academy pace at {plan.data.weekly_hours} hours a week
            </h2>
            <p className="mt-1 text-body">
              The Strategy Lab opens for drafting after Level {plan.data.time_to_lab.after_level}, in about{' '}
              <span className="font-mono font-medium">{plan.data.time_to_lab.weeks}</span>{' '}
              {plan.data.time_to_lab.weeks === 1 ? 'week' : 'weeks'} ({plan.data.time_to_lab.hours} hours of study).
            </p>
            <table className="mt-4 w-full text-small">
              <caption className="sr-only">Estimated study time per level</caption>
              <thead>
                <tr className="text-left text-subtle">
                  <th scope="col" className="py-2 font-normal">
                    Level
                  </th>
                  <th scope="col" className="py-2 text-right font-normal">
                    Hours
                  </th>
                  <th scope="col" className="py-2 text-right font-normal">
                    Weeks
                  </th>
                </tr>
              </thead>
              <tbody>
                {plan.data.academy.levels.map((l) => (
                  <tr key={l.level} className="border-t border-border">
                    <td className="py-2">
                      {l.level}. {l.title}
                    </td>
                    <td className="py-2 text-right font-mono">{l.hours}</td>
                    <td className="py-2 text-right font-mono">{l.weeks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-caption text-subtle">Estimates. They&rsquo;ll be adjusted as real learners finish each level.</p>
          </section>

          <section aria-labelledby="plan-sessions" className="border-t border-border pt-6">
            <h2 id="plan-sessions" className="text-small font-semibold text-muted">
              Sessions in your time ({plan.data.timezone.replace(/_/g, ' ')})
            </h2>
            {plan.data.sessions.length ? (
              <ul className="mt-2 grid gap-1">
                {plan.data.sessions.map((s) => (
                  <li key={s.key} className="flex justify-between gap-4 text-body">
                    <span>{s.label}</span>
                    <span className="font-mono">{localWindow(s.utc_start, s.utc_end, plan.data.timezone)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-body text-muted">
                None picked. Daily and 4-hour charts can be studied at any time of day.
              </p>
            )}
          </section>

          <section aria-labelledby="plan-placement" className="border-t border-border pt-6">
            <h2 id="plan-placement" className="text-small font-semibold text-muted">
              Placement exams
            </h2>
            <p className="mt-1 text-body">{plan.data.placement.note}</p>
          </section>

          {plan.data.never_again.length > 0 && (
            <section aria-labelledby="plan-never" className="border-t border-border pt-6">
              <h2 id="plan-never" className="text-small font-semibold text-muted">
                Your never-again list
              </h2>
              <ul className="mt-2 grid list-disc gap-1 pl-5 text-body">
                {plan.data.never_again.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </section>
          )}

          {accept.isError && (
            <p className="text-small text-danger" role="alert">
              {(accept.error as Error).message}
            </p>
          )}
        </div>
      )}
      <StepActions onBack={onBack}>
        <Button
          type="button"
          onClick={() => accept.mutate()}
          disabled={!plan.data}
          loading={accept.isPending}
          loadingLabel="Accepting…"
        >
          Accept plan and open the Academy
        </Button>
      </StepActions>
    </OnboardingLayout>
  )
}

/* ---------------- Right-hand summary of saved answers ---------------- */

function AnswersSummary({ profile, timezone }: { profile: Profile; timezone: string }) {
  const exp = profile.experience
  const rows: [string, string][] = []
  if (profile.weekly_hours) rows.push(['Hours a week', `${profile.weekly_hours} h`])
  if (profile.weekly_hours) {
    const names = SESSIONS.filter((s) => profile.sessions.includes(s.key)).map(
      (s) => `${s.label} ${localWindow(s.utcStart, s.utcEnd, timezone)}`,
    )
    rows.push(['Sessions', names.length ? names.join(', ') : 'None picked'])
  }
  if (exp) {
    rows.push(['Trading for', YEARS_TRADING.find((y) => y.value === exp.years_trading)?.label ?? ''])
    rows.push(['Accounts blown', String(exp.accounts_blown)])
    rows.push(['Prop challenges', String(exp.prop_challenges)])
    const mistakes = MISTAKES.filter((m) => exp.usual_mistakes.includes(m.key)).map((m) => m.label)
    if (exp.other_mistake) mistakes.push(exp.other_mistake)
    if (mistakes.length) rows.push(['Usually went wrong', mistakes.join('; ')])
  }

  if (!rows.length) {
    return <p className="text-small text-muted">Your answers will appear here as you save each step.</p>
  }
  return (
    <>
      <p className="text-small font-semibold text-muted">Saved so far</p>
      <dl className="mt-3 grid gap-3">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-caption text-subtle">{k}</dt>
            <dd className="text-small">{v}</dd>
          </div>
        ))}
      </dl>
    </>
  )
}
