import { useState } from 'react'
import { CircleCheck, CircleAlert } from 'lucide-react'
import { Banner, Segmented } from '../../components/ui'
import { useEvidence, useStatus, type Evidence } from './api'
import { LABEL_ORDER, formatDate } from './format'
import { LabelChip, ScannerProblem, Skeleton, TrustLine } from './parts'

/**
 * Evidence (spec "Validating the scoring", analyst notes in docs/scanner §3): how each
 * label did over the following 1, 4 and 12 weeks across every weekly snapshot,
 * shown as it is, good or bad. It's how a learner checks a tool instead of trusting it.
 */
type Horizon = '1' | '4' | '12'
const pct = (x: number | null, digits = 0) => (x === null ? '—' : `${(x * 100).toFixed(digits)}%`)
const signedPct = (x: number | null) => (x === null ? '—' : `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(2)}%`)

const SOURCE_NAME: Record<string, string> = {
  cftc: 'CFTC (positioning)',
  bis: 'BIS (policy rates)',
  oecd: 'OECD (macro data)',
  eurostat: 'Eurostat (euro area)',
  fred: 'FRED (euro area prices)',
  snb: 'Swiss National Bank (Swiss prices)',
  dbnomics: 'DBnomics (Japan prices)',
  twelvedata: 'Twelve Data (prices)',
  myfxbook: 'Myfxbook (retail sentiment)',
  news: 'Central bank publications',
  calendar: 'Forex Factory (release calendar)',
}

export default function EvidencePage() {
  const ev = useEvidence()
  const [h, setH] = useState<Horizon>('4')
  if (ev.isError) return <ScannerProblem error={ev.error} />
  return (
    <div className="grid gap-10">
      {!ev.data ? <Skeleton rows={5} /> : <Report ev={ev.data} h={h} setH={setH} />}
      <Sources />
      <TrustLine meta={ev.data ? { as_of: ev.data.last ?? '', updated_at: null, disclaimer: ev.data.disclaimer } : undefined} />
    </div>
  )
}

function Report({ ev, h, setH }: { ev: Evidence; h: Horizon; setH: (h: Horizon) => void }) {
  const table = ev.horizons[h]
  const sv = table.strong_vs_neutral
  return (
    <section className="grid gap-6" aria-labelledby="ev-title">
      <div>
        <h2 id="ev-title" className="text-h3">
          How the labels have held up
        </h2>
        <p className="mt-2 max-w-[70ch] text-small text-muted">
          The scanner&apos;s rules, run on every Saturday from {formatDate(ev.first)} to {formatDate(ev.last)} ({ev.snapshots} weekly snapshots).
          For each label we checked whether the pair then moved the way the score leaned.
        </p>
      </div>

      <div className="max-w-sm">
        <Segmented<Horizon>
          label="Looking ahead"
          value={h}
          onChange={setH}
          options={[
            { value: '1', label: '1 week' },
            { value: '4', label: '4 weeks' },
            { value: '12', label: '12 weeks' },
          ]}
        />
      </div>

      {sv.strong_hit_rate !== null && (
        <Banner kind={sv.passes ? 'info' : 'warning'} title={sv.passes ? 'Strong labels beat neutral ones' : 'Strong labels did not beat neutral ones'}>
          Over {h} week{h === '1' ? '' : 's'}, Very Bullish and Very Bearish pairs moved the labelled way {pct(sv.strong_hit_rate)} of the time (
          {sv.strong_n} cases), against {pct(sv.neutral_hit_rate)} for Neutral pairs. Around 50% is a coin flip: fundamentals work slowly and
          unevenly, which is why this is a starting point for analysis, not a signal.
        </Banner>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] border-collapse text-left text-small">
          <thead>
            <tr className="border-b border-border text-caption text-subtle">
              <th scope="col" className="py-2 pr-4 font-normal">
                Label
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-normal">
                Cases
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-normal">
                Moved the labelled way
              </th>
              <th scope="col" className="py-2 text-right font-normal">
                Average move that way
              </th>
            </tr>
          </thead>
          <tbody>
            {LABEL_ORDER.map((l) => {
              const r = table[l]
              return (
                <tr key={l} className="border-b border-border">
                  <th scope="row" className="py-3 pr-4 font-normal">
                    <LabelChip label={l} />
                  </th>
                  <td className="py-3 pr-4 text-right font-mono">{r.n.toLocaleString('en-GB')}</td>
                  <td className="py-3 pr-4 text-right font-mono">{pct(r.hit_rate, 1)}</td>
                  <td className={`py-3 text-right font-mono ${r.avg_return_pct === null ? '' : r.avg_return_pct > 0 ? 'text-gain' : 'text-loss'}`}>
                    {signedPct(r.avg_return_pct)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="max-w-[70ch] text-small text-muted">
        <h3 className="mb-2 text-body font-semibold text-text">Read this with care</h3>
        <ul className="grid list-disc gap-1 pl-5">
          <li>Past weeks are a replay: today&apos;s rules applied to the data that was out at the time, by estimated release dates.</li>
          <li>Economic figures are today&apos;s revised values, not the first releases, so the past looks a little cleaner than it was.</li>
          <li>Retail sentiment has no free history, so replayed weeks score without it.</li>
          <li>The 28 pairs share 8 currencies, so the cases overlap and are not independent. Small counts swing a lot.</li>
          <li>Neutral pairs still lean slightly one way; &quot;labelled way&quot; means the direction of the score.</li>
        </ul>
      </div>
    </section>
  )
}

function Sources() {
  const s = useStatus()
  if (!s.data) return null
  return (
    <section aria-labelledby="src-title">
      <h2 id="src-title" className="text-h3">
        Data sources
      </h2>
      <p className="mt-2 max-w-[70ch] text-small text-muted">
        Every score comes from public data. A source that misses its update is flagged here, and the factors it feeds are marked stale and left out
        of scores.
      </p>
      <ul className="mt-4 grid gap-2 md:grid-cols-2">
        {s.data.sources.map((src) => (
          <li key={src.name} className="flex items-start gap-3 rounded-md border border-border bg-surface px-3 py-3">
            {src.ok ? (
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-gain" strokeWidth={2} aria-hidden="true" />
            ) : (
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" strokeWidth={2} aria-hidden="true" />
            )}
            <div className="min-w-0">
              <p className="text-small font-semibold">
                {SOURCE_NAME[src.name] ?? src.name}
                <span className="sr-only">{src.ok ? ': up to date' : ': overdue'}</span>
              </p>
              <p className="text-caption text-subtle [overflow-wrap:anywhere]">
                {src.last_success_at ? `Last fetched ${formatDate(src.last_success_at)}` : 'Not fetched yet'}
                {!src.ok && src.last_error && ` · ${src.last_error.slice(0, 90)}`}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {s.data.stale.length > 0 && (
        <p className="mt-3 text-caption text-subtle">
          Stale this week: {s.data.stale.map((x) => x.replace(':', ' ')).join(', ')}.
        </p>
      )}
    </section>
  )
}
