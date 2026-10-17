import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api/client'
import { PageHeader } from '../../components/layout/PageHeader'
import { readDisplay, saveDisplay, type ThemePref } from '../../lib/theme'

/** Settings (AS-2): display preferences and the AI switch. Two columns on wide screens. */
export default function MorePage() {
  const [display, setDisplay] = useState(readDisplay)
  const update = (patch: Partial<typeof display>) => {
    saveDisplay(patch)
    setDisplay(readDisplay())
  }

  return (
    <div>
      <PageHeader title="Settings" />
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <fieldset>
          <legend className="mb-2 text-h3">Theme</legend>
          <div className="inline-flex rounded-md border border-control p-1" role="radiogroup" aria-label="Theme">
            {(['system', 'light', 'dark'] as ThemePref[]).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={display.theme === t}
                onClick={() => update({ theme: t })}
                className={`min-h-11 rounded-sm px-4 text-small font-semibold capitalize ${
                  display.theme === t ? 'bg-raised text-text' : 'text-muted'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </fieldset>
        <div>
          <h2 className="mb-2 text-h3">Display</h2>
          <Toggle
            label="Colour-blind mode"
            help="Shows gains in blue and losses in orange."
            checked={display.colourBlind}
            onChange={(v) => update({ colourBlind: v })}
          />
          <Toggle
            label="Data-saver mode"
            help="Uses system fonts and stops images loading automatically."
            checked={display.dataSaver}
            onChange={(v) => update({ dataSaver: v })}
          />
        </div>
        <AISettings />
      </div>
    </div>
  )
}

type AIPrefs = { ai_enabled: boolean; ai_tutor_consent: boolean }

/** Spec §10 Privacy: AI can be switched off entirely, and the tutor's consent withdrawn. */
function AISettings() {
  const queryClient = useQueryClient()
  const prefs = useQuery({ queryKey: ['ai-settings'], queryFn: () => api<AIPrefs>('/me/settings/ai') })
  const [error, setError] = useState<string | null>(null)
  // Optimistic (DESIGN.md §10): the switch moves at once and rolls back if the server refuses.
  const save = async (patch: Partial<AIPrefs>) => {
    const before = queryClient.getQueryData<AIPrefs>(['ai-settings'])
    queryClient.setQueryData(['ai-settings'], { ...before!, ...patch })
    setError(null)
    try {
      queryClient.setQueryData(['ai-settings'], await api<AIPrefs>('/me/settings/ai', { method: 'PATCH', body: patch }))
      void queryClient.invalidateQueries({ queryKey: ['tutor-status'] })
    } catch (err) {
      queryClient.setQueryData(['ai-settings'], before)
      setError(`Couldn't save: ${(err as Error).message}`)
    }
  }
  if (!prefs.data) return null
  return (
    <div>
      <h2 className="mb-2 text-h3">AI</h2>
      <Toggle
        label="AI features"
        help="The Academy tutor explains lessons when you ask. Turn this off and nothing is sent to an AI provider."
        checked={prefs.data.ai_enabled}
        onChange={(v) => save({ ai_enabled: v })}
      />
      <Toggle
        label="Tutor consent"
        help="Lets the tutor send your question and the lesson text (with your name, email and long numbers removed) to the AI provider."
        checked={prefs.data.ai_tutor_consent}
        onChange={(v) => save({ ai_tutor_consent: v })}
      />
      {error && (
        <p role="alert" className="mt-2 text-small text-loss">
          {error}
        </p>
      )}
    </div>
  )
}

type ToggleProps = { label: string; help: string; checked: boolean; onChange: (v: boolean) => void }

function Toggle({ label, help, checked, onChange }: ToggleProps) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start justify-between gap-4 border-t border-border py-4">
      <span>
        <span className="block text-body font-semibold">{label}</span>
        <span className="block text-small text-muted">{help}</span>
      </span>
      <input
        type="checkbox"
        className="mt-1 size-5 accent-[var(--text)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  )
}
