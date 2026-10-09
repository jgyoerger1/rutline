/**
 * Read-only polygon overlays from public ArcGIS layers: public land, walk-in
 * access, hunt units. One query per source per view, geometry simplified to
 * about a screen pixel on the server, cached by a quantized view key. What
 * is loaded is kept in a small store so a tap anywhere can ask "what public
 * land, access program and hunt unit is this point in?".
 */
import type { Feature, MultiPolygon, Polygon, Position } from 'geojson'
import { ringsToGeoJSON, type BBox } from './parcels'

export type OverlayKind = 'public' | 'access' | 'units'

export interface OverlaySource {
  id: string
  kind: OverlayKind
  label: string
  /** Two-letter state, or '' for national */
  state: string
  url: string
  extent: BBox
  /** Fields to ask for */
  outFields: string[]
  /** Optional SQL filter */
  where?: string
  maxRecordCount: number
  /** Human page for the program or the regulations */
  infoUrl?: string
  /** e.g. "Wildlife Management Unit" */
  term?: string
  nameField?: string
  idField?: string
  /** Extra attributes to show on tap: [label, field] */
  details?: Array<[string, string]>
}

export interface OverlayFeature {
  key: string
  sourceId: string
  kind: OverlayKind
  props: Record<string, unknown>
  geometry: Polygon | MultiPolygon
  bbox: BBox
}

const cache = new Map<string, { at: number; features: OverlayFeature[]; truncated: boolean }>()
const TTL = 15 * 60 * 1000

/**
 * Ask which features meet the view (IDs only, cheap), then fetch geometry only
 * for features not already held at this level of detail. Big public units
 * (a national forest is one 1.5-million-acre polygon) come back whole however
 * small the view, so each is downloaded once per detail band, not per pan.
 */
const BANDS = [0.004, 0.0012, 0.0004, 0.00015]
const held = new Map<string, Map<string, OverlayFeature>>()
const oidField = new Map<string, string>()
const HOLD = 4000

function bandFor(degPerPx: number): number {
  for (const b of BANDS) if (b <= degPerPx * 1.6) return b
  return BANDS[BANDS.length - 1]
}

