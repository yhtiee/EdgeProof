import type { ReactNode } from 'react'
import { Check } from 'lucide-react'

/**
 * Checkbox list row (DESIGN.md §7): a large tap row, not a tiny box. Used for
 * rule checks, sessions and the never-again list.
 */
type Props = {
  label: string
  description?: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  name?: string
}

export function CheckboxRow({ label, description, checked, onChange, name }: Props) {
  return (
    <label
      className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-md border px-4 py-3 transition-colors duration-[var(--motion-fast)] ease-standard has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${
        checked ? 'border-text bg-raised' : 'border-border bg-surface hover:border-control'
      }`}
    >
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        className={`flex size-5 shrink-0 items-center justify-center rounded-sm border ${
          checked ? 'border-text bg-text text-bg' : 'border-control bg-raised'
        }`}
        aria-hidden="true"
      >
        {checked && <Check className="size-3.5" strokeWidth={2.5} />}
      </span>
      <span className="min-w-0">
        <span className="block text-body">{label}</span>
        {description && <span className="block text-small text-muted">{description}</span>}
      </span>
    </label>
  )
}
