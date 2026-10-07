import { useState } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { readDisplay, saveDisplay, type ThemePref } from '../../lib/theme'

/** Settings (AS-2): display preferences for now. */
export default function MorePage() {
  const [display, setDisplay] = useState(readDisplay)
  const update = (patch: Partial<typeof display>) => {
    saveDisplay(patch)
    setDisplay(readDisplay())
  }

  return (
    <div className="mx-auto max-w-[680px]">
      <PageHeader title="Settings" />
      <fieldset className="mb-8">
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
