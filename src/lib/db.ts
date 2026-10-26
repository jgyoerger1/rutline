import Dexie, { type EntityTable } from 'dexie'
import { cloud, cloudConfigured } from './cloud'
import { makeThumb, readExifDate, shrinkImage } from './images'
import type { Parcel } from './parcels'
import { MAX_TROPHIES, MAX_TROPHY_PHOTOS, type BuckRead, type OfflineArea, type Photo, type Trail, type Trophy, type TrophyPhoto, type Waypoint, type WaypointType } from './types'

class RutlineDB extends Dexie {
  waypoints!: EntityTable<Waypoint, 'id'>
  photos!: EntityTable<Photo, 'id'>
  trails!: EntityTable<Trail, 'id'>
  trophies!: EntityTable<Trophy, 'id'>
  areas!: EntityTable<OfflineArea, 'id'>
  offlineParcels!: EntityTable<{ areaId: number; parcels: Parcel[] }, 'areaId'>

  constructor() {
    super('rutline')
    this.version(1).stores({
      waypoints: '++id, type, updatedAt',
      photos: '++id, waypointId, takenAt',
      trails: '++id, kind, updatedAt',
    })
    // v2: stable UUIDs, dirty flags and tombstones so rows can sync to an account
    this.version(2)
      .stores({
        waypoints: '++id, &uid, type, updatedAt, dirty',
        photos: '++id, &uid, waypointId, waypointUid, takenAt, dirty',
        trails: '++id, &uid, kind, updatedAt, dirty',
      })
      .upgrade(async (tx) => {
        const uidById = new Map<number, string>()
        await tx
          .table('waypoints')
          .toCollection()
          .modify((w: Waypoint) => {
            w.uid = w.uid ?? crypto.randomUUID()
            w.dirty = 1
            w.deletedAt = null
            uidById.set(w.id!, w.uid)
          })
        await tx
          .table('trails')
          .toCollection()
          .modify((t: Trail) => {
            t.uid = t.uid ?? crypto.randomUUID()
            t.dirty = 1
            t.deletedAt = null
          })
        await tx
          .table('photos')
          .toCollection()
          .modify((p: Photo) => {
            p.uid = p.uid ?? crypto.randomUUID()
            p.waypointUid = uidById.get(p.waypointId) ?? null
            p.dirty = 1
            p.deletedAt = null
            p.path = null
            p.thumbPath = null
            p.uploadedAt = null
          })
      })
    // v3: camps. Every row knows its owner (null = me) and the camp it is shared with
    this.version(3)
      .stores({
        waypoints: '++id, &uid, type, updatedAt, dirty, campId',
        photos: '++id, &uid, waypointId, waypointUid, takenAt, dirty, campId',
        trails: '++id, &uid, kind, updatedAt, dirty, campId',
      })
      .upgrade(async (tx) => {
        for (const t of ['waypoints', 'trails', 'photos']) {
          await tx
            .table(t)
            .toCollection()
            .modify((r: { campId?: string | null; ownerId?: string | null }) => {
              r.campId = r.campId ?? null
              r.ownerId = r.ownerId ?? null
            })
        }
      })
    // v4: Trophy Center. Bucks on the hit list live on this device only
    this.version(4).stores({
      waypoints: '++id, &uid, type, updatedAt, dirty, campId',
      photos: '++id, &uid, waypointId, waypointUid, takenAt, dirty, campId',
      trails: '++id, &uid, kind, updatedAt, dirty, campId',
      trophies: '++id, &uid, status, updatedAt',
    })
    // v5: offline areas (tiles live in the service worker cache; parcels here)
    this.version(5).stores({
      waypoints: '++id, &uid, type, updatedAt, dirty, campId',
      photos: '++id, &uid, waypointId, waypointUid, takenAt, dirty, campId',
      trails: '++id, &uid, kind, updatedAt, dirty, campId',
      trophies: '++id, &uid, status, updatedAt',
      areas: '++id, savedAt',
      offlineParcels: 'areaId',
    })
  }
}

export const db = new RutlineDB()

