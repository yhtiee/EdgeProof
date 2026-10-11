import { useMemo, useState } from 'react'
import { MINUS, formatMoney, formatPct, formatR } from '../../../lib/format'
import { gapLoss, leverageMargin, pipMoney, swapTotal, tradingCost } from './maths2'
import { Slider } from './Slider'

/** Level 1 simulators: leverage and margin, pip value, trading cost, swap, gaps. */

function Out({ children }: { children: React.ReactNode }) {
  return (
    <output className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2" aria-live="polite">
      {children}
    </output>
  )
}

function Figure({ label, value, note, tone = 'text-text' }: { label: string; value: string; note?: string; tone?: string }) {
  return (
    <span className="grid gap-1">
      <span className="text-small text-muted">{label}</span>
      <span className={`font-mono text-figure font-medium ${tone}`}>{value}</span>
      {note && <span className="text-caption text-subtle">{note}</span>}
    </span>
  )
}

export function LeverageSimulator() {
  const [balance, setBalance] = useState(1000)
  const [leverage, setLeverage] = useState(30)
  const [lots, setLots] = useState(0.3)
  const positionValue = lots * 100_000
  const m = leverageMargin({ balance, leverage, positionValue })
  return (
    <div className="grid gap-6">
      <Slider label="Account balance" value={balance} min={100} max={10000} step={100} onChange={setBalance} display={formatMoney(balance, 'USD', { digits: 0 })} />
      <Slider label="Leverage offered" value={leverage} min={1} max={500} step={1} onChange={setLeverage} display={`${leverage}:1`} />
      <Slider label="Trade size (EUR/USD, at about 1.00)" value={lots} min={0.01} max={2} step={0.01} onChange={setLots} display={`${lots.toFixed(2)} lots`} />
      <Out>
        <Figure label="Margin set aside" value={formatMoney(m.margin, 'USD', { digits: 0 })} note={m.canOpen ? `${formatPct(m.marginPctOfBalance, { digits: 0 })} of the balance` : 'More than the balance: the broker would refuse this trade.'} tone={m.canOpen ? 'text-text' : 'text-loss'} />
        <Figure label="Position compared with the balance" value={`${m.effectiveLeverage.toFixed(1)}×`} note={`A ${formatPct(m.wipeMovePct, { digits: 2 })} move against you loses the whole balance.`} tone={m.effectiveLeverage > 10 ? 'text-loss' : 'text-text'} />
      </Out>
      <p className="text-small text-muted">
        Notice that changing the leverage offered changes only the margin. What decides how fast you can lose is the size of the trade compared with your money.
      </p>
    </div>
  )
}

export function PipValueSimulator() {
  const [lots, setLots] = useState(0.1)
  const [pips, setPips] = useState(20)
  const p = pipMoney({ lots, pips })
  return (
    <div className="grid gap-6">
      <Slider label="Trade size" value={lots} min={0.01} max={2} step={0.01} onChange={setLots} display={`${lots.toFixed(2)} lots`} />
      <Slider label="Price move" value={pips} min={-100} max={100} step={1} onChange={setPips} display={`${pips > 0 ? '+' : pips < 0 ? MINUS : ''}${Math.abs(pips)} pips`} />
      <Out>
        <Figure label="Each pip is worth" value={formatMoney(p.perPip)} note={`${p.units.toLocaleString('en-US')} units of the base currency`} />
        <Figure label="Profit or loss" value={formatMoney(p.money, 'USD', { signed: true })} tone={p.money > 0 ? 'text-gain' : p.money < 0 ? 'text-loss' : 'text-text'} note="On EUR/USD, in a US dollar account." />
      </Out>
    </div>
  )
}

export function TradingCostSimulator() {
  const [spread, setSpread] = useState(1)
  const [commission, setCommission] = useState(0)
  const [slip, setSlip] = useState(0.3)
  const [stop, setStop] = useState(20)
  const c = tradingCost({ spreadPips: spread, commissionPerLot: commission, slippagePips: slip, stopPips: stop })
  const heavy = c.costInR > 0.2
  return (
    <div className="grid gap-6">
      <Slider label="Spread" value={spread} min={0} max={5} step={0.1} onChange={setSpread} display={`${spread.toFixed(1)} pips`} />
      <Slider label="Commission per lot, round trip" value={commission} min={0} max={14} step={0.5} onChange={setCommission} display={formatMoney(commission)} />
      <Slider label="Slippage" value={slip} min={0} max={3} step={0.1} onChange={setSlip} display={`${slip.toFixed(1)} pips`} />
      <Slider label="Stop distance" value={stop} min={5} max={100} step={1} onChange={setStop} display={`${stop} pips`} />
      <Out>
        <Figure label="Cost of one round trip" value={`${c.costPips.toFixed(1)} pips`} note={`${formatMoney(c.costPerLot)} per standard lot`} />
        <Figure label="Cost as a share of your risk" value={formatR(-c.costInR)} note={heavy ? 'Above 0.2R: costs eat a big part of every trade.' : 'Paid on every trade, win or lose.'} tone={heavy ? 'text-loss' : 'text-text'} />
      </Out>
    </div>
  )
}

export function SwapSimulator() {
  const [rate, setRate] = useState(-6)
  const [lots, setLots] = useState(1)
  const [nights, setNights] = useState(5)
  const [wed, setWed] = useState(true)
  const s = swapTotal({ perLotPerNight: rate, lots, nights, wednesdays: wed ? 1 : 0 })
  return (
    <div className="grid gap-6">
      <Slider label="Swap per lot per night" value={rate} min={-15} max={15} step={0.5} onChange={setRate} display={formatMoney(rate, 'USD', { signed: true })} />
      <Slider label="Trade size" value={lots} min={0.1} max={3} step={0.1} onChange={setLots} display={`${lots.toFixed(1)} lots`} />
      <Slider label="Nights held" value={nights} min={1} max={30} step={1} onChange={setNights} display={`${nights}`} />
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-small">
        <input type="checkbox" checked={wed} onChange={(e) => setWed(e.target.checked)} className="size-5 accent-[var(--text)]" />
        The trade is open over a Wednesday rollover
      </label>
      <Out>
        <Figure label="Nights charged" value={`${s.chargedNights}`} note={wed ? 'Wednesday counts three times: it covers the weekend.' : 'One charge per night held.'} />
        <Figure label="Total swap" value={formatMoney(s.total, 'USD', { signed: true })} tone={s.total < 0 ? 'text-loss' : s.total > 0 ? 'text-gain' : 'text-text'} note="A minus is a cost; a plus is a credit." />
      </Out>
    </div>
  )
}

export function GapSimulator() {
  const [stop, setStop] = useState(20)
  const [gap, setGap] = useState(30)
  const g = useMemo(() => gapLoss({ stopPips: stop, gapBeyondPips: gap }), [stop, gap])
  return (
    <div className="grid gap-6">
      <Slider label="Your stop distance" value={stop} min={5} max={80} step={1} onChange={setStop} display={`${stop} pips`} />
      <Slider label="How far past your stop the market opens" value={gap} min={0} max={200} step={1} onChange={setGap} display={`${gap} pips`} />
      <Out>
        <Figure label="Where the stop actually fills" value={`${g.filledPipsAway} pips`} note="A stop becomes a market order at the first available price." />
        <Figure label="Loss" value={formatR(-g.lossR, 1)} tone="text-loss" note={`You planned ${formatR(-1, 1)}. The gap made it ${(g.lossR).toFixed(1)} times bigger.`} />
      </Out>
    </div>
  )
}
