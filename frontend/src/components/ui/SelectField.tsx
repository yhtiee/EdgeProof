import { useId, type SelectHTMLAttributes } from 'react'
import { ChevronDown, CircleAlert } from 'lucide-react'

/** Select (DESIGN.md §7): label above, helper below, inline error. */
type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  helper?: string
  error?: string
  options: { value: string; label: string }[]
}

export function SelectField({ label, helper, error, options, className = '', id, ...rest }: Props) {
  const autoId = useId()
  const selectId = id ?? autoId
  const describedBy = [helper && `${selectId}-help`, error && `${selectId}-err`].filter(Boolean).join(' ') || undefined

  return (
    <div className={className}>
      <label htmlFor={selectId} className="mb-1 block text-small font-semibold text-text">
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`block min-h-11 w-full appearance-none rounded-sm border bg-raised pl-3 pr-10 text-body text-text ${
            error ? 'border-danger' : 'border-control'
          }`}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-subtle"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </div>
      {helper && !error && (
        <p id={`${selectId}-help`} className="mt-1 text-caption text-subtle">
          {helper}
        </p>
      )}
      {error && (
        <p id={`${selectId}-err`} className="mt-1 flex items-center gap-1 text-caption text-danger" aria-live="polite">
          <CircleAlert className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}