const meta = () => ({ uid: crypto.randomUUID(), dirty: 1, deletedAt: null as number | null, campId: null as string | null, ownerId: null as string | null })

/** Tell the sync engine something changed */
function changed(): void {
  window.dispatchEvent(new CustomEvent('rutline:changed'))
}

// ---------- Live-query helpers (hide tombstones) ----------

export const liveWaypoints = () => db.waypoints.filter((w) => !w.deletedAt).toArray()
export const liveTrails = () => db.trails.filter((t) => !t.deletedAt).toArray()
export const liveWaypointsOfTypes = (types: WaypointType[]) => db.waypoints.where('type').anyOf(types).filter((w) => !w.deletedAt).toArray()
export const livePhotos = (waypointId: number) => db.photos.where('waypointId').equals(waypointId).filter((p) => !p.deletedAt).reverse().sortBy('takenAt')
export const liveCounts = async () => ({
  w: await db.waypoints.filter((w) => !w.deletedAt).count(),
  t: await db.trails.filter((t) => !t.deletedAt).count(),
  p: await db.photos.filter((p) => !p.deletedAt).count(),
})

// ---------- Waypoints ----------

export async function addWaypoint(input: { type: WaypointType; name: string; lat: number; lon: number; note?: string; goodWinds?: string[] }): Promise<number> {
  const now = Date.now()
  const id = await db.waypoints.add({
    ...meta(),
    type: input.type,
    name: input.name,
    lat: input.lat,
    lon: input.lon,
    note: input.note ?? '',
    goodWinds: input.goodWinds ?? [],
    owner: null,
    createdAt: now,
    updatedAt: now,
  })
  changed()
  return id as number
}

export async function updateWaypoint(id: number, patch: Partial<Waypoint>): Promise<void> {
  await db.waypoints.update(id, { ...patch, updatedAt: Date.now(), dirty: 1 })
  changed()
}

/** Share a pin with a camp (or take it private). Its photos follow. */
export async function setWaypointCamp(id: number, campId: string | null): Promise<void> {
  const now = Date.now()
  await db.transaction('rw', db.waypoints, db.photos, async () => {
    await db.waypoints.update(id, { campId, updatedAt: now, dirty: 1 })
    await db.photos.where('waypointId').equals(id).modify({ campId, dirty: 1 })
  })
  changed()
}

export async function deleteWaypoint(id: number): Promise<void> {
  const now = Date.now()
  await db.transaction('rw', db.waypoints, db.photos, async () => {
    if (!cloudConfigured) {
      await db.photos.where('waypointId').equals(id).delete()
      await db.waypoints.delete(id)
      return
    }
    await db.photos.where('waypointId').equals(id).modify({ deletedAt: now, dirty: 1 })
    await db.waypoints.update(id, { deletedAt: now, updatedAt: now, dirty: 1 })
  })
  changed()
}

// ---------- Photos ----------

export async function addPhotos(waypointId: number, files: File[] | FileList, caption = ''): Promise<number> {
  const wp = await db.waypoints.get(waypointId)
  const list = Array.from(files)
  let count = 0
  for (const file of list) {
    if (!file.type.startsWith('image/')) continue
    const exif = await readExifDate(file).catch(() => null)
    const full = await shrinkImage(file, 1600, 0.84)
    const thumb = await makeThumb(full.blob, 360)
    await db.photos.add({
      ...meta(),
      campId: wp?.campId ?? null,
      waypointId,
      waypointUid: wp?.uid ?? null,
      blob: full.blob,
      thumb,
      path: null,
      thumbPath: null,
      uploadedAt: null,
      takenAt: exif ?? file.lastModified ?? Date.now(),
      addedAt: Date.now(),
      caption,
      width: full.width,
      height: full.height,
    })
    count++
  }
  if (count) {
    await db.waypoints.update(waypointId, { updatedAt: Date.now(), dirty: 1 })
    changed()
  }
  return count
}

