/**
 * Offline-first sync. Local IndexedDB is the source of truth for the UI; every
 * row carries a UUID, a dirty flag and a tombstone. Push sends dirty rows,
 * pull applies rows the server wrote since the last cursor, last write wins
 * by client timestamp. Settings ride along as a profile document.
 */
import { useSyncExternalStore } from 'react'
import { cloud, type CloudUser, type SyncTable } from './cloud'
import type { PushRow, RemoteRow } from './cloud/types'
import { clearLocal, db } from './db'
import { applyRemoteSettings, getSettings, getSettingsUpdatedAt, syncableSettings } from './settings'
import type { Photo, Trail, Waypoint } from './types'

export type SyncState = 'off' | 'idle' | 'syncing' | 'error' | 'offline' | 'switch'

export interface SyncStatus {
  state: SyncState
  lastSyncedAt: number | null
  error: string | null
  pending: number
  /** A different account last used this device; the UI must resolve it */
  switchFrom: string | null
}

const LAST_USER = 'rutline.sync.userId'
const LAST_SYNC = 'rutline.sync.lastAt'

let status: SyncStatus = { state: cloud ? 'idle' : 'off', lastSyncedAt: readNum(LAST_SYNC), error: null, pending: 0, switchFrom: null }
const listeners = new Set<() => void>()
function set(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch }
  listeners.forEach((l) => l())
}
export const getSyncStatus = () => status
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    getSyncStatus,
    getSyncStatus,
  )
}

function readNum(k: string): number | null {
  try {
    const v = localStorage.getItem(k)
    return v ? Number(v) : null
  } catch {
    return null
  }
}
function cursorKey(userId: string, table: SyncTable) {
  return `rutline.sync.cursor.${userId}.${table}`
}
function getCursor(userId: string, table: SyncTable): string | null {
  try {
    return localStorage.getItem(cursorKey(userId, table))
  } catch {
    return null
  }
}
function setCursor(userId: string, table: SyncTable, iso: string) {
  try {
    localStorage.setItem(cursorKey(userId, table), iso)
  } catch {
    /* ignore */
  }
}

let currentUser: CloudUser | null = null
let running = false
let queued = false
let timer: number | null = null
let switchResolver: ((choice: 'merge' | 'clear') => void) | null = null

export async function pendingCount(): Promise<number> {
  const [a, b, c] = await Promise.all([db.waypoints.where('dirty').equals(1).count(), db.trails.where('dirty').equals(1).count(), db.photos.where('dirty').equals(1).count()])
  return a + b + c
}

/** Called by the UI when the user picks what to do with another account's local data */
export function resolveSwitch(choice: 'merge' | 'clear'): void {
  switchResolver?.(choice)
  switchResolver = null
  set({ switchFrom: null })
}

async function prepareUser(user: CloudUser): Promise<void> {
  let last: string | null = null
  try {
    last = localStorage.getItem(LAST_USER)
  } catch {
    /* ignore */
  }
  if (last && last !== user.id) {
    const count = (await db.waypoints.count()) + (await db.trails.count())
    if (count > 0) {
      const choice = await new Promise<'merge' | 'clear'>((resolve) => {
        switchResolver = resolve
        set({ state: 'switch', switchFrom: last })
      })
      if (choice === 'clear') await clearLocal()
      else {
        await db.waypoints.toCollection().modify({ dirty: 1 })
        await db.trails.toCollection().modify({ dirty: 1 })
        await db.photos.toCollection().modify({ dirty: 1, path: null, thumbPath: null, uploadedAt: null })
      }
    }
  }
  try {
    localStorage.setItem(LAST_USER, user.id)
  } catch {
    /* ignore */
  }
}

// ---------- Row mapping ----------

function toPush(table: SyncTable, r: Waypoint | Trail | Photo): PushRow {
  if (table === 'waypoints') {
    const w = r as Waypoint
    return { uid: w.uid, clientUpdatedAt: w.updatedAt, deletedAt: w.deletedAt, type: w.type, lat: w.lat, lon: w.lon, data: { name: w.name, note: w.note, goodWinds: w.goodWinds, owner: w.owner ?? null, createdAt: w.createdAt } }
  }
  if (table === 'trails') {
    const t = r as Trail
    return { uid: t.uid, clientUpdatedAt: t.updatedAt, deletedAt: t.deletedAt, type: t.kind, data: { name: t.name, points: t.points, note: t.note, createdAt: t.createdAt } }
  }
  const p = r as Photo
  return { uid: p.uid, clientUpdatedAt: p.addedAt, deletedAt: p.deletedAt, waypointUid: p.waypointUid, data: { path: p.path, thumbPath: p.thumbPath, takenAt: p.takenAt, addedAt: p.addedAt, caption: p.caption, width: p.width, height: p.height } }
}

