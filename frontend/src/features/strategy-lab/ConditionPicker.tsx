import { useMemo, useState } from 'react'
import { ChevronRight, Search } from 'lucide-react'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { describeCondition } from './describe'
import type { ConditionType, Timeframe } from './types'
import { BLOCKS, GROUPS } from './vocabulary'

/**
 * Condition picker (rulebook-builder.md §4.3): search plus six groups, in a
 * bottom sheet on phones and a side sheet on wider screens. "Write my own"
 * sits last with its consequence spelled out.
 */
export function ConditionPicker({
  open,
  onOpenChange,
  onPick,
  timeframe,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (type: ConditionType) => void
  timeframe: Timeframe | null
}) {
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<string | null>(null)
  const query = q.trim().toLowerCase()
  const matches = useMemo(
    () => (query ? BLOCKS.filter((b) => `${b.name} ${b.keywords}`.toLowerCase().includes(query)) : []),
    [query],
  )
  const shown = query ? matches : group ? BLOCKS.filter((b) => b.group === group) : []

  const pick = (type: ConditionType) => {
    onPick(type)
    setQ('')
    setGroup(null)
    onOpenChange(false)
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) setGroup(null)
      }}
      title="Add condition"
      description="Something that must be true before a trade."
    >
      <label htmlFor="picker-search" className="mb-1 block text-small font-semibold">
        Search
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" strokeWidth={1.75} aria-hidden="true" />
        <input
          id="picker-search"
          type="search"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="trend, level, RSI, session…"
          className="block min-h-11 w-full rounded-sm border border-control bg-raised pl-9 pr-3 text-body"
        />
      </div>

      {!query && group && (
        <button type="button" onClick={() => setGroup(null)} className="mt-3 min-h-11 text-small font-semibold text-muted hover:text-text">
          ← All groups
        </button>
      )}

      {!query && !group ? (
        <ul className="mt-4 grid">
          {GROUPS.map((g) => (
            <li key={g.key}>
              <button
                type="button"
                onClick={() => (g.key === 'own' ? pick('free_text') : setGroup(g.key))}
                className="flex min-h-14 w-full items-center gap-3 border-t border-border px-1 py-2 text-left hover:bg-raised"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-semibold">{g.name}</span>
                  <span className="block text-small text-muted">{g.description}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-subtle" strokeWidth={1.75} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : shown.length ? (
        <ul className="mt-2 grid">
          {shown.map((b) => (
            <li key={b.type} className="flex items-center gap-3 border-t border-border py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-body font-semibold">{b.name}</span>
                <span className="block text-small text-muted">
                  {b.type === 'free_text'
                    ? 'Rules in your own words make the strategy discretionary unless they become a building block.'
                    : describeCondition({ id: 'x', type: b.type, timeframe, params: b.defaults })}
                </span>
              </span>
              <button
                type="button"
                onClick={() => pick(b.type)}
                className="min-h-11 shrink-0 rounded-md border border-control px-4 text-small font-semibold hover:bg-raised"
                aria-label={`Add ${b.name}`}
              >
                Add
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-small text-muted">
          Nothing called &lsquo;{q}&rsquo;. Try &lsquo;trend&rsquo;, &lsquo;level&rsquo;, &lsquo;RSI&rsquo; or{' '}
          <button type="button" className="font-semibold underline" onClick={() => pick('free_text')}>
            write your own
          </button>
          .
        </p>
      )}
    </BottomSheet>
  )
}
