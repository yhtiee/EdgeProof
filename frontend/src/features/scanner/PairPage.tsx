import { Link, useParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import {
  CURRENCY_FACTORS,
  EQUITY_SIGN,
  PAIR_FACTORS,
  isInstrument,
  usePair,
  type CurrencyFactor,
  type FactorValue,
  type InstrumentDetail,
  type PairDetail,
  type ScorecardDetail,
} from './api'
import { FactorName, FactorReading, FactorScoreTag } from './factor'
import { barGeometry, formatScore, instrumentName } from './format'
import { PairCalendar } from './Evidence'
import { ExplainPanel } from './Explain'
import { HistoryCharts } from './HistoryCharts'
import { LabelChip, ScannerProblem, ScoreBar, Skeleton, TrustLine, WowChange } from './parts'

/**
 * Scorecard (docs/scanner §5): the bias, a plain summary, then every factor with its
 * reading, date, source and how much it moved the score. FX pairs and gold show both
 * currencies side by side; indices, stocks and coins show their home economy read the
 * stock-market way, then their own positioning, trend and crowd (docs/scanner/markets.md).
 * Factor rows stack as cards on phones (no sideways scrolling at 360 px) and line up as a
 * table from 768 px.
 */
export default function PairPage() {
  const symbol = (useParams().symbol ?? '').toUpperCase()
  const q = usePair(symbol)

  return (
    <div>
      <Link to="/scanner" className="mb-4 inline-flex min-h-11 items-center gap-1 text-small font-semibold text-muted hover:text-text">
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden="true" />
        All markets
      </Link>
      {q.isError ? (
        <ScannerProblem error={q.error} />
      ) : !q.data ? (
        <Skeleton rows={6} />
      ) : isInstrument(q.data) ? (
        <InstrumentScorecard d={q.data} />
      ) : (
        <Scorecard d={q.data} />
      )}
      <TrustLine meta={q.data} />
    </div>
  )
}

const MARKET_NOUN = { index: 'Stock index', stock: 'Company share', crypto: 'Crypto coin' } as const

function Header({ d, title, mono, subtitle }: { d: ScorecardDetail; title: string; mono: boolean; subtitle?: string }) {
  return (
    <header className="grid gap-4">
      <div className="grid gap-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className={`text-h1 md:text-h1-lg ${mono ? 'font-mono' : ''}`}>{title}</h1>
          <LabelChip label={d.label} size="lg" />
        </div>
        {subtitle && <p className="text-small text-muted">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <p className="text-small text-muted">Bias score</p>
          <p className="font-mono text-figure font-medium">{formatScore(d.score)}</p>
        </div>
        <div>
          <p className="text-small text-muted">Week on week</p>
          <p className="mt-1">
            <WowChange change={d.change_wow} />
          </p>
        </div>
        {d.rank !== null && (
          <div>
            <p className="text-small text-muted">Rank</p>
            <p className="mt-1 font-mono text-small">
              {d.rank} of {d.rank_of}
            </p>
          </div>
        )}
        {d.agreement?.of ? (
          <div>
            <p className="text-small text-muted">Factors agreeing</p>
            <p className="mt-1 font-mono text-small">
              {d.agreement.agree} of {d.agreement.of}
            </p>
          </div>
        ) : null}
      </div>
      <div className="max-w-xl">
        <ScoreBar score={d.score} label={d.label} />
        <div className="mt-1 flex justify-between font-mono text-caption text-subtle" aria-hidden="true">
          <span>−10</span>
          <span>0</span>
          <span>+10</span>
        </div>
      </div>
      <p className="max-w-[70ch] text-body text-muted">{d.summary}</p>
      <div className="max-w-[70ch]">
        <ExplainPanel subject={d.symbol} label={`Explain ${title} simply`} />
      </div>
    </header>
  )
}

function Scorecard({ d }: { d: PairDetail }) {
  const pair = `${d.base.code}/${d.quote.code}`
  return (
    <div className="grid gap-10">
      <Header d={d} title={pair} mono />

      <section aria-labelledby="factors-title" className="grid gap-4">
        <div>
          <h2 id="factors-title" className="text-h3">
            Currency factors
          </h2>
          <p className="mt-1 max-w-[70ch] text-small text-muted">
            The {d.base.name} scores {formatScore(d.base.score)} and the {d.quote.name} {formatScore(d.quote.score)}. Each factor runs from −2 to +2;
            the last column is how much it moved this pair&apos;s score. Tap a factor name to see what it measures.
          </p>
        </div>
        <div className="hidden grid-cols-[13rem_1fr_1fr_7rem] gap-4 border-b border-border px-3 pb-2 text-caption text-subtle md:grid" aria-hidden="true">
          <span>Factor</span>
          <span>{d.base.code}</span>
          <span>{d.quote.code}</span>
          <span className="text-right">Effect on pair</span>
        </div>
        <ul className="grid gap-2 md:gap-0">
          {CURRENCY_FACTORS.map((f) => (
            <li
              key={f}
              className="grid gap-3 rounded-md border border-border bg-surface p-3 md:grid-cols-[13rem_1fr_1fr_7rem] md:gap-4 md:rounded-none md:border-x-0 md:border-t-0 md:bg-transparent md:py-4"
            >
              <FactorName factor={f} text={d.factor_text} subject={d.symbol} />
              <Side code={d.base.code} factor={f} d={d} which="base" />
              <Side code={d.quote.code} factor={f} d={d} which="quote" />
              <Contribution value={d.contributions[f]} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="pair-factors-title" className="grid gap-4">
        <div>
          <h2 id="pair-factors-title" className="text-h3">
            Price and crowd
          </h2>
          <p className="mt-1 max-w-[70ch] text-small text-muted">Two light checks on the pair itself. Together they count for 30% of the score.</p>
        </div>
        <OwnFactors d={d} factors={PAIR_FACTORS} />
      </section>

      <section aria-labelledby="calendar-title" className="grid gap-3">
        <div>
          <h2 id="calendar-title" className="text-h3">
            Coming up
          </h2>
          <p className="mt-1 max-w-[70ch] text-small text-muted">
            Scheduled releases and central bank speeches for {d.base.code} and {d.quote.code}. New figures can change the factors above.
          </p>
        </div>
        <PairCalendar symbol={d.symbol} />
      </section>

      <HistoryCharts symbol={d.symbol} />
    </div>
  )
}

const ECONOMY_FACTORS = CURRENCY_FACTORS.filter((f): f is Exclude<CurrencyFactor, 'cot'> => f !== 'cot')

function InstrumentScorecard({ d }: { d: InstrumentDetail }) {
  const name = instrumentName(d.symbol, d.name)
  const subtitle = [
    `${MARKET_NOUN[d.market]} · ${d.symbol}`,
    d.proxy ? `Prices from ${d.proxy}, a US-listed fund that tracks this index (in US dollars)` : '',
    d.market === 'crypto' ? 'Read as a US risk asset' : '',
  ]
    .filter(Boolean)
    .join(' · ')
  const own = [...(d.has_cot ? (['cot'] as const) : []), ...PAIR_FACTORS]
  return (
    <div className="grid gap-10">
      <Header d={d} title={name} mono={false} subtitle={subtitle} />

      <section aria-labelledby="economy-title" className="grid gap-4">
        <div>
          <h2 id="economy-title" className="text-h3">
            The {d.economy_name} economy, read the stock-market way
          </h2>
          <p className="mt-1 max-w-[70ch] text-small text-muted">
            It scores {formatScore(d.economy)} for {name}. Growth, jobs and business confidence count as they are. Inflation and interest rates count
            the other way round: they point to a tighter central bank, which makes borrowing dearer and cash more attractive, and that tends to weigh
            on stocks and coins. Each factor runs from −2 to +2; the last column is how much it moved the score.
          </p>
        </div>
        <div className="hidden grid-cols-[13rem_1fr_6rem_7rem] gap-4 border-b border-border px-3 pb-2 text-caption text-subtle md:grid" aria-hidden="true">
          <span>Factor</span>
          <span>{d.home} reading</span>
          <span>For {name.length > 12 ? 'this market' : name}</span>
          <span className="text-right">Effect on score</span>
        </div>
        <ul className="grid gap-2 md:gap-0">
          {ECONOMY_FACTORS.map((f) => {
            const value = d.home_block.factors[f]
            return (
              <li
                key={f}
                className="grid grid-cols-[1fr_auto] gap-3 rounded-md border border-border bg-surface p-3 md:grid-cols-[13rem_1fr_6rem_7rem] md:gap-4 md:rounded-none md:border-x-0 md:border-t-0 md:bg-transparent md:py-4"
              >
                <FactorName factor={f} text={d.factor_text} subject={d.symbol} />
                <span className="justify-self-end md:hidden">
                  <EquityTag value={value} />
                </span>
                <div className="col-span-2 grid grid-cols-[3rem_1fr_auto] items-start gap-2 md:col-span-1 md:grid-cols-[1fr_auto]">
                  <span className="font-mono text-caption text-subtle md:hidden">{d.home}</span>
                  <FactorReading factor={f} value={value} />
                  <FactorScoreTag value={value} />
                </div>
                <span className="hidden md:block">
                  <EquityTag value={value} />
                  {EQUITY_SIGN[f] < 0 && <span className="block text-caption text-subtle">flipped</span>}
                </span>
                <div className="col-span-2 md:col-span-1">
                  <Contribution value={d.contributions[f]} />
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="own-factors-title" className="grid gap-4">
        <div>
          <h2 id="own-factors-title" className="text-h3">
            {d.has_cot ? 'Positioning, price and crowd' : 'Price and crowd'}
          </h2>
          <p className="mt-1 max-w-[70ch] text-small text-muted">
            {d.has_cot
              ? 'Speculators’ positioning in its futures counts with the economy. Price trend and the retail crowd are light checks on the market itself.'
              : 'Light checks on the market itself. There is no futures contract for it in the CFTC report, so positioning isn’t scored.'}
            {d.market !== 'crypto' && ' No free retail sentiment feed covers indices or company shares.'}
          </p>
        </div>
        <OwnFactors d={d} factors={own} />
      </section>

      <section aria-labelledby="calendar-title" className="grid gap-3">
        <div>
          <h2 id="calendar-title" className="text-h3">
            Coming up
          </h2>
          <p className="mt-1 max-w-[70ch] text-small text-muted">
            Scheduled {d.home} releases and central bank speeches. New figures can change the economy factors above.
          </p>
        </div>
        <PairCalendar symbol={d.symbol} />
      </section>

      <HistoryCharts symbol={d.symbol} />
    </div>
  )
}

/** The instrument's own factors: positioning (instruments with a futures contract), trend and crowd. */
function OwnFactors({ d, factors }: { d: ScorecardDetail; factors: readonly ('cot' | 'trend' | 'retail')[] }) {
  return (
    <ul className="grid gap-2 md:gap-0">
      {factors.map((f) => {
        const value = (d.pair_factors as Partial<Record<string, FactorValue>>)[f]
        return (
          <li
            key={f}
            className="grid grid-cols-[1fr_auto] gap-3 rounded-md border border-border bg-surface p-3 md:grid-cols-[13rem_1fr_3rem_7rem] md:gap-4 md:rounded-none md:border-x-0 md:border-t-0 md:bg-transparent md:py-4"
          >
            <FactorName factor={f} text={d.factor_text} subject={d.symbol} />
            <span className="justify-self-end md:order-last md:hidden">
              <FactorScoreTag value={value} />
            </span>
            <div className="col-span-2 md:col-span-1">
              <FactorReading factor={f} value={value} />
            </div>
            <span className="hidden md:block">
              <FactorScoreTag value={value} />
            </span>
            <div className="col-span-2 md:col-span-1">
              <Contribution value={d.contributions[f]} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** The score an economy factor gives a stock market, in the same style as a factor score. */
function EquityTag({ value }: { value: (FactorValue & { equity_score: number | null }) | undefined }) {
  return <FactorScoreTag value={value ? { ...value, score: value.equity_score } : undefined} />
}

function Side({ code, factor, d, which }: { code: string; factor: CurrencyFactor; d: PairDetail; which: 'base' | 'quote' }) {
  const value = d[which].factors[factor]
  return (
    <div className="grid grid-cols-[3rem_1fr_auto] items-start gap-2 md:grid-cols-[1fr_auto]">
      <span className="font-mono text-caption text-subtle md:hidden">{code}</span>
      <FactorReading factor={factor} value={value} />
      <FactorScoreTag value={value} />
    </div>
  )
}

/** How much one factor moved the score, as a small diverging bar (±2 scale). */
function Contribution({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="text-right font-mono text-small text-subtle md:block">—</span>
  const g = barGeometry(value, 2)
  return (
    <div className="flex items-center gap-2 md:flex-col md:items-end md:gap-1">
      <span className="text-caption text-subtle md:hidden">Effect on score</span>
      <span className="ml-auto font-mono text-small font-semibold md:ml-0">{formatScore(value, 2)}</span>
      <div className="relative h-1.5 w-20 rounded-full bg-raised" aria-hidden="true">
        <div className={`absolute inset-y-0 rounded-full ${value >= 0 ? 'bg-gain' : 'bg-loss'}`} style={{ left: `${g.left}%`, width: `${g.width}%` }} />
        <div className="absolute -inset-y-0.5 left-1/2 w-px bg-text" />
      </div>
    </div>
  )
}
