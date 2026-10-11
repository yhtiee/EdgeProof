import { createContext, useContext } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { ExternalLink, Quote } from 'lucide-react'
import type { Source } from '../content'

/**
 * Citations (content/sources.json). Every source is a curated registry
 * entry with a checked link; lessons can't cite anything outside it.
 */
export const LessonSourcesContext = createContext<Record<string, Source>>({})

const surname = (author: string) => {
  const first = author.split(/,| and /)[0].trim()
  // Organisations keep their short form: "European Securities and Markets Authority (ESMA)" -> "ESMA".
  const abbr = first.match(/\(([^)]+)\)$/)
  if (abbr) return abbr[1]
  return first.split(' ').at(-1) ?? first
}

export function shortCitation(s: Source) {
  const many = /,| and /.test(s.author)
  return `${surname(s.author)}${many ? ' et al.' : ''}${s.year ? `, ${s.year}` : ''}`
}

export function fullReference(s: Source) {
  return `${s.author}${s.year ? ` (${s.year})` : ''}. ${s.title}.`
}

/** Inline "(Douglas, 2000)" that opens the full reference. */
export function Citation({ id }: { id: string }) {
  const source = useContext(LessonSourcesContext)[id]
  if (!source) return null
  return (
    <Popover.Root>
      <Popover.Trigger
        className="rounded-sm text-small text-muted underline decoration-dotted underline-offset-4 hover:text-text"
        aria-label={`Source: ${fullReference(source)}`}
      >
        ({shortCitation(source)})
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          sideOffset={6}
          collisionPadding={16}
          className="z-50 max-w-80 rounded-md border border-border bg-raised p-4 text-small shadow-pop"
        >
          <SourceDetail source={source} />
          <Popover.Arrow className="fill-[var(--raised)]" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function SourceDetail({ source }: { source: Source }) {
  return (
    <>
      <p className="font-semibold">{source.title}</p>
      <p className="text-muted">
        {source.author}
        {source.year ? `, ${source.year}` : ''}
      </p>
      <a
        href={source.url}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-2 inline-flex min-h-11 items-center gap-1 font-semibold text-accent-text underline underline-offset-2"
      >
        {source.kind === 'book' ? (source.access === 'free' ? 'Find a free copy' : 'Find this book') : 'Open source'}
        <ExternalLink className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
      </a>
    </>
  )
}

/** A short, attributed quote (40 words at most, added by a person). */
export function QuoteBlock({ text, source: id, page }: { text: string; source: string; page?: string }) {
  const source = useContext(LessonSourcesContext)[id]
  return (
    <figure className="measure border-l-2 border-control pl-4">
      <Quote className="size-5 text-subtle" strokeWidth={1.75} aria-hidden="true" />
      <blockquote className="mt-2 text-h3 font-normal">{text}</blockquote>
      {source && (
        <figcaption className="mt-2 text-small text-muted">
          {source.author}, <cite className="not-italic font-semibold">{source.title}</cite>
          {source.year ? ` (${source.year})` : ''}
          {page ? `, p. ${page}` : ''}
        </figcaption>
      )}
    </figure>
  )
}

/** "Sources" list for the lesson completion screen. */
export function SourceList({ sources }: { sources: Source[] }) {
  if (!sources.length) return null
  return (
    <section aria-labelledby="lesson-sources">
      <h2 id="lesson-sources" className="text-small font-semibold text-muted">
        Sources
      </h2>
      <ul className="mt-2 grid gap-2">
        {sources.map((s) => (
          <li key={s.id} className="text-small">
            <a href={s.url} target="_blank" rel="noreferrer noopener" className="group inline-flex items-start gap-2 hover:text-text">
              <span>
                {s.author}
                {s.year ? ` (${s.year})` : ''}. <span className="font-semibold group-hover:underline">{s.title}</span>.
                <span className="text-subtle"> {s.access === 'free' ? 'Free' : 'Paid, optional'}.</span>
              </span>
              <ExternalLink className="mt-1 size-3.5 shrink-0 text-subtle" strokeWidth={1.75} aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
