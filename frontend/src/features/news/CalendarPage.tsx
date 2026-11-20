import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ArrowDown, ArrowUp, BookOpen, Equal } from 'lucide-react'
import { Banner, EmptyState, Segmented, SelectField } from '../../components/ui'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { Skeleton } from '../scanner/parts'
import { useCalendar, type CalendarEvent } from './api'
import {
  eventTime,
  filterEvents,
  groupByDay,
  localIso,
  nextUpId,
  readingText,
  surpriseText,
  weekRange,
  type ImpactFilter,
  type Week,
} from './format'
import { ExternalA, ImpactChip, NewsFooter } from './parts'

/**
 * Economic calendar (docs/news.md): every scheduled release for the 8 currencies, grouped by day
 * in the learner's time zone, with actual, forecast and previous. Tap an event for what it
 * measures, how the actual compared, the scanner factor it feeds and its official source.
 * Phones get one card per event; from 768 px the rows line up as a table.
 */
const COLUMNS = 'md:grid-cols-[4.5rem_3.5rem_6.5rem_1fr_5.5rem_5.5rem_5.5rem]'

export default function CalendarPage() {
  const [week, setWeek] = useState<Week>('this')
  const [impact, setImpact] = useState<ImpactFilter>('high_medium')
  const [currency, setCurrency] = useState('')
  const [open, setOpen] = useState<CalendarEvent | null>(null)
  const [now] = useState(() => Date.now()) // read once: rows don't flip between past and upcoming mid-render
  const range = useMemo(() => weekRange(week), [week])
  const q = useCalendar(localIso(range.from), localIso(range.to))

  const data = q.data
  const mine = data?.my_currencies ?? []
  const events = data ? filterEvents(data.events, { impact, currency, mine }) : []
  const groups = groupByDay(events, new Date(now))
  const upNext = week === 'this' ? nextUpId(events, now) : null

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <Segmented<Week>
          label="Week"
          value={week}
          onChange={setWeek}
          options={[
            { value: 'last', label: 'Last week' },
            { value: 'this', label: 'This week' },
            { value: 'next', label: 'Next week' },
          ]}
        />
        <SelectField
          label="Impact"
          value={impact}
          onChange={(e) => setImpact(e.target.value as ImpactFilter)}
          options={[
            { value: 'high', label: 'High only' },
            { value: 'high_medium', label: 'High and medium' },
            { value: 'all', label: 'All, with low and holidays' },
          ]}
        />
        <SelectField
          label="Currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          options={[
            { value: '', label: 'All currencies' },
            ...(mine.length ? [{ value: 'mine', label: `Pairs I trade (${mine.join(', ')})` }] : []),
            ...(data?.currencies ?? []).map((c) => ({ value: c, label: c })),
          ]}
        />
      </div>

      {q.isError ? (
        <Banner kind="danger" title="Couldn't load the calendar">
          {(q.error as Error).message}
        </Banner>
      ) : !data ? (
        <Skeleton rows={8} />
      ) : events.length === 0 ? (
        <EmptyState
          message={
            data.events.length === 0 && week === 'next'
              ? 'Next week’s calendar appears late in this week, when Forex Factory publishes it. We fetch it four times a day.'
              : 'Nothing matches these filters this week.'
          }
        />
      ) : (
        <>
          <div className={`mb-1 hidden gap-4 px-3 text-caption text-subtle md:grid ${COLUMNS}`} aria-hidden="true">
            <span>Time</span>
            <span>Currency</span>
            <span>Impact</span>
            <span>Event</span>
            <span className="text-right">Actual</span>
            <span className="text-right">Forecast</span>
            <span className="text-right">Previous</span>
          </div>
          <div className="grid gap-6">
            {groups.map((g) => (
              <section key={g.key} aria-labelledby={`day-${g.key}`}>
                <h2
                  id={`day-${g.key}`}
                  className="sticky top-14 z-10 -mx-1 mb-1 flex items-center gap-2 bg-bg px-1 py-2 text-small font-semibold text-text lg:top-16"
                >
                  {g.label}
                  {g.isToday && <span className="rounded-full bg-text px-2 py-px text-caption text-bg">Today</span>}
                </h2>
                <ol className="grid gap-1">
                  {g.events.map((e) => (
                    <li key={e.id}>
                      {e.id === upNext && (
                        <p className="mb-1 flex items-center gap-2 text-caption font-semibold text-accent-text">
                          <span className="h-px flex-1 bg-accent-text/40" aria-hidden="true" />
                          Up next
                          <span className="h-px flex-1 bg-accent-text/40" aria-hidden="true" />
                        </p>
                      )}
                      <EventRow e={e} now={now} onOpen={() => setOpen(e)} />
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </>
      )}

      {open && (
        <BottomSheet open onOpenChange={(o) => !o && setOpen(null)} title={open.title} description={`${open.currency} · ${eventWhen(open)}`}>
          <EventDetails e={open} now={now} link={data?.link} />
        </BottomSheet>
      )}

      <NewsFooter fetchedAt={data?.fetched_at} disclaimer={data?.disclaimer}>
        {data && (
          <p>
            Schedule, forecasts and previous figures from the <ExternalA href={data.link.url}>{data.link.label}</ExternalA>. Actual figures come from
            official sources where we fetch them (US releases on the day); others fill in from the next release, which can take a week to a month.
            Times are in your time zone.
          </p>
        )}
      </NewsFooter>
    </div>
  )
}

const WHEN = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const eventWhen = (e: CalendarEvent) => (e.impact === 'Holiday' ? `${new Date(e.at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}, all day` : WHEN.format(new Date(e.at)))

/** The actual, toned by what it usually means for the currency, with an arrow for how it compared (never colour alone). */
function Actual({ e, className = '' }: { e: CalendarEvent; className?: string }) {
  if (!e.actual) return <span className={`font-mono text-small text-subtle ${className}`}>—</span>
  const tone = e.effect === 'good' ? 'text-gain' : e.effect === 'bad' ? 'text-loss' : 'text-text'
  const Icon = e.surprise === 1 ? ArrowUp : e.surprise === -1 ? ArrowDown : e.surprise === 0 ? Equal : null
  return (
    <span className={`inline-flex items-center justify-end gap-0.5 font-mono text-small font-semibold ${tone} ${className}`}>
      {Icon && <Icon className="size-3.5" strokeWidth={2.25} aria-hidden="true" />}
      {e.actual}
      <span className="sr-only">
        {surpriseText(e) && `, ${surpriseText(e).toLowerCase()}`}
        {e.effect === 'good' ? `, usually supports ${e.currency}` : e.effect === 'bad' ? `, usually weighs on ${e.currency}` : ''}
      </span>
    </span>
  )
}

function EventRow({ e, now, onOpen }: { e: CalendarEvent; now: number; onOpen: () => void }) {
  const past = new Date(e.at).getTime() < now
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-md border border-border bg-surface px-3 py-3 text-left hover:border-control md:gap-4 md:py-2 ${COLUMNS} ${past ? 'md:bg-transparent' : ''}`}
    >
      {/* Phones: time · currency · impact on one line, then the event, then the figures. */}
      <span className="flex items-center gap-2 md:contents">
        <span className={`font-mono text-small ${past ? 'text-subtle' : 'text-text'}`}>{eventTime(e)}</span>
        <span className="font-mono text-small font-semibold">{e.currency}</span>
        <span className="md:block">
          <ImpactChip impact={e.impact} />
        </span>
      </span>
      <span className="col-span-2 row-start-2 min-w-0 text-small font-semibold text-text md:col-span-1 md:row-start-auto">{e.title}</span>
      <span className="col-span-2 row-start-3 flex flex-wrap gap-x-4 font-mono text-caption text-muted md:contents">
        <span className="md:text-right">
          <span className="md:hidden">Actual </span>
          <Actual e={e} />
        </span>
        <span className="md:text-right md:text-small">
          <span className="md:hidden">Forecast </span>
          {e.forecast || '—'}
        </span>
        <span className="md:text-right md:text-small">
          <span className="md:hidden">Previous </span>
          {e.previous || '—'}
        </span>
      </span>
    </button>
  )
}

function EventDetails({ e, now, link }: { e: CalendarEvent; now: number; link?: { label: string; url: string } }) {
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <ImpactChip impact={e.impact} />
        {surpriseText(e) && <span className="text-small font-semibold text-muted">{surpriseText(e)}</span>}
      </div>
      {e.impact !== 'Holiday' && (
        <dl className="grid grid-cols-3 gap-3 rounded-md border border-border p-3">
          <div>
            <dt className="text-caption text-subtle">Actual</dt>
            <dd className="mt-0.5">
              <Actual e={e} />
            </dd>
          </div>
          <div>
            <dt className="text-caption text-subtle">Forecast</dt>
            <dd className="mt-0.5 font-mono text-small">{e.forecast || '—'}</dd>
          </div>
          <div>
            <dt className="text-caption text-subtle">Previous</dt>
            <dd className="mt-0.5 font-mono text-small">{e.previous || '—'}</dd>
          </div>
          {e.actual_source && <p className="col-span-3 text-caption text-subtle">Actual: {e.actual_source}</p>}
        </dl>
      )}
      <p className="text-body">{readingText(e, now)}</p>
      {e.factor_name && (
        <section className="grid gap-1">
          <h3 className="text-small font-semibold">What this measures</h3>
          <p className="text-small text-muted">{e.factor_about}</p>
          <p className="text-small text-muted">
            It feeds the scanner&apos;s <span className="font-semibold text-text">{e.factor_name.toLowerCase()}</span> factor for {e.currency}.{' '}
            <Link to="/scanner/currencies" className="font-semibold text-accent-text hover:underline">
              See the currency board
            </Link>
          </p>
        </section>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-small">
        {e.official && <ExternalA href={e.official.url}>{e.official.label}</ExternalA>}
        {link && <ExternalA href={link.url}>{link.label}</ExternalA>}
        <Link to={`/learn/${e.lesson}`} className="inline-flex items-center gap-1 font-semibold text-accent-text hover:underline">
          <BookOpen className="size-3.5" strokeWidth={2} aria-hidden="true" />
          The lesson on this
        </Link>
      </div>
      <p className="text-caption font-semibold text-muted">Forecasts are other people&apos;s estimates. Educational information, not trading advice.</p>
    </div>
  )
}
