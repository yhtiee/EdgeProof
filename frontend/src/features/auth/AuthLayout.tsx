import type { ReactNode } from 'react'
import { Logo } from '../../components/layout/Logo'
import { ServerStatusBanner } from '../../components/ui'

/**
 * Auth layout (DESIGN.md §5 "Auth and onboarding"): a split screen that fills
 * the width. The form column sits on the left, left-aligned; a context panel
 * fills the right half on desktop. Phones get the form only.
 */
type Props = { title: string; description?: string; aside: ReactNode; children: ReactNode }

export function AuthLayout({ title, description, aside, children }: Props) {
  return (
    <div className="grid min-h-dvh bg-bg lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col px-4 py-4 md:px-6 lg:px-12 lg:py-6">
        <Logo />
        <main className="flex flex-1 flex-col justify-center py-8 lg:py-12">
          <div className="w-full max-w-[420px]">
            <h1 className="text-h1 md:text-h1-lg">{title}</h1>
            {description && <p className="mt-2 text-body text-muted">{description}</p>}
            <div className="mt-6 empty:hidden">
              <ServerStatusBanner />
            </div>
            <div className="mt-8">{children}</div>
          </div>
        </main>
      </div>
      <aside className="hidden border-l border-border bg-surface lg:flex lg:flex-col lg:justify-center lg:px-12 lg:py-12">
        <div className="max-w-[520px]">{aside}</div>
      </aside>
    </div>
  )
}
