import { useSyncExternalStore } from 'react'
import { cloud } from './cloud'

/**
 * Rutline Pro. The app is free; Pro is a season pass (12 months) that opens
 * the terrain overlay, unlimited blood tracking, the full week of HuntCast,
 * Trophy Center, the whole field guide and camps. The entitlement lives on
 * the account (entitlements table, written only by the server), is cached on
 * the device so it holds up offline, and is re-checked on sign-in and hourly.
 */
export type ProFeature = 'all' | 'terrain' | 'tracker' | 'huntcast' | 'trophies' | 'guide' | 'camps'

export const PRO_PRICE = (import.meta.env.VITE_PRO_PRICE as string | undefined)?.trim() || '$19.99'
/** Stripe Payment Link for the season pass; empty until Jordan creates one */
export const PAYMENT_LINK = (import.meta.env.VITE_STRIPE_PAYMENT_LINK as string | undefined)?.trim() || ''
export const FREE_TRACK_SECONDS = 5 * 60
export const FREE_FORECAST_DAYS = 2

export const PRO_BENEFITS: Array<{ id: ProFeature; title: string; body: string }> = [
  { id: 'terrain', title: 'LiDAR terrain on the map', body: 'Hillshade, slope and 5-foot contours from USGS lidar. Ridges, benches, saddles and draws under the leaves.' },
  { id: 'tracker', title: 'Unlimited blood tracking', body: 'The blood light runs as long as the trail does. Free gets five minutes a day.' },
  { id: 'huntcast', title: 'The whole week of HuntCast', body: 'Seven days of movement scores and the best hours in each. Free shows today and tomorrow.' },
  { id: 'trophies', title: 'Trophy Center', body: 'Up to twenty bucks with their photos, a rough score and where they show up.' },
  { id: 'guide', title: 'The full field guide', body: 'Reading a blood trail and scoring a buck, with the score sheet and the photo tracer. Field dressing stays free.' },
  { id: 'camps', title: 'Camps', body: 'Share stands, trails and photos with your crew on one map.' },
]

export interface ProState {
  pro: boolean
  until: number | null
  source: string | null
  checkedAt: number
}

const KEY = 'rutline.pro.v1'
const EMPTY: ProState = { pro: false, until: null, source: null, checkedAt: 0 }

function load(): ProState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY
    const s = JSON.parse(raw) as ProState
    return { ...s, pro: s.until != null && s.until > Date.now() }
  } catch {
    return EMPTY
  }
}

let state: ProState = load()
const listeners = new Set<() => void>()
function set(next: ProState) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l())
}

/** True while the account has Pro. Offline, the last check holds until its end date. */
export function useProStatus(): boolean {
  return useSyncExternalStore(subscribe, () => state.pro, () => false)
}
export function useProState(): ProState {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY)
}
function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

let inflight: Promise<ProState> | null = null
/** Re-check the entitlement on the account. Safe to call often; calls collapse. */
export function refreshPro(): Promise<ProState> {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      if (import.meta.env.DEV && localStorage.getItem('rutline.pro') === '1') {
        set({ pro: true, until: Date.now() + 365 * 86400e3, source: 'dev', checkedAt: Date.now() })
        return state
      }
      if (!cloud) {
        set({ ...EMPTY, checkedAt: Date.now() })
        return state
      }
      const user = await cloud.getUser()
      if (!user) {
        set({ ...EMPTY, checkedAt: Date.now() })
        return state
      }
      const ent = await cloud.getEntitlement()
      const until = ent?.proUntil ?? null
      set({ pro: until != null && until > Date.now(), until, source: ent?.source ?? null, checkedAt: Date.now() })
      return state
    } catch {
      // Keep whatever we had; a flaky signal must not lock a paying hunter out in the woods
      return state
    } finally {
      inflight = null
    }
  })()
  return inflight
}

export function proUntilLabel(until: number | null): string {
  if (!until) return ''
  return new Date(until).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

if (typeof window !== 'undefined') {
  void refreshPro()
  cloud?.onAuthChange((user) => {
    if (!user) set({ ...EMPTY, checkedAt: Date.now() })
    else void refreshPro()
  })
  window.setInterval(() => void refreshPro(), 60 * 60 * 1000)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - state.checkedAt > 10 * 60 * 1000) void refreshPro()
  })
}
