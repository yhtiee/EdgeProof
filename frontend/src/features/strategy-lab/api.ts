import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api/client'
import type { ClarityReport, FitItem, VersionDoc } from './types'

/** Strategy Lab API types and read hooks (rulebook-builder.md §3.6). */

export type LabAccess = {
  open: boolean
  requirement_met: boolean
  gates_open: boolean
  required: { slug: string; title: string; done: boolean }[]
}

export type VersionSummary = {
  id: string
  number: number
  reason: string
  kind: 'mechanical' | 'discretionary'
  clarity_status: 'unchecked' | 'failing' | 'passing'
  locked: boolean
  locked_at: string | null
  created_at: string
  updated_at: string
  fails?: number | null
  trades?: number
}

export type Strategy = {
  id: string
  name: string
  status: 'active' | 'archived'
  latest: VersionSummary | null
  versions: number
  created_at: string
  updated_at: string
}

export type Example = {
  id: string
  rule_key: string
  valid: boolean
  image_key: string
  note: string
  annotations: Mark[]
  created_at: string
}
export type Mark = { shape: 'arrow' | 'box'; x1: number; y1: number; x2: number; y2: number }

export type Version = VersionDoc & {
  id: string
  strategy: { id: string; name: string; status: Strategy['status'] }
  number: number
  reason: string
  kind: 'mechanical' | 'discretionary'
  clarity_status: VersionSummary['clarity_status']
  clarity_report: (ClarityReport & { fit?: FitItem[] }) | Record<string, never>
  locked: boolean
  locked_at: string | null
  revision: number
  examples: Example[]
  fit?: FitItem[]
  created_at: string
  updated_at: string
}

export const MAX_ACTIVE = 5
export const LAB_KEYS = { access: ['lab-access'], strategies: ['strategies'] } as const
export const versionKey = (id: string) => ['strategy-version', id] as const

function cache<T>(key: string, value?: T): T | undefined {
  try {
    if (value !== undefined) localStorage.setItem(key, JSON.stringify(value))
    else {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : undefined
    }
  } catch {
    /* storage blocked */
  }
  return undefined
}

export const useLabAccess = (enabled = true) =>
  useQuery({ queryKey: LAB_KEYS.access, queryFn: () => api<LabAccess>('/strategy-lab/access'), enabled, staleTime: 60_000 })

/** The user's strategies, kept on the device so the list (and the journal's strategy select) works offline. */
export function useStrategies(userId: string | undefined) {
  const key = `edgeproof.cache.${userId}.strategies`
  const query = useQuery<Strategy[]>({
    queryKey: LAB_KEYS.strategies,
    queryFn: () => api<Strategy[]>('/strategies'),
    enabled: !!userId,
    placeholderData: (() => (userId ? cache<Strategy[]>(key) : undefined)) as never,
  })
  useEffect(() => {
    if (userId && query.data && !query.isPlaceholderData) cache(key, query.data)
  }, [userId, key, query.data, query.isPlaceholderData])
  return query
}

export function useVersion(id: string | undefined) {
  const key = `edgeproof.cache.version.${id}`
  const query = useQuery<Version>({
    queryKey: versionKey(id ?? ''),
    queryFn: () => api<Version>(`/versions/${id}`),
    enabled: !!id,
    placeholderData: (() => (id ? cache<Version>(key) : undefined)) as never,
  })
  useEffect(() => {
    if (id && query.data && !query.isPlaceholderData) cache(key, query.data)
  }, [id, key, query.data, query.isPlaceholderData])
  return query
}

export const createStrategy = (name: string) => api<Strategy>('/strategies', { method: 'POST', body: { name } })
export const updateStrategy = (id: string, body: Partial<Pick<Strategy, 'name' | 'status'>>) =>
  api<Strategy>(`/strategies/${id}`, { method: 'PATCH', body })
export const listVersions = (strategyId: string) => api<VersionSummary[]>(`/strategies/${strategyId}/versions`)
export const createVersion = (strategyId: string, reason: string) =>
  api<Version>(`/strategies/${strategyId}/versions`, { method: 'POST', body: { reason } })
export const runClarity = (versionId: string) =>
  api<ClarityReport & { fit: FitItem[] }>(`/versions/${versionId}/clarity-check`, { method: 'POST' })
export const passGate3 = (versionId: string) => api<Version>(`/versions/${versionId}/gate-3`, { method: 'POST' })
export const addExample = (versionId: string, body: Omit<Example, 'id' | 'created_at'>) =>
  api<Example>(`/versions/${versionId}/examples`, { method: 'POST', body })
export const updateExample = (id: string, body: Partial<Pick<Example, 'note' | 'annotations' | 'valid'>>) =>
  api<Example>(`/examples/${id}`, { method: 'PATCH', body })
export const deleteExample = (id: string) => api(`/examples/${id}`, { method: 'DELETE' })
