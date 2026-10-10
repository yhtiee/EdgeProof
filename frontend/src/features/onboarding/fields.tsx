import { CheckboxRow, Field, Segmented, SelectField } from '../../components/ui'
import {
  HOUR_PRESETS,
  MISTAKES,
  SESSIONS,
  YEARS_TRADING,
  localWindow,
  timezoneOptions,
  type Experience,
  type SessionKey,
} from './constants'

/**
 * Controlled field groups shared by onboarding (ON-2, ON-3) and the profile
 * section, so both edit the same data the same way.
 */

export type TimeValues = { weekly_hours: string; timezone: string; sessions: SessionKey[] }
export type FieldErrors = Record<string, string | undefined>

export function validateTime(v: TimeValues): FieldErrors {
  const hours = Number(v.weekly_hours)
  const errors: FieldErrors = {}
  if (!v.weekly_hours || !Number.isInteger(hours) || hours < 1 || hours > 80) {
    errors.weekly_hours = 'Enter whole hours between 1 and 80.'
  }
  if (!v.timezone) errors.timezone = 'Choose your timezone.'
  return errors
}

export function TimeFields({
  value,
  onChange,
  errors = {},
}: {
  value: TimeValues
  onChange: (v: TimeValues) => void
  errors?: FieldErrors
}) {
  const toggleSession = (key: SessionKey, on: boolean) =>
    onChange({ ...value, sessions: on ? [...value.sessions, key] : value.sessions.filter((s) => s !== key) })

  return (
    <div className="grid gap-6">
      <div>
        <Field
          label="Hours a week"
          helper="Time you can give to lessons and practice."
          name="weekly_hours"
          numeric
          suffix="h"
          value={value.weekly_hours}
          onChange={(e) => onChange({ ...value, weekly_hours: e.target.value.replace(/[^\d]/g, '') })}
          error={errors.weekly_hours}
          className="max-w-[240px]"
        />
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Common choices">
          {HOUR_PRESETS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => onChange({ ...value, weekly_hours: String(h) })}
              aria-pressed={value.weekly_hours === String(h)}
              className={`min-h-11 min-w-14 rounded-sm border px-3 font-mono text-small ${
                value.weekly_hours === String(h)
                  ? 'border-text bg-text text-bg'
                  : 'border-border bg-surface text-muted hover:border-control hover:text-text'
              }`}
            >
              {h} h
            </button>
          ))}
        </div>
      </div>

      <SelectField
        label="Your timezone"
        name="timezone"
        value={value.timezone}
        onChange={(e) => onChange({ ...value, timezone: e.target.value })}
        options={timezoneOptions(value.timezone)}
        error={errors.timezone}
        helper="Session times below are shown in this timezone."
      />

      <fieldset>
        <legend className="mb-1 text-small font-semibold text-text">Sessions you can usually watch</legend>
        <p className="mb-3 text-caption text-subtle">
          Pick any that fit your day, or none. Times are approximate and shift by an hour with daylight saving.
        </p>
        <div className="grid gap-2">
          {SESSIONS.map((s) => (
            <CheckboxRow
              key={s.key}
              label={s.label}
              description={
                <span className="font-mono">{localWindow(s.utcStart, s.utcEnd, value.timezone || 'UTC')} your time</span>
              }
              checked={value.sessions.includes(s.key)}
              onChange={(on) => toggleSession(s.key, on)}
            />
          ))}
        </div>
      </fieldset>
    </div>
  )
}

export type ExperienceValues = Omit<Experience, 'accounts_blown' | 'prop_challenges' | 'years_trading'> & {
  accounts_blown: string
  prop_challenges: string
  years_trading: Experience['years_trading'] | undefined
}

export const EMPTY_EXPERIENCE: ExperienceValues = {
  years_trading: undefined,
  accounts_blown: '0',
  prop_challenges: '0',
  usual_mistakes: [],
  other_mistake: '',
}

export function experienceToValues(e: Experience | null | undefined): ExperienceValues {
  if (!e) return EMPTY_EXPERIENCE
  return { ...e, accounts_blown: String(e.accounts_blown), prop_challenges: String(e.prop_challenges) }
}

export function validateExperience(v: ExperienceValues): FieldErrors {
  const errors: FieldErrors = {}
  if (!v.years_trading) errors.years_trading = 'Choose how long you’ve been trading.'
  for (const key of ['accounts_blown', 'prop_challenges'] as const) {
    const n = Number(v[key])
    if (v[key] === '' || !Number.isInteger(n) || n < 0 || n > 999) errors[key] = 'Enter a whole number, 0 or more.'
  }
  return errors
}

export function valuesToExperience(v: ExperienceValues): Experience {
  return {
    years_trading: v.years_trading!,
    accounts_blown: Number(v.accounts_blown),
    prop_challenges: Number(v.prop_challenges),
    usual_mistakes: v.usual_mistakes,
    other_mistake: v.other_mistake.trim(),
  }
}

export function ExperienceFields({
  value,
  onChange,
  errors = {},
}: {
  value: ExperienceValues
  onChange: (v: ExperienceValues) => void
  errors?: FieldErrors
}) {
  const toggleMistake = (key: string, on: boolean) =>
    onChange({
      ...value,
      usual_mistakes: on ? [...value.usual_mistakes, key] : value.usual_mistakes.filter((m) => m !== key),
    })

  return (
    <div className="grid gap-6">
      <Segmented
        label="How long have you traded?"
        value={value.years_trading}
        options={YEARS_TRADING}
        onChange={(years_trading) => onChange({ ...value, years_trading })}
        error={errors.years_trading}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Accounts blown"
          name="accounts_blown"
          numeric
          value={value.accounts_blown}
          onChange={(e) => onChange({ ...value, accounts_blown: e.target.value.replace(/[^\d]/g, '') })}
          error={errors.accounts_blown}
          helper="Accounts lost to zero or a margin call."
        />
        <Field
          label="Prop challenges attempted"
          name="prop_challenges"
          numeric
          value={value.prop_challenges}
          onChange={(e) => onChange({ ...value, prop_challenges: e.target.value.replace(/[^\d]/g, '') })}
          error={errors.prop_challenges}
          helper="Paid evaluations with a prop firm."
        />
      </div>

      <fieldset>
        <legend className="mb-1 text-small font-semibold text-text">What usually went wrong?</legend>
        <p className="mb-3 text-caption text-subtle">
          Pick any that apply. Each one becomes a line on your never-again list, shown when you log a trade.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {MISTAKES.map((m) => (
            <CheckboxRow
              key={m.key}
              label={m.label}
              checked={value.usual_mistakes.includes(m.key)}
              onChange={(on) => toggleMistake(m.key, on)}
            />
          ))}
        </div>
        <Field
          label="Something else (optional)"
          name="other_mistake"
          maxLength={160}
          value={value.other_mistake}
          onChange={(e) => onChange({ ...value, other_mistake: e.target.value })}
          className="mt-4"
        />
      </fieldset>
    </div>
  )
}
