/**
 * Display preferences applied to <html> (DESIGN.md §3, §4).
 * Stored per device; account-level settings sync from /me/settings later.
 */
export type ThemePref = 'system' | 'light' | 'dark'

const KEY = 'edgeproof.display'

type Display = { theme: ThemePref; colourBlind: boolean; dataSaver: boolean }

const DEFAULTS: Display = { theme: 'system', colourBlind: false, dataSaver: false }

export function readDisplay(): Display {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return DEFAULTS
  }
}

export function applyDisplay(display: Display = readDisplay()) {
  const root = document.documentElement
  if (display.theme === 'system') delete root.dataset.theme
  else root.dataset.theme = display.theme
  root.dataset.cb = String(display.colourBlind)
  root.dataset.saver = String(display.dataSaver)
}

export function saveDisplay(patch: Partial<Display>) {
  const next = { ...readDisplay(), ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* private mode: still apply for this visit */
  }
  applyDisplay(next)
}
