/**
 * Small SVG line chart for simulators (DESIGN.md §8): neutral lines, an
 * optional highlighted series, a visible zero line, and a text summary for
 * screen readers. No dual axes, no truncated bars.
 */
type Series = { values: (number | null)[]; tone?: 'neutral' | 'accent' | 'muted' | 'loss'; width?: number }

type Props = { series: Series[]; summary: string; height?: number; zero?: boolean; yLabel?: string }

const STROKE = { neutral: 'var(--neutral-data)', accent: 'var(--text)', muted: 'var(--border-control)', loss: 'var(--loss)' }

export function MiniChart({ series, summary, height = 180, zero = true, yLabel }: Props) {
  const W = 600
  const H = height
  const pad = { l: 8, r: 8, t: 10, b: 10 }
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null))
  let min = Math.min(...all, zero ? 0 : Infinity)
  let max = Math.max(...all, zero ? 0 : -Infinity)
  if (min === max) {
    min -= 1
    max += 1
  }
  const n = Math.max(...series.map((s) => s.values.length))
  const x = (i: number) => pad.l + (i / Math.max(1, n - 1)) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b)

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full rounded-md border border-border bg-bg" role="img" aria-label={summary}>
        {zero && min < 0 && max > 0 && <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="var(--text-subtle)" strokeDasharray="4 4" strokeWidth="1" />}
        {series.map((s, si) => {
          let d = ''
          s.values.forEach((v, i) => {
            if (v === null) return
            d += `${d && s.values[i - 1] !== null ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
          })
          return <path key={si} d={d} fill="none" stroke={STROKE[s.tone ?? 'neutral']} strokeWidth={s.width ?? 1.75} strokeLinejoin="round" strokeLinecap="round" />
        })}
      </svg>
      {yLabel && <figcaption className="mt-1 text-caption text-subtle">{yLabel}</figcaption>}
    </figure>
  )
}
