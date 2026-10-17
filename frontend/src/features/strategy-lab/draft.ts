import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, api } from '../../lib/api/client'
import type { VersionDoc } from './types'

/**
 * Autosaving draft (SL-1, DESIGN.md §10). Every change lands on the device
 * first, then is PATCHed 800 ms after the last edit with the revision it was
 * based on. Offline or waking, it retries when the connection returns. If
 * another device saved in between, the server answers 409 stale_revision and
 * the builder asks which copy to keep.
 */
export type SaveState = 'saved' | 'saving' | 'pending' | 'offline' | 'error'
type Stored = { doc: VersionDoc; base: number; dirty: boolean }
export type Conflict = { server: VersionDoc & { revision: number } }

const DEBOUNCE_MS = 800
const keyFor = (versionId: string) => `edgeproof.strategy-draft.${versionId}`

function read(versionId: string): Stored | null {
  try {
    const raw = localStorage.getItem(keyFor(versionId))
    return raw ? (JSON.parse(raw) as Stored) : null
  } catch {
    return null
  }
}
function write(versionId: string, value: Stored | null) {
  try {
    if (value) localStorage.setItem(keyFor(versionId), JSON.stringify(value))
    else localStorage.removeItem(keyFor(versionId))
  } catch {
    /* in-memory copy still saves this visit */
  }
}

export function useDraft(versionId: string, server: VersionDoc & { revision: number }, readOnly: boolean) {
  const [state, setState] = useState(() => {
    const local = read(versionId)
    // Unsynced edits from this device win if they were based on the server's current revision.
    if (local?.dirty && local.base === server.revision) return { doc: local.doc, base: local.base, dirty: true }
    return { doc: { rules: server.rules, risk_plan: server.risk_plan, cost_model: server.cost_model }, base: server.revision, dirty: false }
  })
  const [save, setSave] = useState<SaveState>(state.dirty ? 'pending' : 'saved')
  const [conflict, setConflict] = useState<Conflict | null>(() => {
    const local = read(versionId)
    return local?.dirty && local.base !== server.revision
      ? { server: { rules: server.rules, risk_plan: server.risk_plan, cost_model: server.cost_model, revision: server.revision } }
      : null
  })
  const [error, setError] = useState<string | null>(null)
  const conflictRef = useRef(conflict)
  conflictRef.current = conflict
  const latest = useRef(state)
  latest.current = state
  const inFlight = useRef<Promise<void> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  /**
   * Sends unsaved changes. Resolves once the server has everything that was
   * on the device when it was called: a save already in flight is awaited,
   * then anything newer is sent (callers like the clarity check rely on this).
   */
  const flush = useCallback(async (): Promise<void> => {
    if (inFlight.current) {
      await inFlight.current
      return latest.current.dirty ? flush() : undefined
    }
    const current = latest.current
    if (!current.dirty || readOnly) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSave('offline')
      return
    }
    setSave('saving')
    const sent = current.doc
    const run = (async () => {
      try {
        const res = await api<{ revision: number }>(`/versions/${versionId}`, {
          method: 'PATCH',
          body: { ...sent, revision: current.base },
          resilient: false,
        })
        const now = latest.current
        const next = { doc: now.doc, base: res.revision, dirty: now.doc !== sent }
        setState(next)
        latest.current = next
        write(versionId, next.dirty ? next : null)
        setError(null)
        setSave(next.dirty ? 'pending' : 'saved')
      } catch (err) {
        if (err instanceof ApiError && err.code === 'stale_revision') {
          setConflict({ server: err.data.server as Conflict['server'] })
          setSave('error')
        } else if (err instanceof ApiError && (err.status === 400 || err.code === 'version_locked')) {
          setError(err.message)
          setSave('error')
        } else {
          setSave('offline')
        }
      }
    })()
    inFlight.current = run
    try {
      await run
    } finally {
      inFlight.current = null
    }
    if (latest.current.dirty && latest.current.doc !== sent && !conflictRef.current) {
      clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), DEBOUNCE_MS)
    }
  }, [versionId, readOnly])

  const update = useCallback(
    (fn: (doc: VersionDoc) => VersionDoc) => {
      if (readOnly) return
      setState((s) => {
        const next = { doc: fn(s.doc), base: s.base, dirty: true }
        latest.current = next
        write(versionId, next)
        return next
      })
      setSave('pending')
      clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), DEBOUNCE_MS)
    },
    [versionId, readOnly, flush],
  )

  /** "Keep this device's version": re-save on top of the server's revision. */
  const keepMine = useCallback(() => {
    if (!conflict) return
    const next = { doc: latest.current.doc, base: conflict.server.revision, dirty: true }
    setState(next)
    latest.current = next
    write(versionId, next)
    setConflict(null)
    void flush()
  }, [conflict, versionId, flush])

  /** "Use the other version": drop this device's edits. */
  const useTheirs = useCallback(() => {
    if (!conflict) return
    const { revision, ...doc } = conflict.server
    const next = { doc, base: revision, dirty: false }
    setState(next)
    latest.current = next
    write(versionId, null)
    setConflict(null)
    setSave('saved')
  }, [conflict, versionId])

  useEffect(() => {
    if (state.dirty && !conflict) void flush()
    const retry = () => {
      if (document.visibilityState === 'visible') void flush()
    }
    window.addEventListener('online', retry)
    document.addEventListener('visibilitychange', retry)
    return () => {
      window.removeEventListener('online', retry)
      document.removeEventListener('visibilitychange', retry)
      clearTimeout(timer.current)
    }
    // Run once per version; flush reads the latest state from the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionId])

  return { doc: state.doc, update, save, conflict, keepMine, useTheirs, error, flush }
}
