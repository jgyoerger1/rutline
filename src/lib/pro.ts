import { useSyncExternalStore } from 'react'
import { cloud } from './cloud'
import { IAP_CONFIGURED, getStatus, identify, onChange } from './iap'
import { isNative } from './native'

/**
 * A native build with no RevenueCat key has no way to buy Pro, and Apple's
 * reviewers reject locked features with no purchase path, so such a build
 * (TestFlight before in-app purchase) runs fully unlocked. Once the key is in
 * the build (repo variable VITE_REVENUECAT_IOS_KEY) Pro is sold in-app and
 * this switches itself off.
 */
export const NATIVE_PREVIEW = isNative && !IAP_CONFIGURED
/**
 * Repo variable VITE_PRO_PREVIEW=1 opens Pro to everyone on every build, web
 * included, while testers kick the tires. Delete the variable to start selling.
 */
export const PRO_PREVIEW = (import.meta.env.VITE_PRO_PREVIEW as string | undefined)?.trim() === '1'
const UNLOCKED = NATIVE_PREVIEW || PRO_PREVIEW

/**
 * Rutline Pro. The app is free; Pro is a season pass (12 months) that opens
 * the terrain overlay, unlimited blood tracking, the full week of HuntCast,
 * Trophy Center, the whole field guide and camps. The entitlement lives on
 * the account (entitlements table, written only by the server), is cached on
 * the device so it holds up offline, and is re-checked on sign-in and hourly.
 */
export type ProFeature = 'all' | 'terrain' | 'landowner' | 'offline' | 'tracker' | 'huntcast' | 'trophies' | 'guide' | 'camps'

export const PRO_PRICE = (import.meta.env.VITE_PRO_PRICE as string | undefined)?.trim() || '$19.99'
/** Stripe Payment Link for the season pass; empty until Jordan creates one */
export const PAYMENT_LINK = (import.meta.env.VITE_STRIPE_PAYMENT_LINK as string | undefined)?.trim() || ''
export const FREE_TRACK_SECONDS = 5 * 60
export const FREE_FORECAST_DAYS = 2

export const PRO_BENEFITS: Array<{ id: ProFeature; title: string; body: string }> = [
  { id: 'terrain', title: 'Slope and 5-foot contours', body: 'The detailed lidar layers: slope steepness and 5-foot contours for benches, saddles and draws. Hillshade stays free.' },
  { id: 'landowner', title: 'Landowner details and permission letters', body: 'Owner of record and mailing address on any parcel, and a permission letter written for you. Property lines stay free.' },
  { id: 'offline', title: 'Offline areas', body: 'Save the map and the property lines for ground with no signal, at every zoom you use in the woods.' },
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

const PREVIEW: ProState = { pro: true, until: null, source: NATIVE_PREVIEW ? 'native-preview' : 'preview', checkedAt: 0 }

function load(): ProState {
  if (UNLOCKED) return PREVIEW
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
      if (UNLOCKED) {
        set({ ...PREVIEW, checkedAt: Date.now() })
        return state
      }
      if (import.meta.env.DEV && localStorage.getItem('rutline.pro') === '1') {
        set({ pro: true, until: Date.now() + 365 * 86400e3, source: 'dev', checkedAt: Date.now() })
        return state
      }
      // The App Store receipt (through RevenueCat) and the account both count; the later end date wins
      const store = IAP_CONFIGURED ? await getStatus().catch(() => undefined) : null
      const user = cloud ? await cloud.getUser() : null
      const ent = user && cloud ? await cloud.getEntitlement() : null
      const fromStore = store?.until ? { until: store.until, source: store.sandbox ? 'app-store-sandbox' : 'app-store' } : null
      const fromAccount = ent?.proUntil ? { until: ent.proUntil, source: ent.source ?? 'account' } : null
      const best = [fromStore, fromAccount].filter((x): x is { until: number; source: string } => x !== null).sort((a, b) => b.until - a.until)[0] ?? null
      // Store unreachable and nothing on the account: keep the pass the store granted last time
      if (!best && store === undefined && state.source?.startsWith('app-store')) return state
      set({ pro: best !== null && best.until > Date.now(), until: best?.until ?? null, source: best?.source ?? null, checkedAt: Date.now() })
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
  onChange(() => void refreshPro())
  cloud?.onAuthChange((user) => {
    if (UNLOCKED) return
    // The receipt follows the account: signing in merges a purchase made signed out
    void identify(user?.id ?? null)
      .catch(() => undefined)
      .then(() => {
        if (!user && !IAP_CONFIGURED) set({ ...EMPTY, checkedAt: Date.now() })
        else void refreshPro()
      })
  })
  window.setInterval(() => void refreshPro(), 60 * 60 * 1000)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - state.checkedAt > 10 * 60 * 1000) void refreshPro()
  })
}
