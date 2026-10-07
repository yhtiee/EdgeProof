import type { ReactNode } from 'react'
import { Logo } from '../../components/layout/Logo'
import { ServerStatusBanner } from '../../components/ui'

export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg px-4 py-6">
      <div className="mx-auto max-w-[420px]">
        <Logo />
        <main className="mt-12">
          <h1 className="mb-8 text-h1 md:text-h1-lg">{title}</h1>
          <div className="mb-6 empty:hidden">
            <ServerStatusBanner />
          </div>
          {children}
        </main>
      </div>
    </div>
  )
}