export async function addPhotoBlob(waypointId: number, blob: Blob, caption = ''): Promise<number> {
  const wp = await db.waypoints.get(waypointId)
  const full = await shrinkImage(blob, 1600, 0.84)
  const thumb = await makeThumb(full.blob, 360)
  const id = await db.photos.add({
    ...meta(),
    campId: wp?.campId ?? null,
    waypointId,
    waypointUid: wp?.uid ?? null,
    blob: full.blob,
    thumb,
    path: null,
    thumbPath: null,
    uploadedAt: null,
    takenAt: Date.now(),
    addedAt: Date.now(),
    caption,
    width: full.width,
    height: full.height,
  })
  changed()
  return id as number
}

export async function updatePhoto(id: number, patch: Partial<Photo>): Promise<void> {
  await db.photos.update(id, { ...patch, dirty: 1 })
  changed()
}

export async function deletePhoto(id: number): Promise<void> {
  if (!cloudConfigured) await db.photos.delete(id)
  else await db.photos.update(id, { deletedAt: Date.now(), dirty: 1 })
  changed()
}

/** Photos that arrived from the account carry only paths until opened. Fetch and keep the bytes. */
export async function ensurePhotoBlob(photo: Photo, which: 'blob' | 'thumb' = 'blob'): Promise<Blob | null> {
  const have = which === 'blob' ? photo.blob : photo.thumb
  if (have) return have
  const path = which === 'blob' ? photo.path : photo.thumbPath
  if (!path || !cloud) return null
  try {
    const data = await cloud.downloadPhoto(path)
    await db.photos.update(photo.id!, which === 'blob' ? { blob: data } : { thumb: data })
    return data
  } catch {
    return null
  }
}

// ---------- Trails ----------

export async function addTrail(input: { name: string; kind: Trail['kind']; points: [number, number][]; note?: string }): Promise<number> {
  const now = Date.now()
  const id = await db.trails.add({ ...meta(), ...input, note: input.note ?? '', createdAt: now, updatedAt: now })
  changed()
  return id as number
}

export async function updateTrail(id: number, patch: Partial<Trail>): Promise<void> {
  await db.trails.update(id, { ...patch, updatedAt: Date.now(), dirty: 1 })
  changed()
}

export async function deleteTrail(id: number): Promise<void> {
  if (!cloudConfigured) await db.trails.delete(id)
  else await db.trails.update(id, { deletedAt: Date.now(), updatedAt: Date.now(), dirty: 1 })
  changed()
}

// ---------- Backup / restore ----------

interface BackupPhoto extends Omit<Photo, 'blob' | 'thumb'> {
  data: string
}
interface BackupTrophy extends Omit<Trophy, 'photos'> {
  photos: Array<Omit<TrophyPhoto, 'blob' | 'thumb'> & { data: string }>
}

