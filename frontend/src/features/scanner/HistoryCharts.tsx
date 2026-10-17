import { useState } from 'react'
import { Segmented } from '../../components/ui'
import { useHistory, type HistoryPoint } from './api'
import { BANDS, LABEL_TEXT, formatDate, formatScore } from './format'

/**
 * Bias history (docs/scanner §5): two stacked charts on one time axis (score
 * with its five label bands, then the weekly close) instead of one chart with
 * two y-axes, which DESIGN.md rules out. Pointer or keyboard picks a week.
 */
type Range = '12' | '52' | 'all'
const W = 600
const H_SCORE = 160
const H_PRICE = 110

const BAND_FILL: Record<string, string> = {
  very_bullish: 'fill-gain/20',
  bullish: 'fill-gain/8',
  neutral: 'fill-transparent',
  bearish: 'fill-loss/8',
  very_bearish: 'fill-loss/20',
}

export function linePath(values: (number | null)[], y: (v: number) => number): string {
  const n = values.length
  let d = ''
  let pen = false
  values.forEach((v, i) => {
    if (v === null) {
      pen = false
      return
    }
    const x = n === 1 ? W / 2 : (i / (n - 1)) * W
    d += `${pen ? 'L' : 'M'}${x.toFixed(1)},${y(v).toFixed(1)}`
    pen = true
  })
  return d
}

export function HistoryCharts({ symbol }: { symbol: string }) {
  const [range, setRange] = useState<Range>('52')
  const q = useHistory(symbol, range)
  const points = q.data?.points ?? []
  const [active, setActive] = useState<number | null>(null)
  const idx = active !== null && active < points.length ? active : points.length - 1
  const p: HistoryPoint | undefined = points[idx]

  const closes = points.map((pt) => pt.close).filter((c): c is number => c !== null)
  const lo = Math.min(...closes)
  const hi = Math.max(...closes)
  const pad = (hi - lo) * 0.08 || hi * 0.001 || 1
  const yScore = (v: number) => ((10 - v) / 20) * H_SCORE
  const yPrice = (v: number) => ((hi + pad - v) / (hi - lo + 2 * pad)) * H_PRICE
  const xAt = (i: number) => (points.length === 1 ? W / 2 : (i / (points.length - 1)) * W)
  const firstLive = points.find((pt) => !pt.replay)
  const replayed = points.filter((pt) => pt.replay).length
  const digits = hi >= 20 ? 2 : 4

  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const i = Math.round(((e.clientX - box.left) / box.width) * (points.length - 1))
    setActive(Math.max(0, Math.min(points.length - 1, i)))
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setActive(Math.max(0, idx - 1))
    else if (e.key === 'ArrowRight') setActive(Math.min(points.length - 1, idx + 1))
    else return
    e.preventDefault()
  }

  return (
    <section aria-labelledby="history-title" className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="history-title" className="text-h3">
            Bias history
          </h2>
          <p className="mt-1 text-small text-muted">Weekly snapshots, taken each Saturday after the positioning report.</p>
        </div>
        <div className="w-full sm:w-72">
          <Segmented<Range>
            label="Range"
            value={range}
            onChange={(r) => {
              setRange(r)
              setActive(null)
            }}
            options={[
              { value: '12', label: '12 weeks' },
              { value: '52', label: '1 year' },
              { value: 'all', label: 'All' },
            ]}
          />
        </div>
      </div>

      {q.isLoading ? (
        <div className="h-72 animate-pulse rounded-md bg-surface motion-reduce:animate-none" aria-busy="true" />
      ) : points.length < 2 ? (
        <p className="text-small text-muted">Not enough weekly snapshots yet to draw a history.</p>
      ) : (
        <div
          className="rounded-md border border-border bg-surface p-3 focus-visible:outline-2 focus-visible:outline-focus"
          tabIndex={0}
          onKeyDown={onKey}
          role="group"
          aria-label={`Bias history for ${symbol}. Use the left and right arrow keys to move between weeks.`}
        >
          <p className="mb-2 flex flex-wrap items-baseline gap-x-3 font-mono text-small" aria-live="polite">
            <span className="text-muted">{p && formatDate(p.as_of)}</span>
            <span className="font-semibold">{p && formatScore(p.score)}</span>
            <span className="font-sans text-muted">{p && LABEL_TEXT[p.label]}</span>
            <span className="text-muted">{p?.close != null ? `Close ${p.close.toFixed(digits)}` : ''}</span>
            {p?.replay && <span className="font-sans text-caption text-subtle">replayed</span>}
          </p>
          <svg
            viewBox={`0 0 ${W} ${H_SCORE}`}
            preserveAspectRatio="none"
            className="h-40 w-full touch-none"
            onPointerMove={pick}
            onPointerDown={pick}
            onPointerLeave={() => setActive(null)}
            aria-hidden="true"
          >
            {BANDS.map((b) => (
              <rect key={b.label} x={0} width={W} y={yScore(b.to)} height={yScore(b.from) - yScore(b.to)} className={BAND_FILL[b.label]} />
            ))}
            <line x1={0} x2={W} y1={yScore(0)} y2={yScore(0)} className="stroke-text" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            {firstLive && points.indexOf(firstLive) > 0 && (
              <line
                x1={xAt(points.indexOf(firstLive))}
                x2={xAt(points.indexOf(firstLive))}
                y1={0}
                y2={H_SCORE}
                className="stroke-subtle"
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
            )}
            <path d={linePath(points.map((pt) => pt.score), yScore)} className="fill-none stroke-text" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            <line x1={xAt(idx)} x2={xAt(idx)} y1={0} y2={H_SCORE} className="stroke-accent" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="mt-1 flex justify-between font-mono text-caption text-subtle" aria-hidden="true">
            <span>Bias score · top +10 Very Bullish, bottom −10 Very Bearish</span>
          </div>
          <svg
            viewBox={`0 0 ${W} ${H_PRICE}`}
            preserveAspectRatio="none"
            className="mt-3 h-28 w-full touch-none"
            onPointerMove={pick}
            onPointerDown={pick}
            onPointerLeave={() => setActive(null)}
            aria-hidden="true"
          >
            <path d={linePath(points.map((pt) => pt.close), yPrice)} className="fill-none stroke-neutral-data" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            <line x1={xAt(idx)} x2={xAt(idx)} y1={0} y2={H_PRICE} className="stroke-accent" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="mt-1 flex justify-between font-mono text-caption text-subtle" aria-hidden="true">
            <span>{formatDate(points[0].as_of)}</span>
            <span>Weekly close</span>
            <span>{formatDate(points[points.length - 1].as_of)}</span>
          </div>
        </div>
      )}
      {replayed > 0 && (
        <p className="text-caption text-subtle">
          {replayed === points.length
            ? 'These weeks are a replay: today’s rules applied to the data that was out at the time.'
            : `Weeks left of the dashed line are a replay: today’s rules applied to the data that was out at the time. Live snapshots start ${formatDate(firstLive?.as_of)}.`}
        </p>
      )}
    </section>
  )
}
