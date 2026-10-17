import { useId } from 'react'
import { Field, SelectField } from '../../components/ui'
import { DAY_LABEL, OPTION, PARAM_LABEL } from './labels'
import type { Distance } from './types'
import { WEEKDAYS, type Spec } from './vocabulary'

/**
 * One parameter of a rule, rendered from its vocabulary spec: a select for
 * options, a mono numeric field for numbers, value + unit for distances, a
 * time field, or weekday toggles. `path` lets the checklist's "Fix" link
 * focus it (data-path).
 */
export function ParamField({
  name,
  spec,
  value,
  onChange,
  path,
  error,
  readOnly,
  label,
  helper,
  options,
}: {
  name: string
  spec: Spec
  value: unknown
  onChange: (value: unknown) => void
  path: string
  error?: string
  readOnly?: boolean
  label?: string
  helper?: string
  /** Restrict which enum values are offered. */
  options?: string[]
}) {
  const id = useId()
  const text = label ?? PARAM_LABEL[name] ?? name
  const range = spec.kind === 'int' || spec.kind === 'num' ? `${spec.min}–${spec.max}` : undefined

  if (spec.kind === 'enum') {
    const values = options ?? (spec.values as string[])
    return (
      <SelectField
        label={text}
        value={(value as string) ?? ''}
        disabled={readOnly}
        data-path={path}
        error={error}
        helper={helper}
        options={[...(value ? [] : [{ value: '', label: 'Choose…' }]), ...values.map((v) => ({ value: v, label: OPTION[v] ?? v }))]}
        onChange={(e) => onChange(e.target.value || null)}
      />
    )
  }
  if (spec.kind === 'int' || spec.kind === 'num') {
    return (
      <Field
        label={text}
        numeric
        inputMode="decimal"
        value={value === null || value === undefined ? '' : String(value)}
        readOnly={readOnly}
        data-path={path}
        error={error}
        helper={helper ?? range}
        onChange={(e) => {
          const raw = e.target.value.replace(',', '.').trim()
          onChange(raw === '' ? null : Number.isNaN(Number(raw)) ? raw : Number(raw))
        }}
      />
    )
  }
  if (spec.kind === 'distance') {
    const d = (value as Distance | null) ?? { unit: 'pips', value: 0 }
    return (
      <fieldset className="grid grid-cols-[1fr_auto] items-end gap-2" data-path={path}>
        <legend className="sr-only">{text}</legend>
        <Field
          label={text}
          numeric
          inputMode="decimal"
          value={value ? String(d.value) : ''}
          readOnly={readOnly}
          error={error}
          helper={helper}
          onChange={(e) => {
            const n = Number(e.target.value.replace(',', '.'))
            onChange({ unit: d.unit, value: Number.isNaN(n) ? 0 : n })
          }}
        />
        <SelectField
          label="Unit"
          value={d.unit}
          disabled={readOnly}
          options={[{ value: 'pips', label: 'pips' }, { value: 'atr', label: '× ATR(14)' }]}
          onChange={(e) => onChange({ ...d, unit: e.target.value as Distance['unit'] })}
        />
      </fieldset>
    )
  }
  if (spec.kind === 'time') {
    return (
      <Field
        label={text}
        type="time"
        value={(value as string) ?? ''}
        readOnly={readOnly}
        data-path={path}
        error={error}
        helper={helper}
        onChange={(e) => onChange(e.target.value || null)}
      />
    )
  }
  if (spec.kind === 'days') {
    const days = (value as string[]) ?? []
    return (
      <fieldset data-path={path}>
        <legend className="mb-1 text-small font-semibold">{text}</legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((d) => {
            const on = days.includes(d)
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                disabled={readOnly}
                id={`${id}-${d}`}
                onClick={() => onChange(on ? days.filter((x) => x !== d) : WEEKDAYS.filter((x) => x === d || days.includes(x)))}
                className={`min-h-11 min-w-12 rounded-md border px-3 text-small font-semibold ${on ? 'border-text bg-text text-bg' : 'border-control text-muted hover:text-text'}`}
              >
                {DAY_LABEL[d]}
              </button>
            )
          })}
        </div>
        {error && <p className="mt-1 text-caption text-danger">{error}</p>}
      </fieldset>
    )
  }
  return null
}