export interface Backup {
  app: 'rutline' | 'downwind'
  version: 1 | 2
  exportedAt: string
  waypoints: Waypoint[]
  trails: Trail[]
  photos: BackupPhoto[]
  /** Since the Trophy Center; older backups have none */
  trophies?: BackupTrophy[]
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

function base64ToBlob(b64: string, type = 'image/jpeg'): Blob {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

export async function exportBackup(): Promise<Blob> {
  const [waypoints, trails, photos, trophies] = await Promise.all([liveWaypoints(), liveTrails(), db.photos.filter((p) => !p.deletedAt).toArray(), db.trophies.toArray()])
  const out: Backup = {
    app: 'rutline',
    version: 2,
    exportedAt: new Date().toISOString(),
    waypoints,
    trails,
    photos: await Promise.all(
      photos.map(async (p) => {
        const blob = (await ensurePhotoBlob(p, 'blob')) ?? p.thumb
        const { blob: b, thumb, ...rest } = p
        void b
        void thumb
        return { ...rest, data: blob ? await blobToBase64(blob) : '' }
      }),
    ),
    trophies: await Promise.all(
      trophies.map(async (t) => ({
        ...t,
        photos: await Promise.all(
          t.photos.map(async (p) => {
            const { blob, thumb, ...rest } = p
            void thumb
            return { ...rest, data: await blobToBase64(blob) }
          }),
        ),
      })),
    ),
  }
  return new Blob([JSON.stringify(out)], { type: 'application/json' })
}

export async function importBackup(file: Blob, mode: 'merge' | 'replace'): Promise<{ waypoints: number; trails: number; photos: number; trophies: number }> {
  const parsed = JSON.parse(await file.text()) as Backup
  if (parsed.app !== 'rutline' && parsed.app !== 'downwind') throw new Error('That file is not a Rutline backup.')
  const idByUid = new Map<string, number>()
  const now = Date.now()
  let photos = 0
  let trophies = 0
  await db.transaction('rw', db.waypoints, db.trails, db.photos, db.trophies, async () => {
    if (mode === 'replace') await Promise.all([db.waypoints.clear(), db.trails.clear(), db.photos.clear(), db.trophies.clear()])
    const oldIdToUid = new Map<number, string>()
    for (const w of parsed.waypoints) {
      const { id, ...rest } = w
      const uid = rest.uid ?? crypto.randomUUID()
      if (id != null) oldIdToUid.set(id, uid)
      const existing = await db.waypoints.where('uid').equals(uid).first()
      const row = { ...rest, uid, dirty: 1, deletedAt: null, updatedAt: Math.max(rest.updatedAt ?? 0, now) } as Waypoint
      if (existing) {
        await db.waypoints.put({ ...row, id: existing.id })
        idByUid.set(uid, existing.id!)
      } else {
        const newId = (await db.waypoints.add(row)) as number
        idByUid.set(uid, newId)
      }
    }
    for (const t of parsed.trails) {
      const { id, ...rest } = t
      void id
      const uid = rest.uid ?? crypto.randomUUID()
      const existing = await db.trails.where('uid').equals(uid).first()
      const row = { ...rest, uid, dirty: 1, deletedAt: null, updatedAt: Math.max(rest.updatedAt ?? 0, now) } as Trail
      if (existing) await db.trails.put({ ...row, id: existing.id })
      else await db.trails.add(row)
    }
    for (const p of parsed.photos) {
      const wpUid = p.waypointUid ?? oldIdToUid.get(p.waypointId)
      const target = wpUid ? idByUid.get(wpUid) : undefined
      if (target == null || !wpUid || !p.data) continue
      const blob = base64ToBlob(p.data)
      const thumb = await makeThumb(blob, 360)
      const { data, id, ...rest } = p
      void data
      void id
      const uid = rest.uid ?? crypto.randomUUID()
      const existing = await db.photos.where('uid').equals(uid).first()
      const row = { ...rest, uid, waypointId: target, waypointUid: wpUid, blob, thumb, path: rest.path ?? null, thumbPath: rest.thumbPath ?? null, uploadedAt: null, dirty: 1, deletedAt: null } as Photo
      if (existing) await db.photos.put({ ...row, id: existing.id })
      else await db.photos.add(row)
      photos++
    }
    for (const t of parsed.trophies ?? []) {
      if ((await db.trophies.count()) >= MAX_TROPHIES) break
      const { id, ...rest } = t
      void id
      const uid = rest.uid ?? crypto.randomUUID()
      const restored: TrophyPhoto[] = []
      for (const p of rest.photos.slice(0, MAX_TROPHY_PHOTOS)) {
        if (!p.data) continue
        const { data, ...meta } = p
        const blob = base64ToBlob(data)
        restored.push({ ...meta, blob, thumb: await makeThumb(blob, 360) })
      }
      const existing = await db.trophies.where('uid').equals(uid).first()
      const row = { ...rest, uid, photos: restored, waypointId: null, updatedAt: Math.max(rest.updatedAt ?? 0, now) } as Trophy
      if (existing) await db.trophies.put({ ...row, id: existing.id })
      else await db.trophies.add(row)
      trophies++
    }
  })
  changed()
  return { waypoints: parsed.waypoints.length, trails: parsed.trails.length, photos, trophies }
}

export async function exportGeoJSON(): Promise<Blob> {
  const [waypoints, trails] = await Promise.all([liveWaypoints(), liveTrails()])
  const fc = {
    type: 'FeatureCollection',
    features: [
      ...waypoints.map((w) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [w.lon, w.lat] },
        properties: { name: w.name, type: w.type, note: w.note, goodWinds: w.goodWinds.join(' '), owner: w.owner?.name ?? '', ownerMail: w.owner?.mailAddress ?? '' },
      })),
      ...trails.map((t) => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: t.points.map(([lat, lon]) => [lon, lat]) },
        properties: { name: t.name, type: t.kind, note: t.note },
      })),
    ],
  }
  return new Blob([JSON.stringify(fc, null, 2)], { type: 'application/geo+json' })
}

