import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ApiError, api } from '../../lib/api/client'

/**
 * Lesson progress, local first (AC-10, DESIGN.md §10). Each completed screen
 * is saved on this device straight away, then sent to the server. If the
 * server is asleep or the device is offline, entries stay pending and are
 * sent again when the connection returns. The server merges, so resending
 * is safe.
 */

type Entry = { screens: number[]; total: number; pending: boolean }
type Store = Record<string, Entry>
type ServerProgress = { lesson: string; completed_blocks: number[]; completed_at: string | null }

const keyFor = (userId: string) => `edgeproof.progress.${userId}`
const listeners = new Set<() => void>()
const cache = new Map<string, Store>()

function read(userId: string): Store {
  if (!cache.has(userId)) {
    let stored: Store = {}
    try {
      stored = JSON.parse(localStorage.getItem(keyFor(userId)) ?? '{}')
    } catch {
      /* private mode or corrupt value: start empty */
    }
    cache.set(userId, stored)
  }
  return cache.get(userId)!
}

function write(userId: string, store: Store) {
  cache.set(userId, store)
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(store))
  } catch {
    /* storage full or blocked: the in-memory copy still syncs this visit */
  }
  listeners.forEach((l) => l())
}

let flushing: Promise<void> | null = null
let rerun = false

export function flushProgress(userId: string): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return Promise.resolve()
  // A sync asked for while one is in flight (say, the 'online' event arriving
  // while a request made just before the drop is still hanging) runs again after it.
  if (flushing) {
    rerun = true
    return flushing
  }
  const run = (async () => {
    for (const slug of Object.keys(read(userId))) {
      // Keep sending until what the server has matches what's on the device.
      for (;;) {
        const entry = read(userId)[slug]
        if (!entry?.pending) break
        const sent = entry.screens
        try {
          await api(`/lessons/${slug}/progress`, {
            method: 'POST',
            body: { completed_blocks: sent },
            resilient: false,
          })
        } catch (err) {
          // A lesson the server doesn't know (not synced yet) or a rejected
          // payload won't succeed on retry: keep it on the device, stop resending.
          // 409: an earlier lesson hasn't reached the server yet, so retry later.
          const permanent =
            err instanceof ApiError && err.status >= 400 && err.status < 500 && ![401, 409, 429].includes(err.status)
          if (!permanent) return // offline, waking or throttled: the next 'online' event or screen retries
        }
        const latest = read(userId)[slug]
        if (latest.screens.length === sent.length) {
          write(userId, { ...read(userId), [slug]: { ...latest, pending: false } })
          break
        }
      }
    }
  })()
  flushing = run
  // Cleared from outside the body: with nothing to send, the body finishes
  // synchronously, before the assignment above.
  void run.finally(() => {
    if (flushing === run) flushing = null
    if (rerun) {
      rerun = false
      void flushProgress(userId)
    }
  })
  return run
}

export function recordScreen(userId: string, slug: string, screen: number, total: number) {
  const store = read(userId)
  const entry = store[slug] ?? { screens: [], total, pending: false }
  if (entry.screens.includes(screen)) return
  write(userId, {
    ...store,
    [slug]: { screens: [...entry.screens, screen].sort((a, b) => a - b), total, pending: true },
  })
  void flushProgress(userId)
}

export type LessonState = { done: number[]; total: number; complete: boolean; pendingSync: boolean }

/**
 * Merged progress for every lesson: server records plus anything on this
 * device that hasn't reached the server yet.
 */
export function useLessonProgress(userId: string | undefined) {
  const server = useQuery({
    queryKey: ['lesson-progress'],
    queryFn: () => api<ServerProgress[]>('/me/lesson-progress'),
    enabled: !!userId,
  })
  const local = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => (userId ? read(userId) : EMPTY),
  )

  useEffect(() => {
    if (!userId) return
    void flushProgress(userId)
    const retry = () => {
      if (document.visibilityState === 'visible') void flushProgress(userId)
    }
    window.addEventListener('online', retry)
    document.addEventListener('visibilitychange', retry)
    return () => {
      window.removeEventListener('online', retry)
      document.removeEventListener('visibilitychange', retry)
    }
  }, [userId])

  const byLesson = useMemo(() => {
    const merged: Record<string, LessonState> = {}
    for (const p of server.data ?? []) {
      merged[p.lesson] = { done: p.completed_blocks, total: 0, complete: !!p.completed_at, pendingSync: false }
    }
    for (const [slug, e] of Object.entries(local)) {
      const done = [...new Set([...(merged[slug]?.done ?? []), ...e.screens])].sort((a, b) => a - b)
      merged[slug] = {
        done,
        total: e.total,
        complete: (merged[slug]?.complete ?? false) || done.length >= e.total,
        pendingSync: e.pending,
      }
    }
    return merged
  }, [server.data, local])

  const record = useCallback(
    (slug: string, screen: number, total: number) => {
      if (userId) recordScreen(userId, slug, screen, total)
    },
    [userId],
  )

  return { byLesson, record, loading: server.isPending && !!userId }
}

const EMPTY: Store = {}
