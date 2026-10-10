import { api } from '../../lib/api/client'
import type { Experience, Profile, SessionKey } from './constants'

export const PROFILE_KEY = ['profile'] as const
export const PLAN_KEY = ['plan'] as const

export type Plan = {
  style: { key: 'position' | 'swing' | 'day'; label: string; charts: string; reason: string }
  weekly_hours: number
  timezone: string
  sessions: { key: SessionKey; label: string; utc_start: string; utc_end: string }[]
  academy: { levels: { level: number; title: string; hours: number; weeks: number }[]; total_hours: number }
  time_to_lab: { after_level: number; hours: number; weeks: number }
  placement: { offered: boolean; pass_mark: number; note: string }
  never_again: string[]
}

export const getProfile = () => api<Profile>('/me/profile')

export const saveTimeStep = (body: { weekly_hours: number; timezone: string; sessions: SessionKey[] }) =>
  api<Profile>('/me/onboarding/time', { method: 'PUT', body })

export const saveExperienceStep = (body: Experience) =>
  api<Profile>('/me/onboarding/experience', { method: 'PUT', body })

export const getPlan = () => api<Plan>('/me/plan')

export const acceptPlan = () => api<{ gate: number; passed_at: string }>('/me/plan/accept', { method: 'POST' })
