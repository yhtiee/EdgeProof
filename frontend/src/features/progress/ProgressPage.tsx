import { Check, Circle, Lock } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'

/**
 * Progress path (DESIGN.md §7, §12): levels and gates, current position in
 * amber. Wide screens put the path beside the current gate's criteria.
 */
const STEPS = [
  { name: 'Gate 1: plan accepted', state: 'current' },
  { name: 'Level 1: Foundations', state: 'locked' },
  { name: 'Level 2: Probability and risk', state: 'locked' },
  { name: 'Gate 2: Strategy Lab testing', state: 'locked' },
] as const

const CURRENT_CRITERIA = [
  { name: 'Account created', met: true },
  { name: 'Study hours and sessions set', met: false },
  { name: 'Plan accepted', met: false },
]

export default function ProgressPage() {
  return (
    <div>
      <PageHeader title="Progress" description="Each gate opens only when your own data meets its criteria." />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-12">
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
                  <Circle className="size-2.5 fill-current" strokeWidth={0} />
                ) : (
                  <Lock className="size-3" strokeWidth={1.75} />
                )}
              </span>
              <p className="text-body font-semibold">{s.name}</p>
              <p className="text-small text-muted">{s.state === 'current' ? 'You are here' : 'Locked'}</p>
            </li>
          ))}
        </ol>

        <section aria-labelledby="gate-criteria" className="rounded-md border border-border bg-surface p-4 md:p-6">
          <h2 id="gate-criteria" className="text-h3">
            Gate 1 criteria
          </h2>
          <ul className="mt-3">
            {CURRENT_CRITERIA.map((c) => (
              <li key={c.name} className="flex min-h-11 items-center justify-between gap-4 border-t border-border text-small">
                <span>{c.name}</span>
                <span className={`flex items-center gap-1 ${c.met ? 'text-gain' : 'text-muted'}`}>
                  {c.met && <Check className="size-4" strokeWidth={2} aria-hidden="true" />}
                  {c.met ? 'Met' : 'Not yet'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
