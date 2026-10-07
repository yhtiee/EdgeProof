import { Link } from 'react-router'
import { buttonClass } from '../components/ui'

export default function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[680px] flex-col items-start justify-center gap-4 px-4">
      <h1 className="text-h1 md:text-h1-lg">This page doesn&rsquo;t exist</h1>
      <p className="text-body text-muted">The link may be old, or the address may have a typo.</p>
      <Link to="/" className={buttonClass('primary')}>
        Go to the home page
      </Link>
    </main>
  )
}
