import { useSyncExternalStore } from 'react'
import type { Settings } from './types'

const KEY = 'rutline.settings.v1'

const DEFAULTS: Settings = {
  home: null,
  units: 'imperial',
  rutPeakOverride: null,
  mapLayer: 'satellite',
  trackerMode: 'high',
  trackerColor: 'red',
  trackerSound: true,
  legalLightMinutes: 30,
  parcelsEnabled: true,
  customParcelSource: null,
  hunter: { name: '', phone: '', email: '' },
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as Partial<Settings>
    return { ...DEFAULTS, ...parsed, hunter: { ...DEFAULTS.hunter, ...(parsed.hunter ?? {}) } }
  } catch {
    return DEFAULTS
  }
}

let state: Settings = load()
const listeners = new Set<() => void>()

export function getSettings(): Settings {
  return state
}

export function setSettings(patch: Partial<Settings>): void {
  state = { ...state, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* private mode: keep in memory */
  }
  listeners.forEach((l) => l())
}

function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const s = useSyncExternalStore(subscribe, getSettings, getSettings)
  return [s, setSettings]
}
