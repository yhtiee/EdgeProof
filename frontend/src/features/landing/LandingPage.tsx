import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'
import { Logo } from '../../components/layout/Logo'
import { buttonClass } from '../../components/ui'
import { PositionSizeSimulator } from '../academy/simulators/PositionSizeSimulator'
import { VerdictSpecimen } from './VerdictSpecimen'

/**
 * Public landing page. Direction, content and the reasoning behind each
 * section live in design/DIRECTION.md; tokens come from DESIGN.md.
 */

const GATES = [
  {
    n: 1,
    name: 'Your plan',
    body: 'A 3-minute setup about your hours, sessions and trading history. Accepting the plan opens the Academy.',
  },
  {
    n: 2,
    name: 'The Academy',
    body: 'Seven levels, from pips and margin to strategy design. Pass each level exam at 80%, or skip a level with a 90% placement score.',
  },
  {
    n: 3,
    name: 'Your rulebook',
    body: 'Every setup rule is a structured condition with a valid and an invalid example. Words like “strong” or “looks like” don’t pass.',
  },
  {
    n: 4,
    name: 'Unseen data',
    body: 'At least 100 development and 50 validation trades, costs included. Expectancy of +0.10R or more, and a range whose lower bound stays above zero.',
  },
  {
    n: 5,
    name: 'Demo forward test',
    body: '50 or more trades over at least 8 weeks on demo, following your own rules on 90% of them.',
  },
]

