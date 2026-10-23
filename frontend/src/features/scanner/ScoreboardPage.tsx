import { useState } from 'react'
import { ChevronDown, ExternalLink } from 'lucide-react'
import { EmptyState, Segmented, SelectField } from '../../components/ui'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { useScoreboard, type BoardCell, type BoardColumn, type BoardRow, type BoardSide, type Scoreboard } from './api'
import { CELL_STATUS_TEXT, LABEL_ORDER, LABEL_TEXT, describeRelease, filterBoard, formatDate, formatInt, formatScore, instrumentName } from './format'
import { LabelChip, ScannerProblem, Skeleton, TrustLine } from './parts'

/**
 * The scoreboard (docs/scanner/scoreboard.md): 18 whole-number columns per pair and gold,
 * summed, most bullish first. Technical and sentiment columns are scored per pair; macro
 * columns per currency, base minus quote. Every cell opens the release or reading behind it.
 * Phones get one row per instrument that expands; wider screens get the full table.
 */
const CURRENCIES = ['EUR', 'GBP', 'AUD', 'NZD', 'USD', 'CAD', 'CHF', 'JPY', 'XAU']
type Group = 'all' | 'tech' | 'macro'

export default function ScoreboardPage() {
  const board = useScoreboard()
  const [label, setLabel] = useState('')
  const [currency, setCurrency] = useState('')
  const [group, setGroup] = useState<Group>('all')
  const [open, setOpen] = useState<{ row: BoardRow; column: BoardColumn } | null>(null)

  if (board.isError) return <ScannerProblem error={board.error} />
  const data = board.data
  const rows = data ? filterBoard(data.rows, { label, currency }) : []
  const columns = data ? (group === 'tech' ? data.groups.tech : group === 'macro' ? data.groups.macro : [...data.groups.tech, ...data.groups.macro]) : []

  return (
    <div>
      <p className="mb-6 max-w-prose text-small text-muted">
        Each column is a whole number and the score is their sum. Price, seasonality, positioning and the retail crowd are scored per pair.
        Each economic release is scored for each currency against its forecast (surveys against the month before), then base minus quote.
      </p>
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <SelectField
          label="Bias"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          options={[{ value: '', label: 'All labels' }, ...LABEL_ORDER.map((l) => ({ value: l, label: LABEL_TEXT[l] }))]}
        />
        <SelectField
          label="Currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          options={[{ value: '', label: 'All' }, ...CURRENCIES.map((c) => ({ value: c, label: c === 'XAU' ? 'Gold' : c }))]}
        />
        <Segmented<Group>
          label="Columns"
          value={group}
          onChange={setGroup}
          options={[
            { value: 'all', label: 'All' },
            { value: 'tech', label: 'Price & crowd' },
            { value: 'macro', label: 'Economy' },
          ]}
        />
      </div>

      {!data ? (
        <Skeleton rows={10} />
      ) : data.rows.length === 0 ? (
        <EmptyState message="The scoreboard appears after the next daily scoring run." />
      ) : rows.length === 0 ? (
        <EmptyState message="Nothing matches these filters today." />
      ) : (
        <>
          <BoardTable data={data} rows={rows} columns={columns} onCell={(row, column) => setOpen({ row, column })} />
          <ol className="grid gap-1 md:hidden">
            {rows.map((r) => (
              <MobileRow key={r.symbol} row={r} data={data} columns={columns} onCell={(column) => setOpen({ row: r, column })} />
            ))}
          </ol>
        </>
      )}

      {data && open && (
        <BottomSheet
          open
          onOpenChange={(o) => !o && setOpen(null)}
          title={`${data.columns[open.column].name} · ${instrumentName(open.row.symbol)}`}
          description={data.columns[open.column].about}
        >
          <CellDetails row={open.row} column={open.column} cell={open.row.columns[open.column]} data={data} />
        </BottomSheet>
      )}

      {data && (
        <p className="mt-6 text-caption text-subtle">
          Forecasts from the{' '}
          <a href={data.calendar_link.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-accent-text hover:underline">
            {data.calendar_link.label}
            <ExternalLink className="size-3" strokeWidth={2} aria-hidden="true" />
          </a>
          ; actual figures from official sources where we fetch them. The final bias on the Pairs tab blends this board's economic columns with the
          regime score.
        </p>
      )}
      <TrustLine meta={data} />
    </div>
  )
}

/** Cell colour by sign and size, always with the number (never colour alone). */
function tone(cell: BoardCell | undefined): string {
  if (!cell || cell.score === null) return 'border-dashed border-control text-subtle'
  if (cell.status === 'na') return 'border-transparent text-subtle'
  const s = cell.score
  if (s >= 2) return 'border-gain bg-gain text-bg'
  if (s > 0) return 'border-gain/40 bg-gain/12 text-gain'
  if (s <= -2) return 'border-loss bg-loss text-bg'
  if (s < 0) return 'border-loss/40 bg-loss/12 text-loss'
  return 'border-border text-muted'
}

function cellLabel(data: Scoreboard, row: BoardRow, column: BoardColumn) {
  const cell = row.columns[column]
  const value = cell?.score === null || cell === undefined ? CELL_STATUS_TEXT[cell?.status ?? 'missing'] : formatInt(cell.score)
  return `${data.columns[column].name}, ${instrumentName(row.symbol)}: ${value}`
}

function BoardTable({ data, rows, columns, onCell }: { data: Scoreboard; rows: BoardRow[]; columns: BoardColumn[]; onCell: (r: BoardRow, c: BoardColumn) => void }) {
  return (
    <div className="hidden overflow-x-auto rounded-md border border-border md:block">
      <table className="w-full border-collapse text-small">
        <caption className="sr-only">Scoreboard: every column for each pair and gold, most bullish first</caption>
        <thead>
          <tr className="border-b border-border text-caption text-subtle">
            <th scope="col" className="sticky left-0 z-10 bg-bg px-3 py-2 text-left font-semibold">Pair</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">Score</th>
            <th scope="col" className="px-2 py-2 text-left font-semibold">Bias</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold" title="Change in the score since the last daily run">Day</th>
            {columns.map((c) => (
              <th key={c} scope="col" className="px-0.5 py-2 text-center font-semibold" title={data.columns[c].name}>
                {data.columns[c].short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.symbol} className="border-b border-border last:border-0">
              <th scope="row" className="sticky left-0 z-10 bg-bg px-3 py-1.5 text-left">
                <span className="font-mono text-caption text-subtle">{r.rank ?? '—'}</span>{' '}
                <span className="font-mono font-semibold">{instrumentName(r.symbol)}</span>
              </th>
              <td className="px-2 py-1.5 text-right font-mono font-semibold">{formatInt(r.score)}</td>
              <td className="px-2 py-1.5">
                <LabelChip label={r.label} />
              </td>
              <td className="px-2 py-1.5 text-right font-mono text-caption text-muted">{r.change_1d === null ? '—' : formatInt(r.change_1d)}</td>
              {columns.map((c) => (
                <td key={c} className="px-0.5 py-1">
                  <button
                    type="button"
                    onClick={() => onCell(r, c)}
                    aria-label={cellLabel(data, r, c)}
                    className={`flex h-8 w-full min-w-9 items-center justify-center rounded-sm border font-mono text-caption font-semibold hover:outline-1 hover:outline-control ${tone(r.columns[c])}`}
                  >
                    {r.columns[c]?.status === 'na' ? '·' : formatInt(r.columns[c]?.score)}
                  </button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MobileRow({ row, data, columns, onCell }: { row: BoardRow; data: Scoreboard; columns: BoardColumn[]; onCell: (c: BoardColumn) => void }) {
  const [expanded, setExpanded] = useState(false)
  const id = `board-${row.symbol}`
  return (
    <li className="rounded-md border border-border bg-surface">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls={id}
        className="grid w-full grid-cols-[2rem_1fr_auto_auto] items-center gap-x-3 px-3 py-3 text-left"
      >
        <span className="font-mono text-small text-subtle">{row.rank ?? '—'}</span>
        <span className="font-mono text-body font-semibold">{instrumentName(row.symbol)}</span>
        <span className="flex items-center gap-2">
          <span className="font-mono text-body font-semibold">{formatInt(row.score)}</span>
          <LabelChip label={row.label} />
        </span>
        <ChevronDown className={`size-4 text-muted transition-transform motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`} strokeWidth={2} aria-hidden="true" />
        <span className="col-span-4 mt-1 font-mono text-caption text-muted">
          {row.change_1d === null ? 'New today' : `${formatInt(row.change_1d)} since yesterday`} · Final bias {formatScore(row.final_score)}
        </span>
      </button>
      {expanded && (
        <ul id={id} className="grid grid-cols-3 gap-1 border-t border-border p-2">
          {columns.map((c) => (
            <li key={c}>
              <button
                type="button"
                onClick={() => onCell(c)}
                aria-label={cellLabel(data, row, c)}
                className={`flex min-h-11 w-full items-center justify-between gap-1 rounded-sm border px-2 text-caption ${tone(row.columns[c])}`}
              >
                <span className="truncate font-semibold">{data.columns[c].short}</span>
                <span className="font-mono font-semibold">{row.columns[c]?.status === 'na' ? '·' : formatInt(row.columns[c]?.score)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function CellDetails({ row, column, cell, data }: { row: BoardRow; column: BoardColumn; cell: BoardCell | undefined; data: Scoreboard }) {
  if (!cell) return <p className="text-small text-muted">{CELL_STATUS_TEXT.missing}</p>
  const macro = data.groups.macro.includes(column)
  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between gap-3">
        <span className="text-small text-muted">Column score</span>
        <span className={`inline-flex min-w-10 justify-center rounded-sm border px-2 py-1 font-mono text-body font-semibold ${tone(cell)}`}>{formatInt(cell.score)}</span>
      </div>
      {cell.score === null && <p className="text-small text-muted">{CELL_STATUS_TEXT[cell.status]}.</p>}
      {macro && cell.sides ? (
        <>
          <Side code={row.base} side={cell.sides.base} />
          <Side code={row.quote} side={cell.sides.quote} />
          {row.base !== 'XAU' && <p className="text-caption text-subtle">The column is {row.base}'s score minus {row.quote}'s.</p>}
          {row.base === 'XAU' && <p className="text-caption text-subtle">Gold has no economy of its own: this column is the US side reversed.</p>}
        </>
      ) : (
        <TechDetail detail={cell.detail ?? {}} />
      )}
      <p className="text-caption font-semibold text-muted">{data.disclaimer}</p>
    </div>
  )
}

function Side({ code, side }: { code: string; side: BoardSide }) {
  if (code === 'XAU') return null
  const d = side?.detail
  return (
    <section className="grid gap-1 rounded-md border border-border p-3" aria-label={code}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-mono text-body font-semibold">{code}</h3>
        <span className="font-mono text-small font-semibold">{side ? formatInt(side.score) : '0'}</span>
      </div>
      {!side ? (
        <p className="text-small text-muted">No data for this currency in this column, so it counts as 0.</p>
      ) : side.score === null ? (
        <p className="text-small text-muted">{(d?.reason as string | undefined) ?? CELL_STATUS_TEXT[side.status]}</p>
      ) : (
        <>
          <p className="text-small">
            {d?.title ?? (d?.basis as string | undefined) ?? 'Latest reading'}
            {d?.at && <span className="text-muted"> · {formatDate(d.at)}</span>}
          </p>
          <p className="font-mono text-small">{d?.basis && d.actual === undefined ? basisText(d) : describeRelease(d)}</p>
          {d?.actual_source && <p className="text-caption text-subtle">Actual: {d.actual_source}</p>}
        </>
      )}
    </section>
  )
}

function basisText(d: Record<string, unknown>): string {
  if (d.basis === 'house view') return `House view: ${d.direction === 1 ? 'a raise' : d.direction === -1 ? 'a cut' : 'a hold'} expected${d.note ? `. ${d.note}` : ''}`
  if (d.basis === 'next decision forecast') return `Next decision: ${d.forecast}% forecast against ${d.previous ?? d.rate}% now`
  if (d.spread !== undefined) return `3-month market rate ${d.market_3m}% against the ${d.rate}% policy rate`
  return String(d.basis ?? '')
}

function TechDetail({ detail: d }: { detail: Record<string, unknown> }) {
  const lines: string[] = []
  if (d.sma_fast !== undefined) lines.push(`3-day average ${d.sma_fast} against the 14-day ${d.sma_slow}; the 14-day is ${d.slow_rising ? 'rising' : 'not rising'}.`)
  if (d.avg_pct !== undefined) lines.push(`Average move this month over ${d.years} years: ${formatScore(d.avg_pct as number, 2)}%.`)
  if (d.long_pct !== undefined) lines.push(`${d.long_pct}% of retail traders are long, read contrarian.`)
  if (d.long_share !== undefined) lines.push(`Speculators' long share ${d.previous}% → ${d.long_share}% (week to ${formatDate(d.as_of as string)}).`)
  const base = d.base as Record<string, unknown> | undefined
  const quote = d.quote as Record<string, unknown> | undefined
  if (base?.long_share !== undefined && quote?.long_share !== undefined) {
    lines.push(`Base: speculators' long share ${base.previous}% → ${base.long_share}%. Quote: ${quote.previous}% → ${quote.long_share}%.`)
  }
  if (d.us2y !== undefined) lines.push(`US 2-year yield ${d.us2y}% against its 7-day average ${d.ma}%.`)
  if (d.reason) lines.push(String(d.reason))
  return lines.length ? (
    <ul className="grid gap-2 text-small">
      {lines.map((l) => (
        <li key={l}>{l}</li>
      ))}
    </ul>
  ) : (
    <p className="text-small text-muted">{CELL_STATUS_TEXT.missing}</p>
  )
}
