import { useSyncExternalStore } from 'react'
import { cloud } from './cloud'
import type { Camp, CampMember } from './cloud/types'

export interface CampsState {
  camps: Camp[]
  loaded: boolean
  /** userId -> name to show for shared pins */
  names: Record<string, string>
  myName: string | null
  error: string | null
}

let state: CampsState = { camps: [], loaded: false, names: {}, myName: null, error: null }
const listeners = new Set<() => void>()
function set(patch: Partial<CampsState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
export const getCamps = () => state
export function useCamps(): CampsState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    getCamps,
    getCamps,
  )
}

export function memberLabel(m: Pick<CampMember, 'displayName' | 'email'>): string {
  return m.displayName?.trim() || m.email?.split('@')[0] || 'Camp member'
}

export function nameFor(userId: string | null | undefined): string {
  if (!userId) return 'you'
  return state.names[userId] ?? 'a camp member'
}

export function campName(campId: string | null | undefined): string | null {
  if (!campId) return null
  return state.camps.find((c) => c.id === campId)?.name ?? null
}

/** Reload the camp list and the member-name cache. Cheap; called at the start of each sync. */
export async function refreshCamps(): Promise<Camp[]> {
  if (!cloud) return []
  try {
    const camps = await cloud.listCamps()
    const names: Record<string, string> = { ...state.names }
    await Promise.all(
      camps.map(async (c) => {
        try {
          for (const m of await cloud!.campRoster(c.id)) names[m.userId] = memberLabel(m)
        } catch {
          /* roster is a nicety */
        }
      }),
    )
    set({ camps, names, loaded: true, error: null })
    return camps
  } catch (e) {
    set({ loaded: true, error: e instanceof Error ? e.message : 'Could not load camps' })
    return state.camps
  }
}

export function setMyName(name: string | null): void {
  set({ myName: name })
}

export function resetCamps(): void {
  set({ camps: [], loaded: false, names: {}, myName: null, error: null })
}