async function pushTable(table: SyncTable, userId: string): Promise<void> {
  if (!cloud) return
  const tbl = table === 'waypoints' ? db.waypoints : table === 'trails' ? db.trails : db.photos
  const rows = (await tbl.where('dirty').equals(1).toArray()) as Array<Waypoint | Trail | Photo>
  if (!rows.length) return

  if (table === 'photos') {
    for (const r of rows as Photo[]) {
      if (r.deletedAt) {
        if (r.path) await cloud.deletePhotos([r.path, r.thumbPath ?? ''].filter(Boolean))
        continue
      }
      if (!r.uploadedAt && r.blob && r.thumb) {
        const path = `${userId}/${r.uid}.jpg`
        const thumbPath = `${userId}/${r.uid}.thumb.jpg`
        await cloud.uploadPhoto(path, r.blob)
        await cloud.uploadPhoto(thumbPath, r.thumb)
        r.path = path
        r.thumbPath = thumbPath
        r.uploadedAt = Date.now()
        await db.photos.update(r.id!, { path, thumbPath, uploadedAt: r.uploadedAt })
      }
    }
  }

  const payload = rows.filter((r) => table !== 'photos' || (r as Photo).deletedAt || (r as Photo).path).map((r) => toPush(table, r))
  if (payload.length) await cloud.push(table, payload)

  // Mark clean only if the row did not change while we were pushing; purge pushed tombstones
  for (const r of rows) {
    const cur = (await tbl.get(r.id!)) as Waypoint | Trail | Photo | undefined
    if (!cur) continue
    const stamp = table === 'photos' ? (cur as Photo).addedAt : (cur as Waypoint | Trail).updatedAt
    const was = table === 'photos' ? (r as Photo).addedAt : (r as Waypoint | Trail).updatedAt
    if (stamp !== was || cur.deletedAt !== r.deletedAt) continue
    if (cur.deletedAt) await tbl.delete(r.id!)
    else await tbl.update(r.id!, { dirty: 0 })
  }
}

async function pullTable(table: SyncTable, userId: string): Promise<void> {
  if (!cloud) return
  const since = getCursor(userId, table)
  const remote = await cloud.pull(table, since)
  if (!remote.length) return
  let cursor = since ?? ''
  const thumbsToFetch: number[] = []

  for (const r of remote) {
    if (r.syncedAt > cursor) cursor = r.syncedAt
    if (table === 'waypoints') await applyWaypoint(r)
    else if (table === 'trails') await applyTrail(r)
    else {
      const id = await applyPhoto(r)
      if (id != null) thumbsToFetch.push(id)
    }
  }
  setCursor(userId, table, cursor)

  // Thumbs are small; fetch them now so galleries render. Full images come on open.
  for (let i = 0; i < thumbsToFetch.length; i += 4) {
    await Promise.all(
      thumbsToFetch.slice(i, i + 4).map(async (id) => {
        const p = await db.photos.get(id)
        if (!p || p.thumb || !p.thumbPath) return
        try {
          const blob = await cloud!.downloadPhoto(p.thumbPath)
          await db.photos.update(id, { thumb: blob })
        } catch {
          /* leave for later */
        }
      }),
    )
  }
}

async function applyWaypoint(r: RemoteRow): Promise<void> {
  const local = await db.waypoints.where('uid').equals(r.uid).first()
  if (local?.dirty && local.updatedAt > r.clientUpdatedAt) return
  if (r.deletedAt) {
    if (local) {
      await db.photos.where('waypointId').equals(local.id!).delete()
      await db.waypoints.delete(local.id!)
    }
    return
  }
  const d = r.data
  const row = {
    uid: r.uid,
    type: d.type as Waypoint['type'],
    name: String(d.name ?? ''),
    lat: Number(d.lat),
    lon: Number(d.lon),
    note: String(d.note ?? ''),
    goodWinds: Array.isArray(d.goodWinds) ? (d.goodWinds as string[]) : [],
    owner: (d.owner as Waypoint['owner']) ?? null,
    createdAt: Number(d.createdAt ?? r.clientUpdatedAt),
    updatedAt: r.clientUpdatedAt,
    dirty: 0,
    deletedAt: null,
  }
  if (local) await db.waypoints.put({ ...row, id: local.id } as Waypoint)
  else await db.waypoints.add(row as Waypoint)
}

async function applyTrail(r: RemoteRow): Promise<void> {
  const local = await db.trails.where('uid').equals(r.uid).first()
  if (local?.dirty && local.updatedAt > r.clientUpdatedAt) return
  if (r.deletedAt) {
    if (local) await db.trails.delete(local.id!)
    return
  }
  const d = r.data
  const row = {
    uid: r.uid,
    name: String(d.name ?? ''),
    kind: (d.kind as Trail['kind']) ?? 'trail',
    points: (d.points as [number, number][]) ?? [],
    note: String(d.note ?? ''),
    createdAt: Number(d.createdAt ?? r.clientUpdatedAt),
    updatedAt: r.clientUpdatedAt,
    dirty: 0,
    deletedAt: null,
  }
  if (local) await db.trails.put({ ...row, id: local.id } as Trail)
  else await db.trails.add(row as Trail)
}

