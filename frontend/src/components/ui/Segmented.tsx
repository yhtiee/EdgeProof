import { useId } from 'react'

/**
 * Segmented control (DESIGN.md §7) for 2–4 options. A radio group under the
 * hood, so arrow keys move between options.
 */
type Props<T extends string> = {
  label: string
  value: T | undefined
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  error?: string
}

export function Segmented<T extends string>({ label, value, options, onChange, error }: Props<T>) {
  const name = useId()
  return (
    <fieldset>
      <legend className="mb-1 text-small font-semibold text-text">{label}</legend>
      <div
        className={`grid grid-cols-2 gap-1 rounded-md border p-1 sm:flex ${error ? 'border-danger' : 'border-control'}`}
      >
        {options.map((o) => (
          <label
            key={o.value}
            className={`flex min-h-11 cursor-pointer items-center justify-center rounded-sm px-3 sm:flex-1 text-center text-small font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${
              value === o.value ? 'bg-text text-bg' : 'text-muted hover:bg-surface hover:text-text'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
      {error && (
        <p className="mt-1 text-caption text-danger" aria-live="polite">
          {error}
        </p>
      )}
    </fieldset>
  )
}
