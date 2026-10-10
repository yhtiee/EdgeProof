import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { Logo } from '../../components/layout/Logo'
import { ServerStatusBanner } from '../../components/ui'
import { signOut } from '../auth/api'

/**
 * Onboarding layout (DESIGN.md §5 "Auth and onboarding"): fills the width.
 * The step's questions sit on the left; on desktop the right half shows the
 * step list and the answers saved so far, so nothing hides below the fold.
 */
const STEP_NAMES = ['Account', 'Time and sessions', 'Experience', 'Your plan'] as const

type Props = {
  step: number
  title: string
  description?: string
  summary?: ReactNode
  children: ReactNode
}

export function OnboardingLayout({ step, title, description, summary, children }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  async function onSignOut() {
    await signOut().catch(() => undefined)
    queryClient.clear()
    navigate('/')
  }

  return (
    <div className="grid min-h-dvh bg-bg lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-2 md:px-6 lg:border-b-0 lg:px-12 lg:pt-6">
          <Logo to="/onboarding" />
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex min-h-11 items-center px-2 text-small font-semibold text-muted hover:text-text"
          >
            Sign out
          </button>
        </header>

        <div className="px-4 pt-4 md:px-6 lg:hidden">
          <p className="text-small text-muted">
            Step {step} of {STEP_NAMES.length}
          </p>
          <div
            className="mt-2 grid grid-cols-4 gap-1"
            role="progressbar"
            aria-label="Onboarding progress"
            aria-valuemin={1}
            aria-valuemax={STEP_NAMES.length}
            aria-valuenow={step}
          >
            {STEP_NAMES.map((name, i) => (
              <span key={name} className={`h-1 rounded-full ${i < step ? 'bg-text' : 'bg-border'}`} />
            ))}
          </div>
        </div>

        <main className="flex-1 px-4 pb-28 pt-6 md:px-6 lg:px-12 lg:pb-12 lg:pt-12">
          <div className="max-w-[560px]">
            <h1 className="text-h1 md:text-h1-lg">{title}</h1>
            {description && <p className="mt-2 text-body text-muted">{description}</p>}
            <div className="mt-6 empty:hidden">
              <ServerStatusBanner />
            </div>
            <div className="mt-8">{children}</div>
          </div>
        </main>
      </div>

      <aside className="hidden border-l border-border bg-surface lg:block lg:px-12 lg:py-12">
        <div className="sticky top-12 max-w-[520px]">
          <p className="text-small font-semibold text-muted">
            Step {step} of {STEP_NAMES.length}
          </p>
          <ol className="mt-4 grid gap-3">
            {STEP_NAMES.map((name, i) => {
              const n = i + 1
              const done = n < step
              const current = n === step
              return (
                <li key={name} className="flex items-center gap-3" aria-current={current ? 'step' : undefined}>
                  <span
                    className={`flex size-7 items-center justify-center rounded-full border font-mono text-caption ${
                      done
                        ? 'border-text bg-text text-bg'
                        : current
                          ? 'border-transparent bg-accent text-on-accent'
                          : 'border-control text-subtle'
                    }`}
                    aria-hidden="true"
                  >
                    {done ? <Check className="size-3.5" strokeWidth={2.5} /> : n}
                  </span>
                  <span className={current ? 'text-body font-semibold' : 'text-body text-muted'}>
                    {name}
                    {done && <span className="sr-only"> (done)</span>}
                  </span>
                </li>
              )
            })}
          </ol>
          {summary && <div className="mt-8 border-t border-border pt-6">{summary}</div>}
          <p className="mt-8 text-small text-subtle">Each step saves as you go, so you can finish on another device.</p>
        </div>
      </aside>
    </div>
  )
}

/**
 * Step actions: Back (ghost) and the step's one primary action. Sticky and
 * full width at the bottom on phones (DESIGN.md §5), inline on desktop.
 */
export function StepActions({ onBack, children }: { onBack?: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t border-border bg-surface px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:static md:mt-8 md:border-0 md:bg-transparent md:p-0">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 items-center px-3 text-small font-semibold text-muted hover:text-text"
        >
          Back
        </button>
      )}
      <div className="flex-1 md:flex-none [&>*]:w-full md:[&>*]:w-auto">{children}</div>
    </div>
  )
}