/** Returns the local id when a new remote photo was added (its thumb still needs fetching) */
async function applyPhoto(r: RemoteRow): Promise<number | null> {
  const local = await db.photos.where('uid').equals(r.uid).first()
  if (local?.dirty && local.addedAt > r.clientUpdatedAt) return null
  if (r.deletedAt) {
    if (local) await db.photos.delete(local.id!)
    return null
  }
  const d = r.data
  const wpUid = d.waypointUid as string | null
  if (!wpUid) return null
  const wp = await db.waypoints.where('uid').equals(wpUid).first()
  if (!wp) return null
  const row = {
    uid: r.uid,
    waypointId: wp.id!,
    waypointUid: wpUid,
    path: (d.path as string | null) ?? null,
    thumbPath: (d.thumbPath as string | null) ?? null,
    uploadedAt: r.clientUpdatedAt,
    takenAt: Number(d.takenAt ?? r.clientUpdatedAt),
    addedAt: Number(d.addedAt ?? r.clientUpdatedAt),
    caption: String(d.caption ?? ''),
    width: Number(d.width ?? 0),
    height: Number(d.height ?? 0),
    dirty: 0,
    deletedAt: null,
  }
  if (local) {
    await db.photos.put({ ...local, ...row } as Photo)
    return local.thumb ? null : local.id!
  }
  const id = (await db.photos.add({ ...row, blob: null, thumb: null } as Photo)) as number
  return id
}

async function syncSettings(): Promise<void> {
  if (!cloud) return
  const remote = await cloud.getProfile()
  const localAt = getSettingsUpdatedAt()
  if (remote && remote.updatedAt > localAt) applyRemoteSettings(remote.settings, remote.updatedAt)
  else if (localAt > (remote?.updatedAt ?? 0)) await cloud.putProfile(syncableSettings(getSettings()), localAt)
}

// ---------- Orchestration ----------

export async function syncNow(): Promise<void> {
  if (!cloud || !currentUser) return
  if (running) {
    queued = true
    return
  }
  if (!navigator.onLine) {
    set({ state: 'offline', pending: await pendingCount() })
    return
  }
  running = true
  set({ state: 'syncing', error: null })
  try {
    const userId = currentUser.id
    await pushTable('waypoints', userId)
    await pushTable('trails', userId)
    await pushTable('photos', userId)
    await pullTable('waypoints', userId)
    await pullTable('trails', userId)
    await pullTable('photos', userId)
    await syncSettings()
    const at = Date.now()
    try {
      localStorage.setItem(LAST_SYNC, String(at))
    } catch {
      /* ignore */
    }
    set({ state: 'idle', lastSyncedAt: at, error: null, pending: await pendingCount() })
  } catch (e) {
    set({ state: 'error', error: e instanceof Error ? e.message : 'Sync failed', pending: await pendingCount() })
  } finally {
    running = false
    if (queued) {
      queued = false
      void syncNow()
    }
  }
}

export function scheduleSync(delay = 2500): void {
  if (!cloud || !currentUser) return
  if (timer) window.clearTimeout(timer)
  timer = window.setTimeout(() => void syncNow(), delay)
}

let started = false
/** Wire the triggers once: auth changes, edits, settings, connectivity, visibility, a slow heartbeat */
export function startSync(): void {
  if (started || !cloud) return
  started = true
  const onUser = async (user: CloudUser | null) => {
    if (user && user.id === currentUser?.id) return
    currentUser = user
    if (!user) {
      set({ state: 'idle', pending: await pendingCount() })
      return
    }
    await prepareUser(user)
    await syncNow()
  }
  void cloud.getUser().then(onUser)
  cloud.onAuthChange((user, event) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'INITIAL') void onUser(user)
  })
  window.addEventListener('rutline:changed', () => {
    void pendingCount().then((pending) => set({ pending }))
    scheduleSync()
  })
  window.addEventListener('rutline:settings', () => scheduleSync())
  window.addEventListener('online', () => void syncNow())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && (!status.lastSyncedAt || Date.now() - status.lastSyncedAt > 60_000)) void syncNow()
  })
  window.setInterval(() => void syncNow(), 5 * 60_000)
}

export async function signOut(clearDevice: boolean): Promise<void> {
  if (!cloud) return
  if (clearDevice) await clearLocal()
  await cloud.signOut()
  currentUser = null
  set({ state: 'idle', pending: await pendingCount() })
}

/** Soft-delete everything, push the tombstones, then wipe the device */
export async function deleteEverything(): Promise<void> {
  if (!cloud || !currentUser) return
  const now = Date.now()
  await db.photos.toCollection().modify({ deletedAt: now, dirty: 1 })
  await db.waypoints.toCollection().modify({ deletedAt: now, updatedAt: now, dirty: 1 })
  await db.trails.toCollection().modify({ deletedAt: now, updatedAt: now, dirty: 1 })
  await syncNow()
  await clearLocal()
}

export async function deleteAccount(): Promise<void> {
  if (!cloud || !currentUser) return
  const userId = currentUser.id
  await cloud.deleteAccount()
  currentUser = null
  await clearLocal()
  try {
    localStorage.removeItem(LAST_USER)
    for (const t of ['waypoints', 'trails', 'photos'] as SyncTable[]) localStorage.removeItem(cursorKey(userId, t))
  } catch {
    /* ignore */
  }
  set({ state: 'idle', pending: 0 })
}
