import { useState } from 'react'
import { Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { Button } from '../../components/ui'
import { SafeMarkdown } from '../../components/ui/SafeMarkdown'
import { ApiError } from '../../lib/api/client'
import { useExplainStatus, type Factor } from './api'
import { streamExplanation } from './stream'

/**
 * "Explain it simply" (founder request, docs/scanner §7): a plain-language explanation,
 * at a reading age of about 12, written by the AI provider from the scores, official
 * prints and central bank publications on this page. Same guardrails as the tutor;
 * answers are shared and cached per daily run, so most taps are instant.
 */
type State = 'idle' | 'streaming' | 'done' | 'refused' | 'error'

export function ExplainPanel({ subject, factor, label }: { subject: string; factor?: Factor; label: string }) {
  const status = useExplainStatus()
  const queryClient = useQueryClient()
  const [state, setState] = useState<State>('idle')
  const [text, setText] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [meta, setMeta] = useState<{ remaining: number; cached: boolean } | null>(null)

  const run = async () => {
    setState('streaming')
    setText('')
    setNote(null)
    try {
      await streamExplanation({ subject, ...(factor ? { factor } : {}) }, (e) => {
        if (e.type === 'meta') setMeta({ remaining: e.remaining, cached: e.cached })
        else if (e.type === 'text') setText((t) => t + e.text)
        else if (e.type === 'reset') {
          setText('')
          setNote('Checking the explanation against EdgeProof’s rules and rewriting it…')
        } else if (e.type === 'done') {
          setText(e.answer)
          setNote(null)
          setState('done')
        } else if (e.type === 'refused') {
          setText(e.message)
          setNote(null)
          setState('refused')
        } else if (e.type === 'error') {
          setText(e.message)
          setState('error')
        }
      })
    } catch (err) {
      setText(err instanceof ApiError ? err.message : 'Couldn’t reach the explainer. Check your connection and try again.')
      setState('error')
    } finally {
      void queryClient.invalidateQueries({ queryKey: ['scanner', 'explain-status'] })
    }
  }

  const s = status.data
  if (s && !s.available) {
    return (
      <p className="text-caption text-subtle">
        {s.reason?.message}
        {s.reason?.code === 'ai_disabled' && (
          <>
            {' '}
            <Link to="/settings" className="font-semibold text-accent-text hover:underline">
              Settings
            </Link>
          </>
        )}
      </p>
    )
  }

  return (
    <div className="grid gap-3">
      {state === 'idle' ? (
        <Button variant="secondary" className="w-fit" onClick={run}>
          <Sparkles className="size-4" strokeWidth={2} aria-hidden="true" />
          {label}
        </Button>
      ) : (
        <div className="rounded-md border border-border bg-bg p-4" aria-live="polite" aria-busy={state === 'streaming'}>
          <p className="mb-2 flex items-center gap-1.5 text-caption font-semibold text-muted">
            <Sparkles className="size-3.5" strokeWidth={2} aria-hidden="true" />
            Explained simply
          </p>
          {note && <p className="mb-2 text-caption text-subtle">{note}</p>}
          {text ? (
            <SafeMarkdown text={text} className={state === 'error' || state === 'refused' ? 'text-muted' : ''} />
          ) : (
            <div className="h-16 animate-pulse rounded-sm bg-surface motion-reduce:animate-none" />
          )}
          {state !== 'streaming' && (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3 text-caption text-subtle">
              <span>Written by AI from the data on this page. It can make mistakes and is not advice.</span>
              {meta && !meta.cached && state === 'done' && <span>{meta.remaining} new explanations left today.</span>}
              {state === 'error' && (
                <Button variant="ghost" className="min-h-8 px-2 text-caption" onClick={run}>
                  Try again
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
