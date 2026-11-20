import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Banner, Button, EmptyState, SelectField } from '../../components/ui'
import { Skeleton } from '../scanner/parts'
import { useHeadlines, type HeadlineFilters } from './api'
import { NewsFooter } from './parts'

/**
 * Official headlines (docs/news.md): decisions, minutes, speeches and reports from 8 central
 * banks, and data releases from the statistics agencies with a feed we can read. Primary
 * sources only, newest first, 30 at a time. Every headline opens the original.
 */
const CURRENCIES = ['EUR', 'GBP', 'AUD', 'NZD', 'USD', 'CAD', 'CHF', 'JPY']
const TOPICS = { rates: 'Interest rates', inflation: 'Inflation', growth: 'Growth', labour: 'Jobs', business: 'Business' }
const KINDS = { decision: 'Decisions', minutes: 'Minutes', speech: 'Speeches', report: 'Reports', data: 'Data releases', press: 'Press releases' }
const WHEN = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function HeadlinesPage() {
  const [filters, setFilters] = useState<HeadlineFilters>({ currency: '', topic: '', kind: '', publisher: '' })
  const q = useHeadlines(filters)
  const set = (k: keyof HeadlineFilters) => (e: React.ChangeEvent<HTMLSelectElement>) => setFilters({ ...filters, [k]: e.target.value })
  const first = q.data?.pages[0]
  const items = q.data?.pages.flatMap((p) => p.items) ?? []

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <SelectField
          label="From"
          value={filters.publisher}
          onChange={set('publisher')}
          options={[
            { value: '', label: 'Everyone' },
            { value: 'bank', label: 'Central banks' },
            { value: 'statistics', label: 'Statistics agencies' },
          ]}
        />
        <SelectField
          label="Currency"
          value={filters.currency}
          onChange={set('currency')}
          options={[{ value: '', label: 'All currencies' }, ...CURRENCIES.map((c) => ({ value: c, label: c }))]}
        />
        <SelectField
          label="Topic"
          value={filters.topic}
          onChange={set('topic')}
          options={[{ value: '', label: 'Any topic' }, ...Object.entries(TOPICS).map(([value, label]) => ({ value, label }))]}
        />
        <SelectField
          label="Type"
          value={filters.kind}
          onChange={set('kind')}
          options={[{ value: '', label: 'Any type' }, ...Object.entries(KINDS).map(([value, label]) => ({ value, label }))]}
        />
      </div>

      {q.isError ? (
        <Banner kind="danger" title="Couldn't load the headlines">
          {(q.error as Error).message}
        </Banner>
      ) : !q.data ? (
        <Skeleton rows={8} />
      ) : items.length === 0 ? (
        <EmptyState message="Nothing matches these filters yet. Headlines are fetched every morning." />
      ) : (
        <>
          <ol className="grid divide-y divide-border rounded-md border border-border bg-surface">
            {items.map((h) => (
              <li key={h.id} className="grid gap-1 px-3 py-3 md:px-4">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-subtle">
                  <span className="font-mono font-semibold text-muted">{h.currency}</span>
                  <span>{h.source}</span>
                  <span aria-hidden="true">·</span>
                  <time dateTime={h.published_at}>{WHEN.format(new Date(h.published_at))}</time>
                  <span className="rounded-full border border-control px-2 py-px font-semibold text-muted">{h.kind_text}</span>
                </p>
                <a href={h.url} target="_blank" rel="noopener noreferrer" className="text-body font-semibold text-text hover:underline">
                  {h.title}
                  <ExternalLink className="ml-1 inline size-3.5 text-subtle" strokeWidth={2} aria-hidden="true" />
                  <span className="sr-only"> (opens the {h.source} website)</span>
                </a>
                {h.summary && <p className="line-clamp-2 max-w-[75ch] text-small text-muted">{h.summary}</p>}
                {h.topics.length > 0 && (
                  <p className="flex flex-wrap gap-1">
                    {h.topics.map((t) => (
                      <span key={t} className="rounded-sm bg-raised px-1.5 py-px text-caption text-muted">
                        {TOPICS[t as keyof typeof TOPICS] ?? t}
                      </span>
                    ))}
                  </p>
                )}
              </li>
            ))}
          </ol>
          {q.hasNextPage && (
            <div className="mt-4">
              <Button variant="secondary" onClick={() => q.fetchNextPage()} loading={q.isFetchingNextPage} loadingLabel="Loading…">
                Show older headlines
              </Button>
            </div>
          )}
        </>
      )}

      <NewsFooter fetchedAt={first?.fetched_at} disclaimer={first?.disclaimer}>
        <p>
          Straight from each publisher&apos;s own feed. Central banks: Federal Reserve, ECB, Bank of England, Bank of Japan, RBNZ, Bank of Canada and
          SNB (the RBA blocks automated reading). Statistics agencies: US Bureau of Economic Analysis, UK Office for National Statistics and the
          ECB&apos;s statistics releases; the others don&apos;t offer a feed we can read.
        </p>
      </NewsFooter>
    </div>
  )
}
