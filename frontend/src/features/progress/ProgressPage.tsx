import { Check, Lock } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'

/** Progress path (DESIGN.md §7, §12): levels and gates, current position in amber. */
const STEPS = [
  { name: 'Gate 1: plan accepted', state: 'current' },
  { name: 'Level 1: Foundations', state: 'locked' },
  { name: 'Level 2: Probability and risk', state: 'locked' },
  { name: 'Gate 2: Strategy Lab testing', state: 'locked' },
] as const

export default function ProgressPage() {
  return (
    <div className="mx-auto max-w-[680px]">
      <PageHeader title="Progress" description="Each gate opens only when your own data meets its criteria." />
      <ol className="relative ml-3 border-l border-border">
        {STEPS.map((s) => (
          <li key={s.name} className="relative pb-8 pl-8 last:pb-0">
            <span
              className={`absolute -left-3 top-0 flex size-6 items-center justify-center rounded-full border ${
                s.state === 'current' ? 'border-transparent bg-accent text-on-accent' : 'border-control bg-surface text-subtle'
              }`}
              aria-hidden="true"
            >
              {s.state === 'current' ? (
                <Check className="size-3.5" strokeWidth={2} />
              ) : (
                <Lock className="size-3" strokeWidth={1.75} />
              )}
            </span>
            <p className="text-body font-semibold">{s.name}</p>
            <p className="text-small text-muted">{s.state === 'current' ? 'You are here' : 'Locked'}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
