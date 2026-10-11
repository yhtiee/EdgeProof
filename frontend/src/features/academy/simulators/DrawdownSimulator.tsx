import { useState } from 'react'
import { MINUS, formatPct } from '../../../lib/format'
import { drawdown } from './maths'
import { Slider } from './Slider'

/** Level 2 drawdown simulator (AC-2): compounding losses and the gain needed to recover. */
export function DrawdownSimulator() {
  const [riskPct, setRisk] = useState(2)
  const [losses, setLosses] = useState(10)
  const d = drawdown({ riskPct, losses })

  return (
    <div className="grid gap-6">
      <Slider label="Risk per trade" value={riskPct} min={0.25} max={10} step={0.25} onChange={setRisk} display={formatPct(riskPct, { digits: 2 })} />
      <Slider label="Losses in a row" value={losses} min={1} max={25} step={1} onChange={setLosses} display={`${losses}`} />

      <output className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2" aria-live="polite">
        <span className="grid gap-1">
          <span className="text-small text-muted">Drawdown</span>
          <span className="font-mono text-figure font-medium text-loss">
            {MINUS}
            {formatPct(d.drawdownPct)}
          </span>
          <span className="text-caption text-subtle">Not {formatPct(d.simpleSumPct, { digits: 0 })}: each loss comes off a smaller balance.</span>
        </span>
        <span className="grid gap-1">
          <span className="text-small text-muted">Gain needed to recover</span>
          <span className="font-mono text-figure font-medium text-text">+{formatPct(d.recoveryPct)}</span>
          <span className="text-caption text-subtle">Just to get back to where you started.</span>
        </span>
      </output>
    </div>
  )
}
