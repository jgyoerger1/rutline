/**
 * Offline areas. A saved area is the map tiles for a box at every zoom a
 * hunter uses in the woods, plus the parcels inside it. Tiles go through the
 * service worker's cache (the same one that keeps tiles you have looked at),
 * so Leaflet finds them with no signal; parcels are kept in the database and
 * the parcel layer falls back to them when the county server cannot be reached.
 */
import { LAYERS, tileUrl } from './basemaps'
import { db } from './db'
import { boundsOf, fetchParcelsFor, type BBox, type Parcel } from './parcels'
import type { CustomParcelSource, MapLayer, OfflineArea } from './types'

export const MAX_TILES_PER_AREA = 3000
const MIN_ZOOM = 12
const MAX_ZOOM = 17
const CONCURRENCY = 6
const PARCEL_CELL_DEG = 0.028 // about 3 km, under the parcel layer's view limit

function lon2x(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** z)
}
function lat2y(lat: number, z: number): number {
  const r = (lat * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z)
}

export function zoomsFor(layer: MapLayer): [number, number] {
  return [MIN_ZOOM, Math.min(MAX_ZOOM, LAYERS[layer].maxNativeZoom)]
}

/** Every tile URL the area needs at every zoom, with the tile count per zoom */
export function tilesFor(bbox: BBox, layer: MapLayer): string[] {
  const [zmin, zmax] = zoomsFor(layer)
  const urls: string[] = []
  for (let z = zmin; z <= zmax; z++) {
    const x0 = lon2x(bbox[0], z)
    const x1 = lon2x(bbox[2], z)
    const y0 = lat2y(bbox[3], z)
    const y1 = lat2y(bbox[1], z)
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) urls.push(tileUrl(layer, z, x, y))
  }
  return urls
}

export function estimate(bbox: BBox, layer: MapLayer): { tiles: number; mb: number; tooBig: boolean } {
  const tiles = tilesFor(bbox, layer).length
  return { tiles, mb: Math.round((tiles * LAYERS[layer].tileBytes) / 1048576), tooBig: tiles > MAX_TILES_PER_AREA }
}

/** The service worker that keeps tiles exists only in the built app */
export function offlineStorageReady(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller
}

export interface SaveProgress {
  phase: 'tiles' | 'parcels' | 'done'
  done: number
  total: number
  parcels: number
}

export async function saveArea(name: string, bbox: BBox, layer: MapLayer, custom: CustomParcelSource | null, onProgress: (p: SaveProgress) => void, signal?: AbortSignal): Promise<number> {
  const urls = tilesFor(bbox, layer)
  if (urls.length > MAX_TILES_PER_AREA) throw new Error('That area is too big to save. Zoom in a step and try again.')

  // Tiles: fetched so the service worker caches them; opaque responses are fine
  let done = 0
  let failed = 0
  const queue = [...urls]
  const worker = async () => {
    while (queue.length) {
      if (signal?.aborted) return
      const url = queue.shift()!
      try {
        await fetch(url, { mode: 'no-cors', cache: 'force-cache', signal })
      } catch {
        failed++
      }
      done++
      if (done % 10 === 0 || done === urls.length) onProgress({ phase: 'tiles', done, total: urls.length, parcels: 0 })
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  if (signal?.aborted) throw new Error('Cancelled')
  if (failed > urls.length / 2) throw new Error('Most tiles did not download. Check the signal and try again.')

  // Parcels: the layer fetches by view, so walk the box in view-sized cells
  const seen = new Map<string, Parcel>()
  const cells: BBox[] = []
  for (let w = bbox[0]; w < bbox[2]; w += PARCEL_CELL_DEG) for (let s = bbox[1]; s < bbox[3]; s += PARCEL_CELL_DEG) cells.push([w, s, Math.min(w + PARCEL_CELL_DEG, bbox[2]), Math.min(s + PARCEL_CELL_DEG, bbox[3])])
  let cellsDone = 0
  for (const cell of cells) {
    if (signal?.aborted) throw new Error('Cancelled')
    try {
      const r = await fetchParcelsFor(cell, custom, signal ?? new AbortController().signal)
      for (const p of r.parcels) seen.set(p.key, p)
    } catch {
      /* a cell with no server is not fatal */
    }
    cellsDone++
    onProgress({ phase: 'parcels', done: cellsDone, total: cells.length, parcels: seen.size })
  }

  const parcels = [...seen.values()]
  const area: OfflineArea = { name, bbox, layer, zooms: zoomsFor(layer), tiles: urls.length - failed, parcels: parcels.length, mb: Math.round((urls.length * LAYERS[layer].tileBytes) / 1048576), savedAt: Date.now() }
  const id = (await db.areas.add(area)) as number
  await db.offlineParcels.put({ areaId: id, parcels })
  onProgress({ phase: 'done', done: urls.length, total: urls.length, parcels: parcels.length })
  return id
}

export async function deleteArea(id: number): Promise<void> {
  const area = await db.areas.get(id)
  await db.offlineParcels.delete(id)
  await db.areas.delete(id)
  if (!area) return
  // Drop the area's tiles from the service worker cache, unless another area still needs them
  try {
    const others = await db.areas.toArray()
    const keep = new Set(others.flatMap((a) => tilesFor(a.bbox, a.layer)))
    const cache = await caches.open('tiles')
    for (const url of tilesFor(area.bbox, area.layer)) if (!keep.has(url)) await cache.delete(url)
  } catch {
    /* no cache API, nothing to clean */
  }
}

export const liveAreas = () => db.areas.orderBy('savedAt').reverse().toArray()

function intersects(a: BBox, b: BBox): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]
}

/** Parcels from saved areas that touch this view, for when the county server is out of reach */
export async function offlineParcelsIn(bbox: BBox): Promise<Parcel[]> {
  const areas = (await db.areas.toArray()).filter((a) => intersects(a.bbox, bbox))
  if (!areas.length) return []
  const out = new Map<string, Parcel>()
  for (const a of areas) {
    const row = await db.offlineParcels.get(a.id!)
    for (const p of row?.parcels ?? []) {
      const [[s, w], [n, e]] = boundsOf(p.geometry)
      if (intersects([w, s, e, n], bbox)) out.set(p.key, p)
    }
  }
  return [...out.values()]
}
