import Dexie, { type EntityTable } from 'dexie'
import type { Photo, Trail, Waypoint, WaypointType } from './types'
import { makeThumb, readExifDate, shrinkImage } from './images'

class RutlineDB extends Dexie {
  waypoints!: EntityTable<Waypoint, 'id'>
  photos!: EntityTable<Photo, 'id'>
  trails!: EntityTable<Trail, 'id'>

  constructor() {
    super('rutline')
    this.version(1).stores({
      waypoints: '++id, type, updatedAt',
      photos: '++id, waypointId, takenAt',
      trails: '++id, kind, updatedAt',
    })
  }
}

export const db = new RutlineDB()

export async function addWaypoint(input: {
  type: WaypointType
  name: string
  lat: number
  lon: number
  note?: string
  goodWinds?: string[]
}): Promise<number> {
  const now = Date.now()
  const id = await db.waypoints.add({
    type: input.type,
    name: input.name,
    lat: input.lat,
    lon: input.lon,
    note: input.note ?? '',
    goodWinds: input.goodWinds ?? [],
    createdAt: now,
    updatedAt: now,
  })
  return id as number
}

export async function updateWaypoint(id: number, patch: Partial<Waypoint>): Promise<void> {
  await db.waypoints.update(id, { ...patch, updatedAt: Date.now() })
}

export async function deleteWaypoint(id: number): Promise<void> {
  await db.transaction('rw', db.waypoints, db.photos, async () => {
    await db.photos.where('waypointId').equals(id).delete()
    await db.waypoints.delete(id)
  })
}

export async function addPhotos(waypointId: number, files: File[] | FileList, caption = ''): Promise<number> {
  const list = Array.from(files)
  let count = 0
  for (const file of list) {
    if (!file.type.startsWith('image/')) continue
    const exif = await readExifDate(file).catch(() => null)
    const full = await shrinkImage(file, 1600, 0.84)
    const thumb = await makeThumb(full.blob, 360)
    await db.photos.add({
      waypointId,
      blob: full.blob,
      thumb,
      takenAt: exif ?? file.lastModified ?? Date.now(),
      addedAt: Date.now(),
      caption,
      width: full.width,
      height: full.height,
    })
    count++
  }
  if (count) await db.waypoints.update(waypointId, { updatedAt: Date.now() })
  return count
}

export async function addPhotoBlob(waypointId: number, blob: Blob, caption = ''): Promise<number> {
  const full = await shrinkImage(blob, 1600, 0.84)
  const thumb = await makeThumb(full.blob, 360)
  const id = await db.photos.add({
    waypointId,
    blob: full.blob,
    thumb,
    takenAt: Date.now(),
    addedAt: Date.now(),
    caption,
    width: full.width,
    height: full.height,
  })
  return id as number
}

export async function deletePhoto(id: number): Promise<void> {
  await db.photos.delete(id)
}

export async function addTrail(input: { name: string; kind: Trail['kind']; points: [number, number][]; note?: string }): Promise<number> {
  const now = Date.now()
  const id = await db.trails.add({ ...input, note: input.note ?? '', createdAt: now, updatedAt: now })
  return id as number
}

export async function updateTrail(id: number, patch: Partial<Trail>): Promise<void> {
  await db.trails.update(id, { ...patch, updatedAt: Date.now() })
}

export async function deleteTrail(id: number): Promise<void> {
  await db.trails.delete(id)
}

// ---------- Backup / restore ----------

interface BackupPhoto extends Omit<Photo, 'blob' | 'thumb'> {
  data: string
}

export interface Backup {
  app: 'rutline'
  version: 1
  exportedAt: string
  waypoints: Waypoint[]
  trails: Trail[]
  photos: BackupPhoto[]
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
  const [waypoints, trails, photos] = await Promise.all([db.waypoints.toArray(), db.trails.toArray(), db.photos.toArray()])
  const out: Backup = {
    app: 'rutline',
    version: 1,
    exportedAt: new Date().toISOString(),
    waypoints,
    trails,
    photos: await Promise.all(
      photos.map(async (p) => {
        const { blob, thumb, ...meta } = p
        void thumb
        return { ...meta, data: await blobToBase64(blob) }
      }),
    ),
  }
  return new Blob([JSON.stringify(out)], { type: 'application/json' })
}

export async function importBackup(file: Blob, mode: 'merge' | 'replace'): Promise<{ waypoints: number; trails: number; photos: number }> {
  const parsed = JSON.parse(await file.text()) as Backup
  if (parsed.app !== 'rutline' && (parsed.app as string) !== 'downwind') throw new Error('That file is not a Rutline backup.')
  const idMap = new Map<number, number>()
  let photos = 0
  await db.transaction('rw', db.waypoints, db.trails, db.photos, async () => {
    if (mode === 'replace') {
      await Promise.all([db.waypoints.clear(), db.trails.clear(), db.photos.clear()])
    }
    for (const w of parsed.waypoints) {
      const { id, ...rest } = w
      const newId = (await db.waypoints.add(rest as Waypoint)) as number
      if (id != null) idMap.set(id, newId)
    }
    for (const t of parsed.trails) {
      const { id, ...rest } = t
      void id
      await db.trails.add(rest as Trail)
    }
    for (const p of parsed.photos) {
      const target = idMap.get(p.waypointId)
      if (target == null) continue
      const blob = base64ToBlob(p.data)
      const thumb = await makeThumb(blob, 360)
      const { data, id, ...meta } = p
      void data
      void id
      await db.photos.add({ ...meta, waypointId: target, blob, thumb })
      photos++
    }
  })
  return { waypoints: parsed.waypoints.length, trails: parsed.trails.length, photos }
}

export async function exportGeoJSON(): Promise<Blob> {
  const [waypoints, trails] = await Promise.all([db.waypoints.toArray(), db.trails.toArray()])
  const fc = {
    type: 'FeatureCollection',
    features: [
      ...waypoints.map((w) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [w.lon, w.lat] },
        properties: { name: w.name, type: w.type, note: w.note, goodWinds: w.goodWinds.join(' ') },
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

export async function clearAll(): Promise<void> {
  await Promise.all([db.waypoints.clear(), db.trails.clear(), db.photos.clear()])
}
