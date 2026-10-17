import { useState } from 'react'
import { ExternalLink, FileText } from 'lucide-react'
import { Banner } from '../../components/ui'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { useCalendar, useFactorEvidence, type CalendarItem, type EvidenceSide, type Factor, type Publication } from './api'
import { FactorScoreTag } from './factor'
import { formatDate, formatPeriod, formatPrint } from './format'
import { ExplainPanel } from './Explain'
import { StaleBadge } from './parts'

/**
 * The evidence behind a factor (founder request, docs/scanner §7): the official
 * prints the score was built from, a link to the original release, what the
 * central bank has published on it, and the scheduled releases that could move
 * it next. Opens as a bottom sheet on phones and a side sheet on desktop.
 */
const pairName = (s: string) => (s.length === 6 ? `${s.slice(0, 3)}/${s.slice(3)}` : s)

export function EvidenceButton({ subject, factor, name }: { subject: string; factor: Factor; name: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 inline-flex min-h-8 items-center gap-1 text-caption font-semibold text-accent-text hover:underline"
        aria-label={`Evidence for ${name}, ${pairName(subject)}`}
      >
        <FileText className="size-3.5" strokeWidth={2} aria-hidden="true" />
        Evidence
      </button>
      <BottomSheet open={open} onOpenChange={setOpen} title={`${name} · ${pairName(subject)}`} description="The data, releases and news behind this score">
        {open && <EvidenceBody subject={subject} factor={factor} />}
      </BottomSheet>
    </>
  )
}

function EvidenceBody({ subject, factor }: { subject: string; factor: Factor }) {
  const q = useFactorEvidence(subject, factor, true)
  if (q.isError) return <Banner kind="danger" title="Couldn't load the evidence">{(q.error as Error).message}</Banner>
  const d = q.data
  if (!d) return <div className="h-64 animate-pulse rounded-md bg-surface motion-reduce:animate-none" aria-busy="true" />
  return (
    <div className="grid gap-8">
      <p className="text-small text-muted">{d.about}</p>
      <ExplainPanel subject={subject} factor={factor} label="Explain it simply" />
      {d.sides.map((side) => (
        <Side key={side.code} factor={factor} side={side} showCode={d.sides.length > 1 || subject.length === 3} />
      ))}
      {d.calendar && d.calendar.length > 0 && <Calendar events={d.calendar} link={d.calendar_link} />}
      <p className="text-caption font-semibold text-muted">{d.disclaimer}</p>
    </div>
  )
}

