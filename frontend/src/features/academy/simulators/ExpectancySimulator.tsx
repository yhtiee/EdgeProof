import { useState } from 'react'
import { formatPct, formatR, tone } from '../../../lib/format'
import { expectancy } from './maths'
import { Slider } from './Slider'

const TONE = { gain: 'text-gain', loss: 'text-loss', neutral: 'text-text' }

/** Level 2 expectancy simulator (AC-2). */
export function ExpectancySimulator() {
  const [winRatePct, setWinRate] = useState(40)
  const [avgWinR, setAvgWin] = useState(2)
  const [avgLossR, setAvgLoss] = useState(1)
  const e = expectancy({ winRatePct, avgWinR, avgLossR })
  const sign = tone(Number(e.perTrade.toFixed(2)))

  return (
    <div className="grid gap-6">
      <Slider label="Win rate" value={winRatePct} min={5} max={95} step={1} onChange={setWinRate} display={formatPct(winRatePct, { digits: 0 })} />
      <Slider label="Average win" value={avgWinR} min={0.2} max={5} step={0.1} onChange={setAvgWin} display={formatR(avgWinR, 1)} />
      <Slider label="Average loss" value={avgLossR} min={0.2} max={2} step={0.1} onChange={(v) => setAvgLoss(v)} display={formatR(-avgLossR, 1)} />

      <output className="grid gap-1 border-t border-border pt-4" aria-live="polite">
        <span className="text-small text-muted">Expectancy per trade</span>
        <span className={`font-mono text-figure font-medium ${TONE[sign]}`}>{formatR(e.perTrade)}</span>
        <span className="text-small text-muted">
          Over 100 trades that&rsquo;s {formatR(e.per100, 0)}. With these win and loss sizes, the break-even win rate is{' '}
          {formatPct(e.breakevenWinRatePct, { digits: 0 })}.
        </span>
      </output>
    </div>
  )
}
