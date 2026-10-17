import { ChevronDown } from 'lucide-react'
import { CURRENCY_FACTORS, useCurrencies, type CurrencyBlock, type FactorText } from './api'
import { ExplainPanel } from './Explain'
import { FactorName, FactorReading, FactorScoreTag } from './factor'
import { formatScore } from './format'
import { LabelChip, ScannerProblem, ScoreBar, Skeleton, TrustLine } from './parts'

/**
 * Currency strength board (docs/scanner §5): the eight currencies, strongest first.
 * Each opens to its six factor readings, so the score is never a black box.
 * A pair's score is driven by the gap between two rows here.
 */
export default function CurrenciesPage() {
  const q = useCurrencies()
  if (q.isError) return <ScannerProblem error={q.error} />
  const data = q.data
  return (
    <div>
      <p className="mb-6 max-w-[70ch] text-small text-muted">
        Each currency scores from −10 to +10 on six factors. A pair leans towards the stronger of its two currencies: the bigger the gap, the
        stronger the bias.
      </p>
      {!data ? (
        <Skeleton rows={8} />
      ) : (
        <ul className="grid gap-2">
          {data.currencies.map((c) => (
            <CurrencyRow key={c.code} c={c} text={data.factor_text} />
          ))}
        </ul>
      )}
      <TrustLine meta={data} />
    </div>
  )
}

function CurrencyRow({ c, text }: { c: CurrencyBlock; text: FactorText }) {
  const stale = CURRENCY_FACTORS.filter((f) => c.factors[f]?.stale).length
  return (
    <li>
      <details className="group rounded-md border border-border bg-surface open:border-control">
        <summary className="grid cursor-pointer list-none grid-cols-[3.5rem_1fr_auto] items-center gap-x-3 gap-y-2 px-3 py-3 md:grid-cols-[3.5rem_12rem_1fr_4rem_8rem_1.5rem] md:gap-4 [&::-webkit-details-marker]:hidden">
          <span className="font-mono text-body font-semibold">{c.code}</span>
          <span className="min-w-0 truncate text-small text-muted">
            {c.name}
            <span className="hidden text-subtle lg:inline"> · {c.central_bank}</span>
          </span>
          <span className="justify-self-end md:hidden">
            <LabelChip label={c.label} />
          </span>
          <ScoreBar score={c.score} label={c.label} className="col-span-2 md:col-span-1" />
          <span className="text-right font-mono text-body font-medium">{formatScore(c.score)}</span>
          <span className="hidden md:block">
            <LabelChip label={c.label} />
          </span>
          <ChevronDown className="hidden size-5 text-muted transition-transform group-open:rotate-180 md:block" strokeWidth={1.75} aria-hidden="true" />
        </summary>
        <div className="border-t border-border px-3 pb-4 pt-3">
          <p className="mb-3 text-caption text-subtle">
            {c.factors_used} of 6 factors used{stale ? ` · ${stale} stale and left out` : ''}
            {c.score === null && ' · Too few fresh factors to score this week'}
          </p>
          <div className="mb-4">
            <ExplainPanel subject={c.code} label={`Explain the ${c.name} simply`} />
          </div>
          <ul className="grid gap-3 md:grid-cols-2">
            {CURRENCY_FACTORS.map((f) => (
              <li key={f} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 rounded-sm bg-bg p-3">
                <FactorName factor={f} text={text} subject={c.code} />
                <FactorScoreTag value={c.factors[f]} />
                <div className="col-span-2">
                  <FactorReading factor={f} value={c.factors[f]} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </li>
  )
}
