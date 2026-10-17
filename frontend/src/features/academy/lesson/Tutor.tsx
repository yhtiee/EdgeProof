import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageCircleQuestion, Sparkles } from 'lucide-react'
import { Banner, Button } from '../../../components/ui'
import { BottomSheet } from '../../../components/ui/BottomSheet'
import { SafeMarkdown } from '../../../components/ui/SafeMarkdown'
import { ApiError, api, apiRaw } from '../../../lib/api/client'

/**
 * Academy tutor (spec §10): ask about the current lesson; the answer streams
 * in, then a short practice question with its answer behind "Show answer".
 * The server checks every answer and may ask the model for one rewrite; if
 * that fails too, a safe refusal replaces it. Answers explain; they never advise.
 */
type Status = {
  available: boolean
  reason: { code: string; message: string } | null
  remaining: number
  limit: number
  provider: string | null
  ai_enabled: boolean
  ai_tutor_consent: boolean
}
type Turn = { question: string; text: string; state: 'streaming' | 'done' | 'refused' | 'error'; note?: string; cached?: boolean }

const STATUS = ['tutor-status'] as const
const SUGGESTIONS = ['Explain this more simply', 'Give me another example', 'Why does this matter?']
const PROVIDER: Record<string, string> = { gemini: 'Google Gemini', groq: 'Groq' }

function split(text: string) {
  const [explanation, rest = ''] = text.split('---QUESTION---')
  const [question = '', answer = ''] = rest.split('---ANSWER---')
  return { explanation: explanation.trim(), question: question.trim(), answer: answer.trim() }
}

export function TutorButton({ lesson, title }: { lesson: string; title: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md px-2 text-small font-semibold text-muted hover:bg-raised hover:text-text"
      >
        <MessageCircleQuestion className="size-5" strokeWidth={1.75} aria-hidden="true" />
        <span className="hidden sm:inline">Ask the tutor</span>
        <span className="sr-only sm:hidden">Ask the tutor</span>
      </button>
      <BottomSheet open={open} onOpenChange={setOpen} title="Ask the tutor" description={`About “${title}”. Answers explain; they never advise.`}>
        {open && <TutorPanel lesson={lesson} />}
      </BottomSheet>
    </>
  )
}

