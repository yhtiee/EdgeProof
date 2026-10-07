import { useSyncExternalStore } from 'react'

/**
 * Server reachability, shared across the app (spec §16 "Cold starts").
 * - online: the API answered recently
 * - waking: a request has been waiting more than 2 seconds (free host waking up)
 * - offline: retries for 60 seconds failed; the user's work stays on the device
 */
export type ServerStatus = 'online' | 'waking' | 'offline'

let status: ServerStatus = 'online'
const listeners = new Set<() => void>()

export function setServerStatus(next: ServerStatus) {
  if (next === status) return
  status = next
  listeners.forEach((l) => l())
}

export function getServerStatus() {
  return status
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useServerStatus(): ServerStatus {
  return useSyncExternalStore(subscribe, getServerStatus, () => 'online')
}
