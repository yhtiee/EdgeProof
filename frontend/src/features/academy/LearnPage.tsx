import { Link } from 'react-router'
import { PageHeader } from '../../components/layout/PageHeader'
import { buttonClass } from '../../components/ui'

/** Academy home (§5). Lessons load as static JSON so they work while the API sleeps. */
export default function LearnPage() {
  return (
    <div className="mx-auto max-w-[680px]">
      <PageHeader
        title="Learn"
        description="Level 1: Foundations. How forex works, what a pip costs, and why most traders lose."
      />
      <Link to="/try/position-size" className={buttonClass('primary')}>
        Continue lesson
      </Link>
    </div>
  )
}
