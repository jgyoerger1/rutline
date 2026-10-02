import { useSyncExternalStore } from 'react'
import type { Settings } from './types'

const KEY = 'rutline.settings.v1'
const STAMP = 'rutline.settings.updatedAt'

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
  localOnly: false,
}

/** Settings that are device choices, not account data */
const DEVICE_ONLY: Array<keyof Settings> = ['localOnly']

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

// Settings saved before sync existed carry no timestamp. Give them a low one so an
// account copy wins when present, but a brand-new account still receives them.
try {
  if (!localStorage.getItem(STAMP) && localStorage.getItem(KEY)) localStorage.setItem(STAMP, '1')
} catch {
  /* ignore */
}

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* private mode: keep in memory */
  }
}

export function getSettings(): Settings {
  return state
}

export function getSettingsUpdatedAt(): number {
  try {
    return Number(localStorage.getItem(STAMP) ?? 0) || 0
  } catch {
    return 0
  }
}

function stamp(at: number): void {
  try {
    localStorage.setItem(STAMP, String(at))
  } catch {
    /* ignore */
  }
}

export function setSettings(patch: Partial<Settings>): void {
  state = { ...state, ...patch }
  persist()
  const accountChange = Object.keys(patch).some((k) => !DEVICE_ONLY.includes(k as keyof Settings))
  if (accountChange) {
    stamp(Date.now())
    window.dispatchEvent(new CustomEvent('rutline:settings'))
  }
  listeners.forEach((l) => l())
}

/** Settings worth syncing to the account */
export function syncableSettings(s: Settings = state): Record<string, unknown> {
  const out: Record<string, unknown> = { ...s }
  for (const k of DEVICE_ONLY) delete out[k]
  return out
}

/** Apply the account copy without re-stamping or re-syncing */
export function applyRemoteSettings(remote: Record<string, unknown>, updatedAt: number): void {
  const incoming = remote as Partial<Settings>
  const keep: Partial<Settings> = {}
  for (const k of DEVICE_ONLY) (keep as Record<string, unknown>)[k] = state[k]
  state = { ...DEFAULTS, ...incoming, hunter: { ...DEFAULTS.hunter, ...(incoming.hunter ?? {}) }, ...keep }
  persist()
  stamp(updatedAt)
  listeners.forEach((l) => l())
}

export function resetSettings(): void {
  state = { ...DEFAULTS }
  persist()
  stamp(0)
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
