import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'
import { PositionSizeSimulator } from './simulators/PositionSizeSimulator'

/**
 * Visitors can try one simulator before signing up (§4). On wide screens the
 * explanation sits beside the simulator, so nothing needs scrolling.
 */
export default function TryLessonPage() {
  return (
    <main className="px-4 py-6 md:px-6 md:py-10 lg:px-8">
      <Link to="/" className="mb-6 inline-flex min-h-11 items-center gap-2 text-small text-muted hover:text-text">
        <ArrowLeft className="size-5" strokeWidth={1.75} aria-hidden="true" />
        Back
      </Link>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-12">
        <div>
          <h1 className="text-h1 md:text-h1-lg">Position sizing</h1>
          <p className="measure mt-3 text-body text-muted">
            Your position size comes from your stop, not from how sure you feel. Move the stop wider and watch the size
            shrink while the money at risk stays the same.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4 md:p-6">
          <PositionSizeSimulator />
        </div>
      </div>
    </main>
  )
}
