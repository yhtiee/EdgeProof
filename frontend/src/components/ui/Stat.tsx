import type { ReactNode } from 'react'

/**
 * Stat (DESIGN.md §7): label, a large mono figure, optional range bar and
 * the sample size, e.g. "Expectancy · +0.21R · 54 trades".
 */
type Props = {
  label: string
  value: string
  tone?: 'gain' | 'loss' | 'neutral'
  sample?: string
  children?: ReactNode
}

const TONE = { gain: 'text-gain', loss: 'text-loss', neutral: 'text-text' }

export function Stat({ label, value, tone = 'neutral', sample, children }: Props) {
  return (
    <div>
      <p className="text-small text-muted">{label}</p>
      <p className={`font-mono text-figure font-medium ${TONE[tone]}`}>{value}</p>
      {sample && <p className="text-caption text-subtle">{sample}</p>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  )
}
