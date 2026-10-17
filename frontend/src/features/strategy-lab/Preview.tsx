import { Link } from 'react-router'
import { describeCondition, describeCosts, describeEntry, describeExit, describeNoTrade, describeRisk, describeStop } from './describe'
import { SESSION_LABEL, TF_LABEL } from './labels'
import { isDirectional, mirror } from './mirror'
import type { CheckItem, StepKey, VersionDoc } from './types'

function Part({ step, title, children, items, stepHref, heading: H }: {
  step: StepKey
  title: string
  children: React.ReactNode
  items: CheckItem[]
  stepHref?: (step: StepKey) => string
  heading: 'h2' | 'h3'
}) {
  const n = items.filter((i) => i.fix === step && i.severity === 'fail').length
  return (
    <section className="border-t border-border pt-3">
      <div className="flex items-baseline justify-between gap-2">
        <H className="text-small font-semibold text-muted">{title}</H>
        {n > 0 &&
          (stepHref ? (
            <Link to={stepHref(step)} className="text-caption font-semibold text-danger underline underline-offset-2">
              {n} {n === 1 ? 'check' : 'checks'}
            </Link>
          ) : (
            <span className="text-caption font-semibold text-danger">
              {n} {n === 1 ? 'check' : 'checks'}
            </span>
          ))}
      </div>
      <div className="mt-1 grid gap-1 text-small">{children}</div>
    </section>
  )
}

/**
 * The rulebook as plain sentences (rulebook-builder.md §4.3 "Live preview"),
 * grouped by part, each part showing how many checks it fails. Also the
 * read-only view on the strategy page.
 */
export function Preview({
  name,
  doc,
  items,
  stepHref,
  heading = 'h2',
}: {
  name: string
  doc: VersionDoc
  items: CheckItem[]
  stepHref?: (step: StepKey) => string
  heading?: 'h2' | 'h3'
}) {
  const r = doc.rules
    const part = { items, stepHref, heading }
  const conds = r.setup.conditions
  return (
    <div className="grid gap-3" aria-label="Rulebook preview">
      <div>
        <p className="text-body font-semibold">{name || 'Untitled strategy'}</p>
        {r.idea && <p className="text-small text-muted">{r.idea}</p>}
      </div>
      <Part {...part} step="market" title="Market">
        <p>
          {r.market.instruments.join(', ') || 'No pairs yet'} · {r.market.timeframes.map((t) => TF_LABEL[t]).join(', ') || 'no charts yet'} ·{' '}
          {r.market.sessions.map((s) => SESSION_LABEL[s]).join(', ') || 'no sessions yet'}
        </p>
        <p className="text-muted">{r.direction === 'both' ? 'Buys and sells (sells mirror buys).' : r.direction === 'short' ? 'Sells only.' : 'Buys only.'}</p>
      </Part>
      <Part {...part} step="setup" title="Setup: all must be true">
        {conds.length ? (
          <ol className="grid list-decimal gap-1 pl-5">
            {conds.map((c) => (
              <li key={c.id}>{describeCondition(c)}</li>
            ))}
          </ol>
        ) : (
          <p className="text-muted">No conditions yet.</p>
        )}
        {r.direction === 'both' && conds.some(isDirectional) && (
          <details className="mt-1">
            <summary className="cursor-pointer text-caption font-semibold text-muted">Sells mirror this</summary>
            <ol className="mt-1 grid list-decimal gap-1 pl-5 text-muted">
              {conds.map((c) => (
                <li key={c.id}>{describeCondition(mirror(c))}</li>
              ))}
            </ol>
          </details>
        )}
      </Part>
      <Part {...part} step="entry" title="Entry">
        <p>{describeEntry(r)}</p>
      </Part>
      <Part {...part} step="stop" title="Stop">
        <p>{describeStop(r)}</p>
      </Part>
      <Part {...part} step="exit" title="Exit">
        {describeExit(r).map((s) => (
          <p key={s}>{s}</p>
        ))}
      </Part>
      <Part {...part} step="risk" title="Risk">
        {describeRisk(doc.risk_plan).map((s) => (
          <p key={s}>{s}</p>
        ))}
      </Part>
      <Part {...part} step="costs" title="Costs">
        {r.market.instruments.length ? r.market.instruments.map((p) => <p key={p}>{describeCosts(p, doc.cost_model[p])}</p>) : <p className="text-muted">No pairs yet.</p>}
      </Part>
      <Part {...part} step="no_trade" title="No-trade rules">
        {describeNoTrade(r).map((s) => (
          <p key={s}>{s}</p>
        ))}
      </Part>
      <Part {...part} step="examples" title="Examples">
        <p className="text-muted">One true and one false chart for each setup condition.</p>
      </Part>
    </div>
  )
}
