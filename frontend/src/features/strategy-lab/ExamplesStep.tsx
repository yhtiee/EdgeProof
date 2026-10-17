import { useRef, useState, type PointerEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ImagePlus, MoveUpRight, Square, Trash2, Undo2 } from 'lucide-react'
import { Button } from '../../components/ui'
import { uploadScreenshot, useScreenshot } from '../journal/images'
import { addExample, deleteExample, versionKey, type Example, type Mark } from './api'
import { describeCondition } from './describe'
import type { Condition } from './types'

/**
 * Examples (SL-3, rulebook-builder.md §4.3): for every setup condition, a
 * chart where it's true and one where it's false. The note carries the
 * meaning; arrow and box marks are optional, so the step works for everyone.
 */
export function ExamplesStep({ versionId, conditions, examples, readOnly, locked, errors }: {
  versionId: string
  conditions: Condition[]
  examples: Example[]
  readOnly: boolean
  locked: boolean
  errors: Record<string, string>
}) {
  if (!conditions.length) return <p className="text-body text-muted">Add setup conditions first; each needs two example charts.</p>
  return (
    <div className="grid gap-8">
      {conditions.map((c, i) => (
        <section key={c.id} aria-labelledby={`ex-${c.id}`} data-path={`examples.${c.id}`} tabIndex={-1} className="grid gap-3 outline-none">
          <h2 id={`ex-${c.id}`} className="text-body font-semibold">
            <span className="mr-2 font-mono text-caption text-subtle">{i + 1}</span>
            {describeCondition(c)}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {[true, false].map((valid) => (
              <Slot
                key={String(valid)}
                versionId={versionId}
                ruleKey={c.id}
                valid={valid}
                examples={examples.filter((e) => e.rule_key === c.id && e.valid === valid)}
                canAdd={!readOnly || locked}
                canDelete={!readOnly && !locked}
              />
            ))}
          </div>
          {(errors[`examples.${c.id}`]) && <p className="text-caption text-danger">{errors[`examples.${c.id}`]}</p>}
        </section>
      ))}
    </div>
  )
}

