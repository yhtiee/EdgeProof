import { useId, type InputHTMLAttributes } from 'react'
import { CircleAlert } from 'lucide-react'

/**
 * Text or numeric input (DESIGN.md §7). Label always visible above,
 * helper below, inline error with an icon. Numeric fields use the mono
 * face and a decimal keyboard.
 */
type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  helper?: string
  error?: string
  numeric?: boolean
  suffix?: string
}

export function Field({ label, helper, error, numeric, suffix, className = '', id, ...rest }: Props) {
  const autoId = useId()
  const inputId = id ?? autoId
  const describedBy = [helper && `${inputId}-help`, error && `${inputId}-err`].filter(Boolean).join(' ') || undefined

  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-1 block text-small font-semibold text-text">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          inputMode={numeric ? 'decimal' : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={[
            'block min-h-11 w-full rounded-sm border bg-raised px-3 text-body text-text',
            numeric ? 'font-mono' : '',
            suffix ? 'pr-12' : '',
            error ? 'border-danger' : 'border-control',
          ].join(' ')}
          {...rest}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-small text-subtle">
            {suffix}
          </span>
        )}
      </div>
      {helper && !error && (
        <p id={`${inputId}-help`} className="mt-1 text-caption text-subtle">
          {helper}
        </p>
      )}
      {error && (
        <p id={`${inputId}-err`} className="mt-1 flex items-center gap-1 text-caption text-danger" aria-live="polite">
          <CircleAlert className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}
