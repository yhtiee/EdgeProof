import { useState } from 'react'
import { formatMoney, formatPct } from '../../../lib/format'
import { positionSize } from './positionSize'
import { Slider } from './Slider'

/**
 * Level 1 position-size simulator (AC-2). Responds live as sliders move;
 * every value is also exposed as text and works with arrow keys (DESIGN.md §9).
 */
type Props = { initial?: { balance: number; riskPct: number; stopPips: number } }

export function PositionSizeSimulator({ initial = { balance: 1000, riskPct: 1, stopPips: 25 } }: Props) {
  const [balance, setBalance] = useState(initial.balance)
  const [riskPct, setRiskPct] = useState(initial.riskPct)
  const [stopPips, setStopPips] = useState(initial.stopPips)
  const result = positionSize({ balance, riskPct, stopPips })

  return (
    <div className="grid gap-6">
      <Slider label="Account balance" value={balance} min={100} max={10000} step={50} onChange={setBalance} display={formatMoney(balance, 'USD', { digits: 0 })} />
      <Slider label="Risk per trade" value={riskPct} min={0.25} max={5} step={0.25} onChange={setRiskPct} display={formatPct(riskPct, { digits: 2 })} />
      <Slider label="Stop distance" value={stopPips} min={5} max={100} step={1} onChange={setStopPips} display={`${stopPips} pips`} />

      <output className="grid gap-1 border-t border-border pt-4" aria-live="polite">
        <span className="text-small text-muted">Position size on EUR/USD</span>
        <span className="font-mono text-figure font-medium text-text">
          {result ? `${result.lots.toFixed(2)} lots` : '—'}
        </span>
        {result && (
          <span className="text-small text-muted">
            {result.lots === 0
              ? `The stop is too wide for a ${formatMoney(result.riskAmount)} risk. The smallest size, 0.01 lots, would risk ${formatMoney(stopPips * 0.1)}.`
              : `Risks ${formatMoney(result.actualRisk)} if the stop is hit (${formatPct(result.actualRiskPct, { digits: 2 })} of the account).`}
          </span>
        )}
      </output>
    </div>
  )
}
