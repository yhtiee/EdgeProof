import type { ReactNode } from 'react'

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-h1 md:text-h1-lg">{title}</h1>
        {description && <p className="mt-2 max-w-[60ch] text-body text-muted">{description}</p>}
      </div>
      {action}
    </header>
  )
}
