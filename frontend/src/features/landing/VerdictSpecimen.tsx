import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, RotateCcw, X } from 'lucide-react'
import { RangeBar } from '../../components/ui'
import { formatR } from '../../lib/format'
import { RESAMPLES, computeExampleVerdict } from './exampleVerdict'

/**
 * The hero's example verdict panel and the page's signature moment
 * (design/DIRECTION.md): 10,000 resamples of the example trades stack into a
 * histogram, then the range bar settles over the zero line.
 */
const DOMAIN: [number, number] = [-0.6, 0.5]
const BIN = 0.025
const BINS = Math.round((DOMAIN[1] - DOMAIN[0]) / BIN)
const PER_DOT = 50
const DURATION_MS = 1600
const VB_W = BINS * 10
const DOT_STEP = 5.4
const MAX_DOTS = 22
const VB_H = MAX_DOTS * DOT_STEP + 4

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

export function VerdictSpecimen() {
  const v = useMemo(() => computeExampleVerdict(), [])
  const binOf = useMemo(
    () =>
      Uint16Array.from(v.resampled, (m) => Math.min(BINS - 1, Math.max(0, Math.floor((m - DOMAIN[0]) / BIN)))),
    [v],
  )
  const finalCounts = useMemo(() => {
    const c = new Array<number>(BINS).fill(0)
    binOf.forEach((b) => c[b]++)
    return c
  }, [binOf])

  const [counts, setCounts] = useState<number[]>(() => (prefersReducedMotion() ? finalCounts : new Array(BINS).fill(0)))
  const [settled, setSettled] = useState(() => prefersReducedMotion())
  const frame = useRef<number>(0)

  const play = useCallback(() => {
    cancelAnimationFrame(frame.current)
    if (prefersReducedMotion()) {
      setCounts(finalCounts)
      setSettled(true)
      return
    }
    setSettled(false)
    const running = new Array<number>(BINS).fill(0)
    let done = 0
    const start = performance.now()
    const tick = (now: number) => {
      const target = Math.round(easeOut(Math.min(1, (now - start) / DURATION_MS)) * RESAMPLES)
      for (; done < target; done++) running[binOf[done]]++
      setCounts([...running])
      if (done < RESAMPLES) frame.current = requestAnimationFrame(tick)
      else setSettled(true)
    }
    frame.current = requestAnimationFrame(tick)
  }, [binOf, finalCounts])

  useEffect(() => {
    play()
    return () => cancelAnimationFrame(frame.current)
  }, [play])

  const zeroX = ((0 - DOMAIN[0]) / (DOMAIN[1] - DOMAIN[0])) * VB_W
  const checks = [
    { name: 'Validation trades, at least 50', value: String(v.trades), met: v.trades >= 50 },
    { name: 'Expectancy, at least +0.10R', value: formatR(v.expectancy), met: v.expectancy >= 0.1 },
    { name: 'Profit factor, at least 1.25', value: v.profitFactor.toFixed(2), met: v.profitFactor >= 1.25 },
    { name: 'Range lower bound above zero', value: formatR(v.low), met: v.low > 0 },
  ]

  return (
    <section
      aria-labelledby="specimen-title"
      className="rounded-lg border border-border bg-surface p-4 sm:p-6"
    >
      <p className="text-caption text-subtle">Example verdict · London breakout, version 3 · validation run</p>
      <h2 id="specimen-title" className="mt-1 text-h2 md:text-h2-lg">
        No edge found yet
      </h2>
      <p className="mt-2 text-small text-muted">
        Validation expectancy was {formatR(v.expectancy)} across {v.trades} trades. That&rsquo;s a useful result: it saved
        real money.
      </p>

      <div className="mt-6 flex items-baseline justify-between gap-4">
        <span className="text-small text-muted">Expectancy</span>
        <span className="font-mono text-figure font-medium text-loss">{formatR(v.expectancy)}</span>
      </div>

      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="mt-3 block h-auto w-full"
        aria-hidden="true"
        focusable="false"
      >
        <line x1={zeroX} x2={zeroX} y1={0} y2={VB_H} stroke="var(--border)" strokeWidth="1.5" />
        {counts.map((c, b) => {
          const dots = Math.min(MAX_DOTS, Math.round(c / PER_DOT))
          return Array.from({ length: dots }, (_, i) => (
            <circle
              key={`${b}-${i}`}
              cx={b * 10 + 5}
              cy={VB_H - 3 - i * DOT_STEP}
              r={2.3}
              fill="var(--neutral-data)"
            />
          ))
        })}
      </svg>

      <div
        className="transition-opacity duration-[var(--motion-base)] ease-standard"
        style={{ opacity: settled ? 1 : 0.15 }}
      >
        <RangeBar label="Expectancy" estimate={v.expectancy} low={v.low} high={v.high} domain={DOMAIN} compact />
      </div>
      <p className="mt-2 text-caption text-subtle">
        Each dot is {PER_DOT} of {RESAMPLES.toLocaleString('en-US')} resamples of these {v.trades} trades. The bar
        shows the middle 90%.
      </p>

      <ul className="mt-4">
        {checks.map((c) => (
          <li key={c.name} className="flex items-center justify-between gap-4 border-t border-border py-2 text-small">
            <span>{c.name}</span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="font-mono">{c.value}</span>
              {c.met ? (
                <Check className="size-4 text-gain" strokeWidth={2} aria-hidden="true" />
              ) : (
                <X className="size-4 text-loss" strokeWidth={2} aria-hidden="true" />
              )}
              <span className="sr-only">{c.met ? 'met' : 'not met'}</span>
            </span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={play}
        className="mt-2 inline-flex min-h-11 items-center gap-2 text-small font-semibold text-accent-text hover:underline"
      >
        <RotateCcw className="size-4" strokeWidth={1.75} aria-hidden="true" />
        Replay the resampling
      </button>
    </section>
  )
}
