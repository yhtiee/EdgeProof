import { useMemo, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { RangeBar } from '../../../components/ui'
import { formatMoney, formatPct, formatR } from '../../../lib/format'
import { MiniChart } from './MiniChart'
import { compound, equityCurves, expectancyRange, overfit, riskOfRuin } from './maths2'
import { Slider } from './Slider'

/** Level 2 and Level 6 simulators: randomness, sample size, ruin, compounding, overfitting. */

function Again({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-11 items-center gap-2 text-small font-semibold text-accent-text hover:underline">
      <RotateCcw className="size-4" strokeWidth={1.75} aria-hidden="true" />
      {label}
    </button>
  )
}

export function CoinFlipSimulator() {
  const [seed, setSeed] = useState(11)
  const [trades, setTrades] = useState(50)
  const [winRate, setWinRate] = useState(50)
  const curves = useMemo(() => equityCurves({ seed, curves: 5, trades, winRate: winRate / 100, winR: 1 }), [seed, trades, winRate])
  const ends = curves.map((c) => c[c.length - 1])
  const edge = (winRate / 100) * 1 - (1 - winRate / 100)
  return (
    <div className="grid gap-6">
      <Slider label="Chance of a win" value={winRate} min={40} max={60} step={1} onChange={setWinRate} display={formatPct(winRate, { digits: 0 })} />
      <Slider label="Trades" value={trades} min={10} max={500} step={10} onChange={setTrades} display={`${trades}`} />
      <MiniChart
        series={curves.map((c, i) => ({ values: c, tone: i === 0 ? 'accent' : 'neutral' }))}
        summary={`Five traders with the same rules over ${trades} trades. Final results: ${ends.map((e) => formatR(e, 0)).join(', ')}.`}
        yLabel="Five traders, identical rules, each line is one trader's running total in R. Dashed line: zero."
      />
      <p className="text-small text-muted" aria-live="polite">
        Every line uses the same rules, with a true expectancy of {formatR(edge)} per trade. The final results run from{' '}
        <span className="font-mono">{formatR(Math.min(...ends), 0)}</span> to <span className="font-mono">{formatR(Math.max(...ends), 0)}</span>: the difference is luck.
      </p>
      <Again onClick={() => setSeed((s) => s + 1)} label="Flip again" />
    </div>
  )
}

export function SampleSizeSimulator() {
  const [trades, setTrades] = useState(30)
  const [winRate, setWinRate] = useState(40)
  const [winR, setWinR] = useState(2)
  const r = expectancyRange({ winRate: winRate / 100, winR, trades })
  return (
    <div className="grid gap-6">
      <Slider label="Win rate" value={winRate} min={20} max={70} step={1} onChange={setWinRate} display={formatPct(winRate, { digits: 0 })} />
      <Slider label="Average win (losses are 1R)" value={winR} min={0.5} max={4} step={0.1} onChange={setWinR} display={formatR(winR, 1)} />
      <Slider label="Trades in your sample" value={trades} min={10} max={1000} step={10} onChange={setTrades} display={`${trades}`} />
      <div className="border-t border-border pt-4">
        <RangeBar label="Expectancy you might measure" estimate={r.mean} low={r.low} high={r.high} domain={[-1.5, 1.5]} />
        <p className="mt-2 text-small text-muted" aria-live="polite">
          The true expectancy is {formatR(r.mean)}. After {trades} trades, 90% of the time you&rsquo;d measure somewhere between{' '}
          <span className="font-mono">{formatR(r.low)}</span> and <span className="font-mono">{formatR(r.high)}</span>.
          {r.low < 0 && r.mean > 0 && ' The range still includes zero, so this sample can’t tell a real edge from luck.'}
        </p>
      </div>
    </div>
  )
}

export function RiskOfRuinSimulator() {
  const [risk, setRisk] = useState(2)
  const [winRate, setWinRate] = useState(45)
  const [winR, setWinR] = useState(1.5)
  const [depth, setDepth] = useState(30)
  const result = useMemo(
    () => riskOfRuin({ riskPct: risk, winRate: winRate / 100, winR, trades: 200, ruinPct: depth }),
    [risk, winRate, winR, depth],
  )
  const edge = (winRate / 100) * winR - (1 - winRate / 100)
  return (
    <div className="grid gap-6">
      <Slider label="Risk per trade" value={risk} min={0.25} max={10} step={0.25} onChange={setRisk} display={formatPct(risk, { digits: 2 })} />
      <Slider label="Win rate" value={winRate} min={25} max={70} step={1} onChange={setWinRate} display={formatPct(winRate, { digits: 0 })} />
      <Slider label="Average win (losses are 1R)" value={winR} min={0.5} max={4} step={0.1} onChange={setWinR} display={formatR(winR, 1)} />
      <Slider label="Drawdown you'd call ruin" value={depth} min={10} max={80} step={5} onChange={setDepth} display={formatPct(depth, { digits: 0 })} />
      <output className="grid gap-1 border-t border-border pt-4" aria-live="polite">
        <span className="text-small text-muted">Chance of a {formatPct(depth, { digits: 0 })} drawdown within 200 trades</span>
        <span className={`font-mono text-figure font-medium ${result.probability > 0.2 ? 'text-loss' : 'text-text'}`}>{formatPct(result.probability * 100, { digits: 1 })}</span>
        <span className="text-caption text-subtle">
          From 2,000 simulated runs. Expectancy {formatR(edge)} per trade{edge <= 0 ? ': with no edge, ruin is only a matter of time.' : '.'}
        </span>
      </output>
    </div>
  )
}

export function CompoundingSimulator() {
  const [monthly, setMonthly] = useState(10)
  const [years, setYears] = useState(3)
  const [start, setStart] = useState(1000)
  const c = compound({ monthlyPct: monthly, months: years * 12, start })
  return (
    <div className="grid gap-6">
      <Slider label="Claimed return per month" value={monthly} min={0.5} max={30} step={0.5} onChange={setMonthly} display={formatPct(monthly, { digits: 1 })} />
      <Slider label="Years" value={years} min={1} max={10} step={1} onChange={setYears} display={`${years}`} />
      <Slider label="Starting money" value={start} min={100} max={10000} step={100} onChange={setStart} display={formatMoney(start, 'USD', { digits: 0 })} />
      <output className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2" aria-live="polite">
        <span className="grid gap-1">
          <span className="text-small text-muted">That&rsquo;s per year</span>
          <span className="font-mono text-figure font-medium">+{formatPct(c.yearlyPct, { digits: 0 })}</span>
        </span>
        <span className="grid gap-1">
          <span className="text-small text-muted">After {years} {years === 1 ? 'year' : 'years'}</span>
          <span className="font-mono text-figure font-medium">{formatMoney(c.end, 'USD', { digits: 0 })}</span>
          <span className="text-caption text-subtle">{c.multiple >= 100 ? 'If returns like this were repeatable, the person selling them wouldn’t need your money.' : `${c.multiple.toFixed(1)} times the start.`}</span>
        </span>
      </output>
    </div>
  )
}

export function OverfittingSimulator() {
  const [tries, setTries] = useState(1)
  const [seed, setSeed] = useState(5)
  const trades = 50
  const r = useMemo(() => overfit({ tries, trades, seed }), [tries, seed])
  return (
    <div className="grid gap-6">
      <p className="text-small text-muted">Every strategy here has no edge at all: each trade is a coin flip for +1R or −1R.</p>
      <Slider label="Strategy variations tried on the same data" value={tries} min={1} max={500} step={1} onChange={setTries} display={`${tries}`} />
      <output className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2" aria-live="polite">
        <span className="grid gap-1">
          <span className="text-small text-muted">Best backtest ({trades} trades)</span>
          <span className={`font-mono text-figure font-medium ${r.bestInSample > 0 ? 'text-gain' : 'text-text'}`}>{formatR(r.bestInSample)}</span>
          <span className="text-caption text-subtle">The more you try, the better the best one looks.</span>
        </span>
        <span className="grid gap-1">
          <span className="text-small text-muted">Same strategy on new data</span>
          <span className="font-mono text-figure font-medium">{formatR(r.outOfSample)}</span>
          <span className="text-caption text-subtle">Back to luck, because there was never an edge.</span>
        </span>
      </output>
      <Again onClick={() => setSeed((s) => s + 1)} label="Run again with new data" />
    </div>
  )
}
