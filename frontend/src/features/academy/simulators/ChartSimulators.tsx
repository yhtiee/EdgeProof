import { useMemo, useState } from 'react'
import { useSession } from '../../../lib/session'
import { SESSIONS, localWindow, timezoneOptions } from '../../onboarding/constants'
import { SelectField } from '../../../components/ui'
import { MiniChart } from './MiniChart'
import { currencyExposure, priceSeries, sma, type Position } from './maths2'
import { Slider } from './Slider'
import { formatPct, MINUS } from '../../../lib/format'

/** Chart-based simulators: candles, moving averages, sessions, currency exposure. */

export function CandlestickSimulator() {
  const [open, setOpen] = useState(1.085)
  const [close, setClose] = useState(1.089)
  const [high, setHigh] = useState(1.091)
  const [low, setLow] = useState(1.083)
  const hi = Math.max(high, open, close)
  const lo = Math.min(low, open, close)
  const up = close >= open
  const min = 1.075
  const max = 1.095
  const y = (v: number) => 10 + (1 - (v - min) / (max - min)) * 200
  const fmt = (v: number) => v.toFixed(4)
  return (
    <div className="grid gap-6 sm:grid-cols-[120px_1fr] sm:items-start">
      <svg viewBox="0 0 120 220" className="mx-auto h-56 w-28" role="img" aria-label={`A ${up ? 'rising' : 'falling'} candle: open ${fmt(open)}, high ${fmt(hi)}, low ${fmt(lo)}, close ${fmt(close)}.`}>
        <line x1="60" x2="60" y1={y(hi)} y2={y(lo)} stroke="var(--text)" strokeWidth="2" />
        <rect x="40" width="40" y={y(Math.max(open, close))} height={Math.max(2, Math.abs(y(open) - y(close)))} rx="2" fill={up ? 'var(--gain)' : 'var(--loss)'} />
      </svg>
      <div className="grid gap-4">
        <Slider label="Open" value={open} min={min} max={max} step={0.0005} onChange={setOpen} display={fmt(open)} />
        <Slider label="Close" value={close} min={min} max={max} step={0.0005} onChange={setClose} display={fmt(close)} />
        <Slider label="High" value={high} min={min} max={max} step={0.0005} onChange={setHigh} display={fmt(hi)} />
        <Slider label="Low" value={low} min={min} max={max} step={0.0005} onChange={setLow} display={fmt(lo)} />
        <p className="text-small text-muted" aria-live="polite">
          {up ? 'Close above open: a rising candle.' : 'Close below open: a falling candle.'} Body {Math.round(Math.abs(close - open) * 10000)} pips, full range{' '}
          {Math.round((hi - lo) * 10000)} pips. The high and low can never sit inside the body.
        </p>
      </div>
    </div>
  )
}

export function MovingAverageSimulator() {
  const [period, setPeriod] = useState(20)
  const prices = useMemo(() => priceSeries(42, 160), [])
  const ma = useMemo(() => sma(prices, period), [prices, period])
  return (
    <div className="grid gap-6">
      <Slider label="Moving average length" value={period} min={3} max={60} step={1} onChange={setPeriod} display={`${period} candles`} />
      <MiniChart
        zero={false}
        series={[
          { values: prices, tone: 'muted', width: 1.25 },
          { values: ma, tone: 'accent', width: 2.25 },
        ]}
        summary={`Price in grey and a ${period}-candle moving average in dark. A longer average is smoother and turns later.`}
        yLabel="Grey: price. Dark: the moving average."
      />
      <p className="text-small text-muted">
        A longer average is smoother but turns later; a shorter one turns sooner but zig-zags more. No setting removes the delay: the average only
        knows the past.
      </p>
    </div>
  )
}

