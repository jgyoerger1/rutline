import { MockBackend } from './mock'
import { SupabaseBackend } from './supabase'
import type { CloudBackend, OAuthProvider } from './types'

export type { CloudBackend, CloudUser, OAuthProvider, SyncTable } from './types'

/** Accept the bare project URL or any of the dashboard's REST/Auth/Storage URLs and keep only the origin */
function projectOrigin(raw: string | undefined): string | undefined {
  const v = raw?.trim()
  if (!v) return undefined
  try {
    return new URL(v.startsWith('http') ? v : 'https://' + v).origin
  } catch {
    return undefined
  }
}

const URL_ = projectOrigin(import.meta.env.VITE_SUPABASE_URL as string | undefined)
const KEY_ = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()
const PROVIDERS = ((import.meta.env.VITE_AUTH_PROVIDERS as string | undefined) ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter((s): s is OAuthProvider => s === 'google' || s === 'apple')

function pick(): CloudBackend | null {
  let mock = false
  try {
    mock = import.meta.env.DEV && localStorage.getItem('rutline.cloud') === 'mock'
  } catch {
    /* no storage */
  }
  if (mock) return new MockBackend()
  if (URL_ && KEY_) return new SupabaseBackend(URL_, KEY_, PROVIDERS)
  return null
}

/** Null when this build has no backend configured: the app then runs on-device only. */
export const cloud: CloudBackend | null = pick()
export const cloudConfigured = cloud !== null
