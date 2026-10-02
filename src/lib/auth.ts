import { useSyncExternalStore } from 'react'
import { cloud, type CloudUser } from './cloud'
import type { AuthEvent } from './cloud/types'

export interface AuthState {
  /** Null until the first session check finishes */
  ready: boolean
  user: CloudUser | null
  /** Set when the app was opened from a password-reset email */
  recovery: boolean
}

let state: AuthState = { ready: !cloud, user: null, recovery: false }
const listeners = new Set<() => void>()
function set(patch: Partial<AuthState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

if (cloud) {
  void cloud.getUser().then((user) => set({ user, ready: true }))
  cloud.onAuthChange((user, event: AuthEvent) => {
    set({ user, ready: true, recovery: event === 'PASSWORD_RECOVERY' ? true : state.recovery })
    // Clean OAuth / recovery params out of the address bar once consumed
    if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
      const u = new URL(location.href)
      if (u.searchParams.has('code') || /access_token|type=recovery/.test(u.hash)) {
        u.search = ''
        u.hash = '/map'
        history.replaceState(null, '', u.toString())
      }
    }
  })
}

export function getAuth(): AuthState {
  return state
}

export function clearRecovery(): void {
  set({ recovery: false })
}

export function useAuth(): AuthState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    getAuth,
    getAuth,
  )
}