export function SessionClockSimulator() {
  const session = useSession()
  const ownTz = session.status === 'signed-in' ? session.me.timezone : Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const [tz, setTz] = useState(ownTz)
  // Captured once: the clock is a snapshot, not a live ticker (DESIGN.md §1 "calm, not casino").
  const [now] = useState(() => new Date())
  const toLocalHour = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number)
    const d = new Date(now)
    d.setUTCHours(h, m, 0, 0)
    const local = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: tz }).format(d)
    return Number(local)
  }
  const nowHour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: tz }).format(now))
  const bars = SESSIONS.map((s) => ({ ...s, start: toLocalHour(s.utcStart), end: toLocalHour(s.utcEnd) }))
  const seg = (start: number, end: number) => (end > start ? [[start, end]] : [[start, 24], [0, end]])
  return (
    <div className="grid gap-4">
      <SelectField
        label="Show session times for"
        value={tz}
        onChange={(e) => setTz(e.target.value)}
        options={timezoneOptions(tz)}
        helper="Session hours are approximate and shift with daylight saving."
      />
      <div className="relative grid gap-2" role="img" aria-label={bars.map((b) => `${b.label} ${localWindow(b.utcStart, b.utcEnd, tz)}`).join('; ')}>
        {bars.map((b) => (
          <div key={b.key} className="grid grid-cols-[5.5rem_1fr] items-center gap-3">
            <span className="text-small">{b.label}</span>
            <div className="relative h-6 rounded-sm bg-surface">
              {seg(b.start, b.end).map(([s, e], i) => (
                <div key={i} className="absolute inset-y-0 rounded-sm bg-neutral-data" style={{ left: `${(s / 24) * 100}%`, width: `${((e - s) / 24) * 100}%` }} />
              ))}
              <div className="absolute inset-y-[-4px] w-0.5 bg-accent" style={{ left: `${((nowHour + 0.5) / 24) * 100}%` }} />
            </div>
          </div>
        ))}
        <div className="grid grid-cols-[5.5rem_1fr] gap-3 font-mono text-caption text-subtle">
          <span />
          <span className="flex justify-between">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>24:00</span>
          </span>
        </div>
      </div>
      <ul className="grid gap-1 text-small">
        {bars.map((b) => (
          <li key={b.key} className="flex justify-between gap-4">
            <span>{b.label}</span>
            <span className="font-mono">{localWindow(b.utcStart, b.utcEnd, tz)}</span>
          </li>
        ))}
      </ul>
      <p className="text-caption text-subtle">The amber line marks the current hour. Where bars overlap, two big centres are trading at once.</p>
    </div>
  )
}

const PAIRS: Position[] = [
  { pair: 'EUR/USD', side: 'buy', riskPct: 1 },
  { pair: 'GBP/USD', side: 'buy', riskPct: 1 },
  { pair: 'AUD/USD', side: 'buy', riskPct: 1 },
  { pair: 'USD/JPY', side: 'sell', riskPct: 1 },
  { pair: 'EUR/GBP', side: 'buy', riskPct: 1 },
]

export function CurrencyExposureSimulator() {
  const [open, setOpen] = useState<boolean[]>([true, true, false, false, false])
  const [risk, setRisk] = useState(1)
  const positions = PAIRS.filter((_, i) => open[i]).map((p) => ({ ...p, riskPct: risk }))
  const exp = currencyExposure(positions)
  const rows = Object.entries(exp).filter(([, v]) => v !== 0).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
  return (
    <div className="grid gap-6">
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-small font-semibold">Open positions</legend>
        {PAIRS.map((p, i) => (
          <label key={p.pair} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border bg-surface px-3 text-small">
            <input type="checkbox" checked={open[i]} onChange={(e) => setOpen((o) => o.map((v, j) => (j === i ? e.target.checked : v)))} className="size-5 accent-[var(--text)]" />
            {p.side === 'buy' ? 'Buy' : 'Sell'} {p.pair}
          </label>
        ))}
      </fieldset>
      <Slider label="Risk on each position" value={risk} min={0.25} max={3} step={0.25} onChange={setRisk} display={formatPct(risk, { digits: 2 })} />
      <output className="grid gap-2 border-t border-border pt-4" aria-live="polite">
        <span className="text-small text-muted">Risk per currency</span>
        {rows.length ? (
          rows.map(([ccy, v]) => (
            <span key={ccy} className="flex justify-between gap-4 text-body">
              <span>
                {v > 0 ? 'Long' : 'Short'} {ccy}
              </span>
              <span className={`font-mono ${Math.abs(v) > 2 ? 'text-loss' : ''}`}>
                {v < 0 ? MINUS : ''}
                {formatPct(Math.abs(v), { digits: 2 })}
                {Math.abs(v) > 2 ? ' · above 2%' : ''}
              </span>
            </span>
          ))
        ) : (
          <span className="text-small text-subtle">No open positions.</span>
        )}
        <span className="text-caption text-subtle">Two trades on different pairs can be one bet on the same currency.</span>
      </output>
    </div>
  )
}