export async function queryOverlay(src: OverlaySource, view: BBox, pxWide: number, signal: AbortSignal): Promise<{ features: OverlayFeature[]; truncated: boolean }> {
  const deg = (view[2] - view[0]) / Math.max(256, pxWide)
  const offset = bandFor(deg)
  const q = Math.max(deg * 64, 0.0005)
  const qb: BBox = [Math.floor(view[0] / q) * q, Math.floor(view[1] / q) * q, Math.ceil(view[2] / q) * q, Math.ceil(view[3] / q) * q]
  const key = `${src.id}|${qb.map((v) => v.toFixed(4)).join(',')}|${offset}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL) return hit

  const geo = {
    where: src.where ?? '1=1',
    geometry: qb.map((v) => v.toFixed(5)).join(','),
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
  }
  // 1. Which features are here
  const idRes = await postJson<{ objectIdFieldName?: string; objectIds?: number[] | null; error?: { message?: string } }>(`${src.url}/query`, { ...geo, returnIdsOnly: 'true', f: 'json' }, signal)
  if (idRes.error) throw new Error(idRes.error.message || 'query rejected')
  const idName = idRes.objectIdFieldName ?? oidField.get(src.id) ?? 'OBJECTID'
  oidField.set(src.id, idName)
  const ids = (idRes.objectIds ?? []).slice(0, src.maxRecordCount * 4)
  const truncated = (idRes.objectIds?.length ?? 0) > ids.length

  // 2. Geometry for the ones we do not hold at this detail
  const bucketKey = `${src.id}|${offset}`
  let bucket = held.get(bucketKey)
  if (!bucket) {
    bucket = new Map()
    held.set(bucketKey, bucket)
  }
  const missing = ids.filter((id) => !bucket!.has(String(id)))
  const outFields = Array.from(new Set([idName, ...src.outFields])).join(',')
  for (let i = 0; i < missing.length; i += src.maxRecordCount) {
    const chunk = missing.slice(i, i + src.maxRecordCount)
    const params = {
      objectIds: chunk.join(','),
      outFields,
      returnGeometry: 'true',
      outSR: '4326',
      maxAllowableOffset: String(offset),
      geometryPrecision: offset < 0.0004 ? '6' : '5',
    }
    const raw = await fetchByIds(src, params, signal)
    for (const r of raw) {
      const oid = String(r.id ?? r.properties[idName] ?? '')
      if (!oid || !r.geometry) continue
      const g = r.geometry
      bucket.set(oid, { key: `${src.id}:${oid}`, sourceId: src.id, kind: src.kind, props: r.properties, geometry: g, bbox: bboxOf(g) })
    }
  }
  // Keep memory bounded: drop the oldest held features
  if (bucket.size > HOLD) {
    const drop = bucket.size - HOLD
    let n = 0
    for (const k of bucket.keys()) {
      if (n++ >= drop) break
      bucket.delete(k)
    }
  }
  const features = ids.map((id) => bucket!.get(String(id))).filter((x): x is OverlayFeature => !!x)
  const result = { at: Date.now(), features, truncated }
  if (!signal.aborted) {
    cache.set(key, result)
    if (cache.size > 80) cache.delete(cache.keys().next().value as string)
  }
  return result
}

/** Form-encoded POST: long ID lists fit, and no CORS preflight is needed. */
async function postJson<T>(url: string, params: Record<string, string>, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { method: 'POST', body: new URLSearchParams(params), signal })
  if (!res.ok) throw new Error(`server answered ${res.status}`)
  return (await res.json()) as T
}

async function fetchByIds(src: OverlaySource, params: Record<string, string>, signal: AbortSignal): Promise<Array<RawFeature & { id?: string | number }>> {
  const res = await fetch(`${src.url}/query`, { method: 'POST', body: new URLSearchParams({ ...params, f: 'geojson' }), signal })
  let body: { type?: string; features?: Array<RawFeature & { id?: string | number }>; error?: { message?: string } } = {}
  try {
    body = await res.json()
  } catch {
    body = {}
  }
  if (res.ok && !body.error && body.type === 'FeatureCollection') return (body.features ?? []).filter((f) => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'))
  // Older servers: Esri JSON
  const ej = await postJson<{ features?: Array<{ attributes: Record<string, unknown>; geometry?: { rings?: Position[][] } }>; error?: { message?: string } }>(`${src.url}/query`, { ...params, f: 'json' }, signal)
  if (ej.error) throw new Error(ej.error.message || 'query rejected')
  return (ej.features ?? []).filter((f) => f.geometry?.rings?.length).map((f) => ({ properties: f.attributes, geometry: ringsToGeoJSON(f.geometry!.rings!) }))
}

interface RawFeature {
  properties: Record<string, unknown>
  geometry: Polygon | MultiPolygon | null
}

export function bboxOf(g: Polygon | MultiPolygon): BBox {
  let w = Infinity
  let s = Infinity
  let e = -Infinity
  let n = -Infinity
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  for (const p of polys)
    for (const [x, y] of p[0]) {
      if (x < w) w = x
      if (x > e) e = x
      if (y < s) s = y
      if (y > n) n = y
    }
  return [w, s, e, n]
}

/** Even-odd ray cast over every ring, so holes come out right. */
export function contains(g: Polygon | MultiPolygon, lon: number, lat: number): boolean {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  let inside = false
  for (const poly of polys)
    for (const ring of poly)
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i]
        const [xj, yj] = ring[j]
        if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
      }
  return inside
}

/** A point to hang a label on: the middle of the largest ring's box, nudged inside if it misses. */
export function labelPoint(g: Polygon | MultiPolygon): [number, number] {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  let best = polys[0]
  let bestArea = -1
  for (const p of polys) {
    const b = bboxOf({ type: 'Polygon', coordinates: p })
    const a = (b[2] - b[0]) * (b[3] - b[1])
    if (a > bestArea) {
      bestArea = a
      best = p
    }
  }
  const b = bboxOf({ type: 'Polygon', coordinates: best })
  const cx = (b[0] + b[2]) / 2
  const cy = (b[1] + b[3]) / 2
  const poly: Polygon = { type: 'Polygon', coordinates: best }
  if (contains(poly, cx, cy)) return [cy, cx]
  // Walk a horizontal line through the middle and take the centre of the widest inside run
  const xs: number[] = []
  for (const ring of best)
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]
      const [xj, yj] = ring[j]
      if (yi > cy !== yj > cy) xs.push(((xj - xi) * (cy - yi)) / (yj - yi) + xi)
    }
  xs.sort((a, b2) => a - b2)
  let mid = cx
  let widest = 0
  for (let i = 0; i + 1 < xs.length; i += 2)
    if (xs[i + 1] - xs[i] > widest) {
      widest = xs[i + 1] - xs[i]
      mid = (xs[i] + xs[i + 1]) / 2
    }
  return [cy, mid]
}

// ---------- what is loaded, for point lookups ----------

const loaded = new Map<OverlayKind, OverlayFeature[]>()
const listeners = new Set<() => void>()

export function setLoaded(kind: OverlayKind, features: OverlayFeature[]) {
  loaded.set(kind, features)
  listeners.forEach((l) => l())
}

export function subscribeLoaded(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function overlaysAt(lat: number, lon: number): Record<OverlayKind, OverlayFeature[]> {
  const out: Record<OverlayKind, OverlayFeature[]> = { public: [], access: [], units: [] }
  for (const [kind, list] of loaded)
    for (const f of list) {
      const b = f.bbox
      if (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3]) continue
      if (contains(f.geometry, lon, lat)) out[kind].push(f)
    }
  return out
}

export type { Feature }

if (import.meta.env.DEV) (window as unknown as { __overlaysAt: typeof overlaysAt }).__overlaysAt = overlaysAt
if (import.meta.env.DEV) (window as unknown as { __overlaysLoaded: unknown }).__overlaysLoaded = loaded
