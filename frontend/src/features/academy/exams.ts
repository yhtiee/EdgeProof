import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api/client'

/**
 * Exams (spec §5, AC-5 to AC-8). Questions are drawn and graded on the
 * server; answers and explanations never reach the browser. /me/exams is
 * cached on the device so the Learn page can show the path offline.
 */
export type ExamScope = 'module' | 'level' | 'placement'

export type ExamStatus = {
  key: string
  title: string
  scope: ExamScope
  level: number
  module: string | null
  draw_count: number
  pass_mark: number
  passed: boolean
  best_score: number | null
  attempts: number
  in_progress: boolean
  cooldown_until: string | null
  locked: boolean
  blocker: { kind: 'lesson' | 'exam'; key: string; title: string } | null
}

export type ExamQuestion = {
  id: string
  type: 'multiple_choice' | 'numeric'
  prompt: string
  options: { key: string; text: string }[]
  unit: string
}

export type Attempt = {
  id: string
  exam: { key: string; title: string; scope: ExamScope; pass_mark: number; draw_count: number }
  started_at: string
  submitted_at: string | null
  questions: ExamQuestion[]
}

export type ExamResult = {
  score: number
  correct: number
  total: number
  passed: boolean
  pass_mark: number
  results: { question: string; prompt: string; correct: boolean; lessons: string[] }[]
  review_lessons: { slug: string; title: string }[]
  can_retake_now: boolean
  cooldown_until: string | null
  gate_2_passed?: boolean
}

export const MY_EXAMS = ['my-exams'] as const
const cacheKey = (userId: string) => `edgeproof.exams.${userId}`

function cached(userId: string): ExamStatus[] | undefined {
  try {
    const raw = localStorage.getItem(cacheKey(userId))
    return raw ? (JSON.parse(raw) as ExamStatus[]) : undefined
  } catch {
    return undefined
  }
}

/** Every published exam with the learner's status, keyed by exam key. */
export function useMyExams(userId: string | undefined) {
  const query = useQuery({
    queryKey: MY_EXAMS,
    queryFn: () => api<ExamStatus[]>('/me/exams'),
    enabled: !!userId,
    // Last known status, so the path and its locks still show offline.
    placeholderData: () => (userId ? cached(userId) : undefined),
  })
  useEffect(() => {
    if (!userId || !query.data || query.isPlaceholderData) return
    try {
      localStorage.setItem(cacheKey(userId), JSON.stringify(query.data))
    } catch {
      /* storage blocked: the live copy still works this visit */
    }
  }, [userId, query.data, query.isPlaceholderData])

  const byKey = useMemo(
    () => (query.data ? Object.fromEntries(query.data.map((e) => [e.key, e])) : undefined),
    [query.data],
  )
  return { byKey, loading: query.isPending && !!userId, error: query.error, refetch: query.refetch }
}

export const startAttempt = (key: string) => api<Attempt>(`/exams/${key}/attempts`, { method: 'POST' })

export const submitAttempt = (id: string, answers: Record<string, string | number>) =>
  api<ExamResult>(`/attempts/${id}/submit`, { method: 'POST', body: { answers } })

export const reportQuestion = (id: string, reason: string) =>
  api<{ id: string }>(`/questions/${id}/report`, { method: 'POST', body: { reason } })

/** Answers in progress survive a reload: the server resumes an open attempt with the same questions. */
const answersKey = (attemptId: string) => `edgeproof.exam-answers.${attemptId}`

export function loadAnswers(attemptId: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(answersKey(attemptId)) ?? '{}')
  } catch {
    return {}
  }
}

export function saveAnswers(attemptId: string, answers: Record<string, string>) {
  try {
    localStorage.setItem(answersKey(attemptId), JSON.stringify(answers))
  } catch {
    /* not critical */
  }
}

export function clearAnswers(attemptId: string) {
  try {
    localStorage.removeItem(answersKey(attemptId))
  } catch {
    /* not critical */
  }
}

export const percent = (x: number) => `${Math.round(x * 100)}%`

/** "in 23 hours" / "tomorrow at 14:05": when a cooldown ends, in the learner's time. */
export function untilLabel(iso: string, now = Date.now()) {
  const ms = new Date(iso).getTime() - now
  const hours = Math.ceil(ms / 3_600_000)
  const time = new Date(iso).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })
  if (ms <= 0) return 'now'
  if (hours <= 1) return `in under an hour (${time})`
  return `in about ${hours} hours (${time})`
}
