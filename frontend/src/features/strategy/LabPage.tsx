import { PageHeader } from '../../components/layout/PageHeader'
import { Button, EmptyState } from '../../components/ui'

/** Strategy Lab (§6). Drafting opens after Level 2; testing unlocks at Gate 3. */
export default function LabPage() {
  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        title="Strategy Lab"
        description="Write your own rulebook, one part at a time. Clarity checks run as you type."
      />
      <EmptyState
        message="No strategies yet. Drafting opens when you finish Level 2 of the Academy."
        action={
          <Button variant="secondary" disabled>
            Start a draft
          </Button>
        }
      />
    </div>
  )
}