const NEVER = [
  ['No trade calls and no copy trading.', 'You build and test your own strategy.'],
  ['No referral money from brokers or prop firms.', 'Nothing here is steered by commission.'],
  ['No handling of your money.', 'EdgeProof never holds funds.'],
  ['No promises about returns, and no personal financial advice.', 'It is an education tool.'],
]

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-bg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-raised focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      <header className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-2 md:px-6 lg:px-8">
        <Logo />
        <Link to="/sign-in" className="inline-flex min-h-11 items-center px-2 text-small font-semibold text-text hover:underline">
          Sign in
        </Link>
      </header>

      <main id="main">
        {/* 1. What is this? */}
        <section className="mx-auto grid max-w-[1200px] gap-8 px-4 pb-16 pt-6 md:px-6 md:pt-12 lg:grid-cols-[1fr_minmax(0,34rem)] lg:items-center lg:gap-16 lg:px-8 lg:pb-24 lg:pt-16">
          <div>
            <h1 className="max-w-[16ch] text-display md:text-display-lg">Test your forex strategy before it costs you money</h1>
            <p className="mt-4 max-w-[46ch] text-body text-muted">
              EdgeProof is a free course and testing lab. Learn the basics, write your own rules, then test them on market
              data you haven&rsquo;t seen. The verdict comes from code, and it always shows its uncertainty.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
              <Link to="/sign-up" className={`${buttonClass('primary')} md:min-h-11 md:text-body`}>
                Create free account
              </Link>
              <Link
                to="/try"
                className="inline-flex min-h-11 items-center text-small font-semibold text-accent-text underline underline-offset-4"
              >
                Try a lesson first, no account needed
              </Link>
            </div>
          </div>
          <VerdictSpecimen />
        </section>

        {/* 2. Why bother testing? */}
        <section aria-labelledby="odds" className="border-t border-border">
          <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-16 md:px-6 lg:grid-cols-[1fr_1fr] lg:gap-16 lg:px-8 lg:py-24">
            <h2 id="odds" className="max-w-[22ch] text-h2 md:text-h2-lg">
              Most retail traders lose money. Few of them ever tested their rules.
            </h2>
            <div className="grid gap-8">
              <dl className="grid gap-6 sm:grid-cols-2">
                <div>
                  <dt className="font-mono text-figure font-medium">74–89%</dt>
                  <dd className="mt-1 text-small text-muted">
                    of retail CFD accounts lose money, according to Europe&rsquo;s securities regulator,{' '}
                    <a className="text-accent-text underline underline-offset-2" href="https://www.esma.europa.eu/node/84933">
                      ESMA
                    </a>
                    .
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-figure font-medium">97%</dt>
                  <dd className="mt-1 text-small text-muted">
                    of Brazilian day traders who kept going for more than 300 days lost money, with no sign they learned by
                    trading (
                    <a className="text-accent-text underline underline-offset-2" href="https://ssrn.com/abstract=3423101">
                      Chague, De-Losso and Giovannetti
                    </a>
                    ).
                  </dd>
                </div>
              </dl>
              <p className="max-w-[52ch] text-body">
                EdgeProof has no secret to sell you. It gives you a process: learn, write rules, test them honestly, and
                only then risk money.
              </p>
            </div>
          </div>
        </section>

        {/* 3. How does it work? */}
        <section aria-labelledby="gates" className="border-t border-border bg-surface">
          <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-16 md:px-6 lg:grid-cols-[1fr_1.4fr] lg:gap-16 lg:px-8 lg:py-24">
            <div>
              <h2 id="gates" className="max-w-[18ch] text-h2 md:text-h2-lg">
                Five gates, each opened by your own data
              </h2>
              <p className="mt-3 max-w-[40ch] text-body text-muted">
                There are no shortcuts and nothing to buy. A gate opens when your results meet its criteria, checked by
                code.
              </p>
            </div>
            <ol className="relative">
              {GATES.map((g, i) => (
                <li key={g.n} className="relative grid grid-cols-[2rem_1fr] gap-4 pb-8 last:pb-0">
                  {i < GATES.length - 1 && (
                    <span className="absolute bottom-0 left-4 top-8 w-px -translate-x-1/2 bg-control" aria-hidden="true" />
                  )}
                  <span
                    className={`relative z-10 flex size-8 items-center justify-center rounded-full border font-mono text-small ${
                      i === 0 ? 'border-transparent bg-accent text-on-accent' : 'border-control bg-surface text-text'
                    }`}
                    aria-hidden="true"
                  >
                    {g.n}
                  </span>
                  <div className="pt-0.5">
                    <h3 className="text-h3">
                      <span className="sr-only">Gate {g.n}: </span>
                      {g.name}
                      {i === 0 && <span className="ml-2 text-small font-normal text-muted">· you start here</span>}
                    </h3>
                    <p className="mt-1 max-w-[56ch] text-small text-muted">{g.body}</p>
                  </div>
                </li>
              ))}
              <li className="grid grid-cols-[2rem_1fr] gap-4 pt-8">
                <span aria-hidden="true" />
                <p className="max-w-[56ch] border-t border-border pt-4 text-small text-muted">
                  After the gates: real money at 0.25% risk per trade for 30 trades, before any larger step.
                </p>
              </li>
            </ol>
          </div>
        </section>

        {/* 4. Can I try it? */}
        <section aria-labelledby="try" className="border-t border-border">
          <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-16 md:px-6 lg:grid-cols-[1fr_minmax(0,34rem)] lg:items-center lg:gap-16 lg:px-8 lg:py-24">
            <div>
              <h2 id="try" className="text-h2 md:text-h2-lg">
                Try the first simulator
              </h2>
              <p className="mt-3 max-w-[44ch] text-body text-muted">
                Position size comes from your stop, not from how sure you feel. Move the stop and watch the size change
                while the risk stays the same.
              </p>
              <Link
                to="/try/position-size"
                className="mt-4 inline-flex min-h-11 items-center gap-2 text-small font-semibold text-accent-text hover:underline"
              >
                Open the full lesson
                <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
              </Link>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4 sm:p-6">
              <PositionSizeSimulator />
            </div>
          </div>
        </section>

        {/* 5. What's the catch? */}
        <section aria-labelledby="never" className="border-t border-border">
          <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-16 md:px-6 lg:grid-cols-[1fr_1.4fr] lg:gap-16 lg:px-8 lg:py-24">
            <h2 id="never" className="text-h2 md:text-h2-lg">
              What EdgeProof will never do
            </h2>
            <div>
              <ul className="grid gap-4">
                {NEVER.map(([head, tail]) => (
                  <li key={head} className="border-b border-border pb-4 text-body">
                    <span className="font-semibold">{head}</span> <span className="text-muted">{tail}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 max-w-[56ch] text-small text-muted">
                <span className="font-semibold text-text">Ready first:</span> the Academy (Levels 1 and 2), the practice
                journal and the rulebook builder. Testing and verdicts follow in phase 2.
              </p>
            </div>
          </div>
        </section>

        {/* 6. Close */}
        <section aria-labelledby="start" className="border-t border-border bg-surface">
          <div className="mx-auto flex max-w-[1200px] flex-col items-start gap-6 px-4 py-16 md:flex-row md:items-center md:justify-between md:px-6 lg:px-8 lg:py-20">
            <h2 id="start" className="text-h2 md:text-h2-lg">
              Start with Level 1. It&rsquo;s free.
            </h2>
            <Link to="/sign-up" className={`${buttonClass('primary')} md:min-h-11 md:text-body`}>
              Create free account
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto grid max-w-[1200px] gap-4 px-4 py-10 text-small text-muted md:grid-cols-[1fr_auto] md:px-6 lg:px-8">
          <p className="max-w-[60ch]">
            Trading forex and CFDs carries a high risk of losing money. EdgeProof is an education tool. It doesn&rsquo;t
            give investment advice or trade calls.
          </p>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6">
            <Link to="/sign-in" className="inline-flex min-h-11 items-center hover:text-text">
              Sign in
            </Link>
            <Link to="/try" className="inline-flex min-h-11 items-center hover:text-text">
              Try a lesson
            </Link>
            <span className="inline-flex min-h-11 items-center">© 2026 EdgeProof</span>
          </nav>
        </div>
      </footer>
    </div>
  )
}