function Slot({ versionId, ruleKey, valid, examples, canAdd, canDelete }: {
  versionId: string
  ruleKey: string
  valid: boolean
  examples: Example[]
  canAdd: boolean
  canDelete: boolean
}) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<{ key: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const label = valid ? 'True on this chart' : 'False on this chart'

  const upload = async (file: File) => {
    setBusy(true)
    setError(null)
    try {
      setDraft({ key: await uploadScreenshot(file) })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const refresh = () => queryClient.invalidateQueries({ queryKey: versionKey(versionId) })

  return (
    <div className="grid content-start gap-3 rounded-lg border border-dashed border-control p-3">
      <p className={`text-small font-semibold ${valid ? 'text-gain' : 'text-loss'}`}>{label}</p>
      {examples.map((e) => (
        <SavedExample key={e.id} example={e} canDelete={canDelete} onDeleted={refresh} />
      ))}
      {draft ? (
        <DraftExample
          imageKey={draft.key}
          valid={valid}
          onCancel={() => setDraft(null)}
          onSave={async (note, annotations) => {
            await addExample(versionId, { rule_key: ruleKey, valid, image_key: draft.key, note, annotations })
            setDraft(null)
            await refresh()
          }}
        />
      ) : (
        canAdd &&
        examples.length < 3 && (
          <label className="inline-flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-md border border-control px-4 text-small font-semibold hover:bg-surface has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus">
            <ImagePlus className="size-4" strokeWidth={1.75} aria-hidden="true" />
            {busy ? 'Uploading…' : 'Add screenshot'}
            <input type="file" accept="image/*" className="sr-only" disabled={busy} aria-label={`Add screenshot: ${label}`} onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
          </label>
        )
      )}
      {error && (
        <p role="alert" className="text-small text-loss">
          {error}
        </p>
      )}
    </div>
  )
}

function SavedExample({ example, canDelete, onDeleted }: { example: Example; canDelete: boolean; onDeleted: () => void }) {
  const shot = useScreenshot(example.image_key)
  return (
    <figure className="grid gap-2">
      <div className="relative overflow-hidden rounded-md border border-border bg-surface">
        {shot.url ? (
          <img src={shot.url} alt={example.note} className="w-full" />
        ) : (
          <button type="button" onClick={shot.load} className="flex aspect-video w-full items-center justify-center text-small text-muted">
            {shot.loading ? 'Loading…' : 'Show screenshot'}
          </button>
        )}
        {shot.url && <Marks marks={example.annotations} />}
      </div>
      <figcaption className="flex items-start gap-2 text-small">
        <span className="min-w-0 flex-1">{example.note}</span>
        {canDelete && (
          <button
            type="button"
            aria-label="Remove this example"
            onClick={async () => {
              await deleteExample(example.id)
              onDeleted()
            }}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface"
          >
            <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}
      </figcaption>
    </figure>
  )
}

function DraftExample({ imageKey, valid, onSave, onCancel }: {
  imageKey: string
  valid: boolean
  onSave: (note: string, marks: Mark[]) => Promise<void>
  onCancel: () => void
}) {
  const shot = useScreenshot(imageKey, true)
  const [marks, setMarks] = useState<Mark[]>([])
  const [tool, setTool] = useState<Mark['shape']>('arrow')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const area = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const [live, setLive] = useState<Mark | null>(null)

  const point = (e: PointerEvent) => {
    const r = area.current!.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }
  }

  return (
    <div className="grid gap-3">
      <div
        ref={area}
        className="relative touch-none overflow-hidden rounded-md border border-border bg-surface"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          start.current = point(e)
        }}
        onPointerMove={(e) => {
          if (!start.current) return
          const p = point(e)
          setLive({ shape: tool, x1: start.current.x, y1: start.current.y, x2: p.x, y2: p.y })
        }}
        onPointerUp={() => {
          if (live && Math.hypot(live.x2 - live.x1, live.y2 - live.y1) > 0.02 && marks.length < 12) setMarks([...marks, live])
          start.current = null
          setLive(null)
        }}
      >
        {shot.url ? <img src={shot.url} alt="" className="pointer-events-none w-full select-none" draggable={false} /> : <div className="aspect-video" />}
        <Marks marks={live ? [...marks, live] : marks} />
      </div>
      <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Mark the chart (optional)">
        {(['arrow', 'box'] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={tool === s}
            onClick={() => setTool(s)}
            className={`inline-flex min-h-11 items-center gap-1 rounded-md border px-3 text-small font-semibold ${tool === s ? 'border-text bg-text text-bg' : 'border-control text-muted'}`}
          >
            {s === 'arrow' ? <MoveUpRight className="size-4" strokeWidth={1.75} aria-hidden="true" /> : <Square className="size-4" strokeWidth={1.75} aria-hidden="true" />}
            {s === 'arrow' ? 'Arrow' : 'Box'}
          </button>
        ))}
        <button type="button" disabled={!marks.length} onClick={() => setMarks(marks.slice(0, -1))} className="inline-flex min-h-11 items-center gap-1 rounded-md px-3 text-small font-semibold text-muted disabled:opacity-40">
          <Undo2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
          Undo
        </button>
        <span className="text-caption text-subtle">Drag on the chart to mark it. Optional.</span>
      </div>
      <div>
        <label htmlFor={`note-${imageKey}`} className="mb-1 block text-small font-semibold">
          {valid ? 'Why this counts' : 'Why this doesn’t count'}
        </label>
        <textarea id={`note-${imageKey}`} rows={2} maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} className="block w-full rounded-sm border border-control bg-raised px-3 py-2 text-body" />
      </div>
      {error && (
        <p role="alert" className="text-small text-loss">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <Button
          disabled={saving || note.trim().length < 5}
          onClick={async () => {
            setSaving(true)
            setError(null)
            try {
              await onSave(note.trim(), marks)
            } catch (err) {
              setError((err as Error).message)
              setSaving(false)
            }
          }}
        >
          {saving ? 'Saving…' : 'Save example'}
        </Button>
        <button type="button" onClick={onCancel} className="min-h-11 px-2 text-small font-semibold text-muted hover:text-text">
          Cancel
        </button>
      </div>
    </div>
  )
}

/** Arrow and box marks over a screenshot, in 0–1 coordinates so they scale with it. Decorative: the note carries meaning. */
function Marks({ marks }: { marks: Mark[] }) {
  if (!marks.length) return null
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
      <defs>
        <marker id="ep-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className="fill-accent" />
        </marker>
      </defs>
      {marks.map((m, i) =>
        m.shape === 'arrow' ? (
          <line key={i} x1={m.x1 * 100} y1={m.y1 * 100} x2={m.x2 * 100} y2={m.y2 * 100} className="stroke-accent" strokeWidth="0.8" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 3 }} markerEnd="url(#ep-arrow)" />
        ) : (
          <rect key={i} x={Math.min(m.x1, m.x2) * 100} y={Math.min(m.y1, m.y2) * 100} width={Math.abs(m.x2 - m.x1) * 100} height={Math.abs(m.y2 - m.y1) * 100} fill="none" className="stroke-accent" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 3 }} />
        ),
      )}
    </svg>
  )
}