/** Wipe this device only. Account data, if any, comes back on the next sync. */
export async function clearLocal(): Promise<void> {
  await Promise.all([db.waypoints.clear(), db.trails.clear(), db.photos.clear()])
  // Forget what has been pulled so the account copy comes back in full
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('rutline.sync.cursor.') || k === 'rutline.sync.lastAt') localStorage.removeItem(k)
  } catch {
    /* ignore */
  }
  changed()
}

// Dev-only hook so scripts (store screenshots, tests) can seed data without the UI
if (import.meta.env.DEV) {
  ;(window as unknown as { __rutline?: unknown }).__rutline = { db, addWaypoint, addTrail, addTrophy }
}

// ---------- Trophy Center ----------
// Bucks the hunter is after, with their photos and the latest estimate. Kept
// on this device only (and in backups); nothing here syncs to an account.

export const liveTrophies = () => db.trophies.orderBy('updatedAt').reverse().toArray()

async function toTrophyPhoto(file: Blob): Promise<TrophyPhoto> {
  const full = await shrinkImage(file, 1600, 0.84)
  const thumb = await makeThumb(full.blob, 360)
  return { id: crypto.randomUUID(), blob: full.blob, thumb, width: full.width, height: full.height, addedAt: Date.now() }
}

export async function addTrophy(file: Blob, name?: string): Promise<number> {
  const count = await db.trophies.count()
  if (count >= MAX_TROPHIES) throw new Error(`Trophy Center holds ${MAX_TROPHIES} bucks. Retire one to add another.`)
  const photo = await toTrophyPhoto(file)
  const now = Date.now()
  const id = (await db.trophies.add({
    uid: crypto.randomUUID(),
    name: name?.trim() || `Buck ${count + 1}`,
    status: 'hunting',
    notes: '',
    photos: [photo],
    read: null,
    waypointId: null,
    lastSeen: now,
    createdAt: now,
    updatedAt: now,
  })) as number
  return id
}

export async function updateTrophy(id: number, patch: Partial<Omit<Trophy, 'id' | 'uid' | 'photos' | 'createdAt'>>): Promise<void> {
  await db.trophies.update(id, { ...patch, updatedAt: Date.now() })
}

export async function setTrophyRead(id: number, read: BuckRead | null): Promise<void> {
  await db.trophies.update(id, { read, updatedAt: Date.now() })
}

export async function addTrophyPhoto(id: number, file: Blob): Promise<TrophyPhoto> {
  const t = await db.trophies.get(id)
  if (!t) throw new Error('That buck is gone.')
  if (t.photos.length >= MAX_TROPHY_PHOTOS) throw new Error(`Up to ${MAX_TROPHY_PHOTOS} photos per buck. Remove one first.`)
  const photo = await toTrophyPhoto(file)
  await db.trophies.update(id, { photos: [...t.photos, photo], lastSeen: Date.now(), updatedAt: Date.now() })
  return photo
}

export async function removeTrophyPhoto(id: number, photoId: string): Promise<void> {
  const t = await db.trophies.get(id)
  if (!t) return
  const photos = t.photos.filter((p) => p.id !== photoId)
  const read = t.read && t.read.photoId === photoId ? null : t.read
  await db.trophies.update(id, { photos, read, updatedAt: Date.now() })
}

export async function deleteTrophy(id: number): Promise<void> {
  await db.trophies.delete(id)
}