function Side({ factor, side, showCode }: { factor: Factor; side: EvidenceSide; showCode: boolean }) {
  const latest = side.observations[0]
  return (
    <section className="grid gap-3" aria-label={side.code}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-mono text-body font-semibold">{showCode ? side.code : 'Recent readings'}</h3>
        <span className="flex items-center gap-2">
          {side.current?.stale && <StaleBadge />}
          {side.current && <FactorScoreTag value={{ ...side.current, source: '' }} />}
        </span>
      </div>
      {side.observations.length === 0 ? (
        <p className="text-small text-muted">No official data stored yet.</p>
      ) : (
        <ol className="grid divide-y divide-border rounded-md border border-border">
          {side.observations.slice(0, factor === 'trend' ? 10 : 8).map((p, i) => {
            const f = formatPrint(factor, p)
            return (
              <li key={p.period} className="grid grid-cols-[1fr_auto] gap-x-3 px-3 py-2">
                <span className="text-small">
                  {factor === 'rates' ? `From ${formatDate(p.period)}` : formatPeriod(p.period, p.freq)}
                  {i === 0 && <span className="ml-2 text-caption font-semibold text-muted">Latest</span>}
                </span>
                <span className="text-right font-mono text-small font-semibold">{f.value}</span>
                <span className="text-caption text-subtle">
                  {factor === 'rates'
                    ? p.current_as_of
                      ? `Still in force on ${formatDate(p.current_as_of)}`
                      : ''
                    : factor === 'trend' || factor === 'retail'
                      ? ''
                      : `${p.estimated_release ? 'Out about' : 'Out'} ${formatDate(p.released)}`}
                </span>
                <span className="text-right text-caption text-subtle">{f.note}</span>
              </li>
            )
          })}
        </ol>
      )}
      {latest && factor === 'trend' && side.current?.detail && (
        <p className="text-caption text-subtle">
          Averages: 20-day {String(side.current.detail.sma20)}, 50-day {String(side.current.detail.sma50)}, 200-day {String(side.current.detail.sma200)}.
        </p>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption">
        {side.official && <ExternalA href={side.official.url}>{side.official.label}</ExternalA>}
        {side.data_source && <span className="text-subtle">Data: {side.data_source}</span>}
      </div>
      {side.news.length > 0 && <News items={side.news} />}
    </section>
  )
}

function News({ items }: { items: Publication[] }) {
  return (
    <div>
      <h4 className="mb-2 text-small font-semibold">From the central bank</h4>
      <ul className="grid gap-3">
        {items.map((n) => (
          <li key={n.url}>
            <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-small font-semibold text-text hover:underline">
              {n.title}
              <ExternalLink className="ml-1 inline size-3 text-subtle" strokeWidth={2} aria-hidden="true" />
              <span className="sr-only"> (opens the {n.source} website)</span>
            </a>
            <p className="text-caption text-subtle">
              {formatDate(n.published_at)} · {n.source}
            </p>
            {n.summary && <p className="mt-0.5 line-clamp-2 text-caption text-muted">{n.summary}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}

const TIME = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Splits releases at "now" on the client, so a cached response never shows a past release as coming up. */
export function splitByNow(events: CalendarItem[], now = Date.now()) {
  const upcoming = events.filter((e) => new Date(e.at).getTime() >= now)
  const out = events.filter((e) => new Date(e.at).getTime() < now).reverse()
  return { upcoming, out }
}

function EventList({ events }: { events: CalendarItem[] }) {
  return (
    <ul className="grid divide-y divide-border rounded-md border border-border">
      {events.map((e) => (
        <li key={`${e.currency}${e.title}${e.at}`} className="grid grid-cols-[1fr_auto] gap-x-3 px-3 py-2">
          <span className="text-small">
            <span className="font-mono font-semibold">{e.currency}</span> {e.title}
          </span>
          <span
            className={`h-fit rounded-full border px-2 text-caption font-semibold ${e.impact === 'High' ? 'border-warning/60 text-warning' : 'border-control text-muted'}`}
          >
            {e.impact}
          </span>
          <span className="text-caption text-subtle">{TIME.format(new Date(e.at))}</span>
          <span className="text-right font-mono text-caption text-subtle">
            {[e.forecast && `F ${e.forecast}`, e.previous && `P ${e.previous}`].filter(Boolean).join(' · ')}
          </span>
        </li>
      ))}
    </ul>
  )
}

const NOTHING_YET =
  'Nothing scheduled yet. Forex Factory publishes each new week’s calendar when its week starts on Sunday, and we fetch it every morning.'

function CalendarFooter({ link }: { link?: { label: string; url: string } }) {
  return link ? (
    <p className="mt-2 text-caption">
      <span className="text-subtle">Calendar: </span>
      <ExternalA href={link.url}>{link.label}</ExternalA>
      <span className="text-subtle"> · F forecast, P previous. Forecasts are other people&apos;s estimates; times are in your time zone.</span>
    </p>
  ) : null
}

/** Evidence sheet: what's still to come, then what already came out this week, never mixed. */
export function Calendar({ events, link }: { events: CalendarItem[]; link?: { label: string; url: string } }) {
  const { upcoming, out } = splitByNow(events)
  return (
    <section aria-label="Scheduled releases" className="grid gap-4">
      <div>
        <h3 className="mb-2 text-body font-semibold">Coming up</h3>
        {upcoming.length ? <EventList events={upcoming} /> : <p className="text-small text-muted">{NOTHING_YET}</p>}
      </div>
      {out.length > 0 && (
        <div>
          <h3 className="mb-2 text-body font-semibold">Already out this week</h3>
          <EventList events={out} />
        </div>
      )}
      <CalendarFooter link={link} />
    </section>
  )
}

/** "Coming up" on the scorecard: only releases still to come for both currencies, next ten days. */
export function PairCalendar({ symbol }: { symbol: string }) {
  const q = useCalendar(symbol)
  if (!q.data) return null
  const { upcoming } = splitByNow(q.data.events)
  return (
    <div>
      {upcoming.length ? <EventList events={upcoming} /> : <p className="text-small text-muted">{NOTHING_YET}</p>}
      <CalendarFooter link={q.data.link} />
    </div>
  )
}

function ExternalA({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-accent-text hover:underline">
      {children}
      <ExternalLink className="size-3" strokeWidth={2} aria-hidden="true" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}
