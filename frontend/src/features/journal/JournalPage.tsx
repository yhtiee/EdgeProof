import { Link } from 'react-router'
import { PageHeader } from '../../components/layout/PageHeader'
import { EmptyState, buttonClass } from '../../components/ui'

/** Practice journal (JR-1): open from day one, no gate. */
export default function JournalPage() {
  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        title="Journal"
        description="Practice trades, rule checks and reviews. Practice trades never count toward a verdict."
      />
      <EmptyState
        message="No trades yet. Log your first practice trade to start building your record."
        action={
          <Link to="/journal/new" className={buttonClass('primary')}>
            Log trade
          </Link>
        }
      />
    </div>
  )
}
