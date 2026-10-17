import { useSyncExternalStore } from 'react'
import { ApiError, api } from '../../lib/api/client'
import type { Trade, TradeInput } from './api'

/**
 * Local-first journal writes (DESIGN.md §10). A saved trade lands here
 * first, then syncs in order. New trades carry a client_id, so a resend
 * after a dropped connection updates instead of duplicating. A trade the
 * server rejects keeps its errors here, so the list can point back to it.
 */
export type Pending = {
  key: string // client_id for new trades, server id for edits
  id?: string
  op: 'save' | 'delete'
  body?: TradeInput
  error?: { message: string; fields: Record<string, string[]> }
  at: number
}

type Store = Record<string, Pending>
export type FlushResult = Record<string, 'synced' | 'rejected' | 'waiting'>

const storageKey = (userId: string) => `edgeproof.journal-outbox.${userId}`
const listeners = new Set<() => void>()
const cache = new Map<string, Store>()
const EMPTY: Store = {}

export function readOutbox(userId: string): Store {
  if (!cache.has(userId)) {
    let stored: Store = {}
    try {
      stored = JSON.parse(localStorage.getItem(storageKey(userId)) ?? '{}')
    } catch {
      /* start empty */
    }
    cache.set(userId, stored)
  }
  return cache.get(userId)!
}

function write(userId: string, store: Store) {
  cache.set(userId, store)
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(store))
  } catch {
    /* in-memory copy still syncs this visit */
  }
  listeners.forEach((l) => l())
}

export function queueSave(userId: string, key: string, body: TradeInput, id?: string) {
  const store = readOutbox(userId)
  write(userId, { ...store, [key]: { key, id: id ?? store[key]?.id, op: 'save', body, at: Date.now() } })
}

export function queueDelete(userId: string, key: string, id?: string) {
  const store = { ...readOutbox(userId) }
  const known = id ?? store[key]?.id
  if (!known) delete store[key] // never reached the server: just forget it
  else store[key] = { key, id: known, op: 'delete', at: Date.now() }
  write(userId, store)
}

export function discard(userId: string, key: string) {
  const store = { ...readOutbox(userId) }
  delete store[key]
  write(userId, store)
}

let flushing: Promise<FlushResult> | null = null

/**
 * Sends everything waiting, oldest first. Stops at the first network
 * failure (the rest wait for the next 'online' event); a rejected trade is
 * kept with its errors and skipped until it's edited.
 */
export function flushOutbox(userId: string, onSynced?: (trade?: Trade) => void): Promise<FlushResult> {
  if (flushing) return flushing.then(() => flushOutbox(userId, onSynced))
  const run = (async () => {
    const result: FlushResult = {}
    const items = Object.values(readOutbox(userId)).sort((a, b) => a.at - b.at)
    for (const item of items) {
      if (item.error) {
        result[item.key] = 'rejected'
        continue
      }
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        result[item.key] = 'waiting'
        continue
      }
      try {
        let saved: Trade | undefined
        if (item.op === 'delete') {
          await api(`/me/trades/${item.id}`, { method: 'DELETE', resilient: false }).catch((e) => {
            if (!(e instanceof ApiError && e.status === 404)) throw e
          })
        } else if (item.id) {
          saved = await api<Trade>(`/me/trades/${item.id}`, { method: 'PATCH', body: item.body, resilient: false })
        } else {
          saved = await api<Trade>('/me/trades', { method: 'POST', body: { ...item.body, client_id: item.key }, resilient: false })
        }
        // Only clear it if it wasn't edited again while the request was out.
        const latest = readOutbox(userId)[item.key]
        if (latest && latest.at === item.at) discard(userId, item.key)
        else if (latest && saved) write(userId, { ...readOutbox(userId), [item.key]: { ...latest, id: saved.id } })
        result[item.key] = 'synced'
        onSynced?.(saved)
      } catch (err) {
        const rejected = err instanceof ApiError && err.status >= 400 && err.status < 500 && ![401, 408, 429].includes(err.status)
        if (rejected) {
          const latest = readOutbox(userId)[item.key]
          if (latest) write(userId, { ...readOutbox(userId), [item.key]: { ...latest, error: { message: err.message, fields: err.fields } } })
          result[item.key] = 'rejected'
          continue
        }
        result[item.key] = 'waiting'
        for (const rest of items) result[rest.key] ??= 'waiting'
        break
      }
    }
    return result
  })()
  flushing = run
  void run.finally(() => {
    if (flushing === run) flushing = null
  })
  return run
}

export function useOutbox(userId: string | undefined): Store {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => (userId ? readOutbox(userId) : EMPTY),
  )
}

export const newClientId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().replace(/-/g, '')
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
