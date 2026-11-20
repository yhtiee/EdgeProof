import { useId, useState, type InputHTMLAttributes } from 'react'
import { CircleAlert, Eye, EyeOff } from 'lucide-react'

/**
 * Text or numeric input (DESIGN.md §7). Label always visible above,
 * helper below, inline error with an icon. Numeric fields use the mono
 * face and a decimal keyboard. Password fields get a show/hide toggle.
 */
type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  helper?: string
  error?: string
  numeric?: boolean
  suffix?: string
}

export function Field({ label, helper, error, numeric, suffix, className = '', id, type, ...rest }: Props) {
  const autoId = useId()
  const inputId = id ?? autoId
  const isPassword = type === 'password'
  const [revealed, setRevealed] = useState(false)
  const describedBy = [helper && `${inputId}-help`, error && `${inputId}-err`].filter(Boolean).join(' ') || undefined

  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-1 block text-small font-semibold text-text">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={isPassword && revealed ? 'text' : type}
          inputMode={numeric ? 'decimal' : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={[
            'block min-h-11 w-full rounded-sm border bg-raised px-3 text-body text-text',
            'read-only:border-border read-only:bg-surface read-only:text-muted',
            numeric ? 'font-mono' : '',
            suffix || isPassword ? 'pr-12' : '',
            error ? 'border-danger' : 'border-control',
          ].join(' ')}
          {...rest}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-small text-subtle">
            {suffix}
          </span>
        )}
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-controls={inputId}
            className="absolute inset-y-0 right-0 flex min-w-11 items-center justify-center rounded-r-sm text-subtle hover:text-text"
          >
            {revealed ? (
              <EyeOff className="size-5" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Eye className="size-5" strokeWidth={1.75} aria-hidden="true" />
            )}
          </button>
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
