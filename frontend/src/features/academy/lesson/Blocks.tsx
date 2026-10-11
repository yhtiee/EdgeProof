import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Lightbulb } from 'lucide-react'
import { readDisplay } from '../../../lib/theme'
import { useGlossary, type Block, type Inline, type TextContent } from '../content'
import { SIMULATORS } from '../simulators'
import { Citation } from './Sources'

/**
 * Renderers for lesson blocks (AC-1). Content is data from our own compiled
 * JSON, rendered as React elements; there is no raw HTML anywhere.
 */

export function InlineText({ tokens }: { tokens: Inline[] }) {
  return (
    <>
      {tokens.map((tok, i) => {
        if (tok.t === 'strong') return <strong key={i} className="font-semibold">{tok.v}</strong>
        if (tok.t === 'link')
          return (
            <a key={i} href={tok.href} target="_blank" rel="noreferrer noopener" className="text-accent-text underline underline-offset-2">
              {tok.v}
            </a>
          )
        if (tok.t === 'term') return <GlossaryTerm key={i} term={tok.term} label={tok.v} />
        if (tok.t === 'cite') return <Citation key={i} id={tok.id} />
        return <span key={i}>{tok.v}</span>
      })}
    </>
  )
}

/** Glossary link (AC-1): the term opens its definition in place. */
function GlossaryTerm({ term, label }: { term: string; label: string }) {
  const glossary = useGlossary()
  const entry = glossary.data?.[term]
  return (
    <Popover.Root>
      <Popover.Trigger
        className="cursor-help rounded-sm text-text underline decoration-control decoration-dotted decoration-2 underline-offset-4 hover:decoration-text"
        aria-label={`${label}: show definition`}
      >
        {label}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          sideOffset={6}
          collisionPadding={16}
          className="z-50 max-w-72 rounded-md border border-border bg-raised p-4 text-small shadow-pop"
        >
          <p className="font-semibold">{entry?.term ?? label}</p>
          <p className="mt-1 text-muted">{entry?.definition ?? 'Definition loading…'}</p>
          <Popover.Arrow className="fill-[var(--raised)]" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function TextBlock({ content, size = 'body' }: { content: TextContent[]; size?: 'body' | 'lesson' }) {
  return (
    <div className={`measure grid gap-4 ${size === 'lesson' ? 'text-lesson' : 'text-body'}`}>
      {content.map((c, i) =>
        c.type === 'p' ? (
          <p key={i}>
            <InlineText tokens={c.inline} />
          </p>
        ) : (
          <ul key={i} className="grid list-disc gap-1 pl-6">
            {c.items.map((item, j) => (
              <li key={j}>
                <InlineText tokens={item} />
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  )
}

export function TakeawayBlock({ content }: { content: TextContent[] }) {
  return (
    <aside className="flex gap-3 rounded-md border border-border bg-surface p-4" aria-label="Key takeaway">
      <Lightbulb className="mt-0.5 size-5 shrink-0 text-accent-text" strokeWidth={1.75} aria-hidden="true" />
      <div>
        <p className="text-small font-semibold">Key takeaway</p>
        <div className="mt-1">
          <TextBlock content={content} />
        </div>
      </div>
    </aside>
  )
}

function DiagramBlock({ src, alt }: { src: string; alt: string }) {
  // Data-saver mode: images load only when asked (DESIGN.md §10).
  const [show, setShow] = useState(() => !readDisplay().dataSaver)
  if (!show) {
    return (
      <button
        type="button"
        onClick={() => setShow(true)}
        className="flex min-h-24 w-full items-center justify-center rounded-md border border-dashed border-control text-small text-muted"
      >
        Show diagram: {alt}
      </button>
    )
  }
  return <img src={src} alt={alt} loading="lazy" className="block h-auto w-full rounded-md border border-border bg-surface" />
}

export function InteractiveBlock({ block }: { block: Extract<Block, { type: 'simulator' | 'diagram' }> }) {
  if (block.type === 'diagram') return <DiagramBlock src={block.src} alt={block.alt} />
  const Simulator = SIMULATORS[block.kind]
  return (
    <div className="rounded-lg border border-border bg-surface p-4 md:p-6">
      {Simulator ? <Simulator /> : <p className="text-small text-muted">This simulator isn&rsquo;t available yet.</p>}
    </div>
  )
}
