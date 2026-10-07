import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'

/**
 * Button (DESIGN.md §7). Primary is the one amber element on a screen.
 * Loading keeps the width and shows the verb ("Saving…").
 */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent border-transparent hover:brightness-95 active:brightness-90',
  secondary: 'bg-transparent text-text border-control hover:bg-surface active:bg-raised',
  ghost: 'bg-transparent text-text border-transparent hover:bg-surface active:bg-raised',
  danger: 'bg-transparent text-danger border-danger hover:bg-surface active:bg-raised',
}

export const buttonClass = (variant: Variant = 'primary', full = false) =>
  [
    'inline-flex min-h-11 md:min-h-9 items-center justify-center gap-2 rounded-md border px-4',
    'text-body md:text-small font-semibold whitespace-nowrap select-none',
    'transition-[background-color,filter] duration-[var(--motion-fast)] ease-standard',
    'disabled:cursor-not-allowed disabled:opacity-60',
    VARIANTS[variant],
    full ? 'w-full' : '',
  ].join(' ')

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  full?: boolean
  loading?: boolean
  loadingLabel?: string
  icon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', full, loading, loadingLabel, icon, children, className = '', disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`${buttonClass(variant, full)} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : icon}
      <span>{loading && loadingLabel ? loadingLabel : children}</span>
    </button>
  )
})