function TutorPanel({ lesson }: { lesson: string }) {
  const queryClient = useQueryClient()
  const status = useQuery({ queryKey: STATUS, queryFn: () => api<Status>('/ai/tutor/status', { resilient: false }), staleTime: 15_000 })
  const [turns, setTurns] = useState<Turn[]>([])
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const s = status.data
  const offline = typeof navigator !== 'undefined' && !navigator.onLine

  const consent = async () => {
    await api('/me/settings/ai', { method: 'PATCH', body: { ai_tutor_consent: true } })
    await queryClient.invalidateQueries({ queryKey: STATUS })
  }

  const ask = async (q: string) => {
    const text = q.trim()
    if (text.length < 3 || busy) return
    setBusy(true)
    setError(null)
    setQuestion('')
    const index = turns.length
    setTurns((t) => [...t, { question: text, text: '', state: 'streaming' }])
    const patch = (fn: (t: Turn) => Turn) => setTurns((all) => all.map((t, i) => (i === index ? fn(t) : t)))
    try {
      const res = await apiRaw('/ai/tutor', {
        method: 'POST',
        body: JSON.stringify({ lesson, question: text }),
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      })
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let cut: number
        while ((cut = buffer.indexOf('\n\n')) >= 0) {
          const line = buffer.slice(0, cut).trim()
          buffer = buffer.slice(cut + 2)
          if (!line.startsWith('data: ')) continue
          const event = JSON.parse(line.slice(6))
          if (event.type === 'text') patch((t) => ({ ...t, text: t.text + event.text }))
          else if (event.type === 'reset') patch((t) => ({ ...t, text: '', note: 'Checking the answer and rewriting it…' }))
          else if (event.type === 'done') patch((t) => ({ ...t, text: event.answer, state: 'done', note: undefined, cached: event.cached }))
          else if (event.type === 'refused') patch((t) => ({ ...t, text: event.message, state: 'refused', note: undefined }))
          else if (event.type === 'error') patch((t) => ({ ...t, text: event.message, state: 'error', note: undefined }))
        }
        endRef.current?.scrollIntoView({ block: 'end' })
      }
    } catch (err) {
      setTurns((all) => all.slice(0, index))
      setQuestion(text)
      setError(err instanceof ApiError ? err.message : "Couldn't reach the tutor. Check your connection and try again.")
    } finally {
      setBusy(false)
      void queryClient.invalidateQueries({ queryKey: STATUS })
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void ask(question)
  }

  if (offline) return <Banner kind="offline" title="The tutor needs a connection">Lessons work offline; the tutor answers when you&rsquo;re back online.</Banner>
  if (status.isError) return <Banner kind="danger" title="Couldn't reach the tutor">{(status.error as Error).message}</Banner>
  if (!s) return <div className="h-40 animate-pulse rounded-md bg-surface motion-reduce:animate-none" aria-busy="true" />

  if (s.reason?.code === 'consent_required') {
    return (
      <div className="grid gap-4">
        <div className="flex items-start gap-3 rounded-lg border border-border bg-bg p-4">
          <Sparkles className="mt-0.5 size-5 shrink-0 text-accent-text" strokeWidth={1.75} aria-hidden="true" />
          <div className="grid gap-2 text-small">
            <p className="text-body font-semibold">Before your first question</p>
            <p>
              The tutor sends your question and this lesson&rsquo;s text to {PROVIDER[s.provider ?? ''] ?? 'an AI provider'} to write an answer. Your name, email
              and any long numbers are removed first. Nothing else from your account is sent.
            </p>
            <p className="text-muted">AI answers can be wrong. They explain lessons; they never tell you what to trade. You can turn AI off in Settings at any time.</p>
          </div>
        </div>
        <Button className="w-fit" onClick={consent}>
          Turn on the tutor
        </Button>
      </div>
    )
  }
  if (!s.available && s.reason) {
    return (
      <Banner kind="info" title="The tutor isn't available">
        {s.reason.message}{' '}
        {s.reason.code === 'ai_disabled' && (
          <Link to="/settings" className="font-semibold underline">
            Open Settings
          </Link>
        )}
      </Banner>
    )
  }

  return (
    <div className="grid gap-5">
      {turns.length === 0 && (
        <div className="grid gap-2">
          <p className="text-small text-muted">Ask about anything in this lesson. Try:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((q) => (
              <button key={q} type="button" onClick={() => ask(q)} className="min-h-11 rounded-full border border-control px-4 text-small font-semibold text-muted hover:text-text">
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {turns.map((t, i) => (
        <TurnView key={i} turn={t} />
      ))}
      <div ref={endRef} />

      {error && (
        <p role="alert" className="text-small text-loss">
          {error}
        </p>
      )}

      <form onSubmit={submit} className="grid gap-2">
        <label htmlFor="tutor-q" className="text-small font-semibold">
          Your question
        </label>
        <textarea
          id="tutor-q"
          rows={2}
          maxLength={500}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void ask(question)
            }
          }}
          placeholder="e.g. Why does a bigger lot change the pip value?"
          className="block w-full rounded-sm border border-control bg-raised px-3 py-2 text-body"
        />
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy || question.trim().length < 3 || s.remaining <= 0}>
            {busy ? 'Answering…' : 'Ask'}
          </Button>
          <span className="text-caption text-subtle" role="status">
            {s.remaining} of {s.limit} questions left today
          </span>
        </div>
        <p className="text-caption text-subtle">Answers come from {PROVIDER[s.provider ?? ''] ?? 'an AI model'} and can be wrong. They explain; they never advise.</p>
      </form>
    </div>
  )
}

function TurnView({ turn }: { turn: Turn }) {
  const [show, setShow] = useState(false)
  const parts = split(turn.text)
  return (
    <section className="grid gap-3" aria-live={turn.state === 'streaming' ? 'polite' : undefined} aria-busy={turn.state === 'streaming'}>
      <p className="ml-auto max-w-[85%] rounded-lg bg-raised px-3 py-2 text-body">{turn.question}</p>
      <div className="rounded-lg border border-border bg-bg px-4 py-3 text-body">
        {turn.note && <p className="mb-2 text-caption text-subtle">{turn.note}</p>}
        {turn.state === 'refused' || turn.state === 'error' ? (
          <p className={turn.state === 'error' ? 'text-loss' : 'text-muted'}>{turn.text}</p>
        ) : parts.explanation ? (
          <SafeMarkdown text={parts.explanation} />
        ) : (
          <p className="text-muted">Thinking…</p>
        )}
        {turn.state === 'done' && parts.question && (
          <div className="mt-4 grid gap-2 border-t border-border pt-3">
            <p className="text-small font-semibold text-accent-text">Try this</p>
            <SafeMarkdown text={parts.question} />
            {parts.answer &&
              (show ? (
                <div className="rounded-md bg-surface px-3 py-2">
                  <SafeMarkdown text={parts.answer} />
                </div>
              ) : (
                <button type="button" onClick={() => setShow(true)} className="w-fit min-h-11 text-small font-semibold underline underline-offset-4">
                  Show answer
                </button>
              ))}
          </div>
        )}
        {turn.cached && <p className="mt-2 text-caption text-subtle">Answered before for this lesson; shown from the saved answer.</p>}
      </div>
    </section>
  )
}
