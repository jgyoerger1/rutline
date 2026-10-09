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

export async function queryOverlay(src: OverlaySource, view: BBox, pxWide: number, signal: AbortSignal): Promise<{ features: OverlayFeature[]; truncated: boolean }> {
  // Simplify to roughly one screen pixel; quantize the view so small pans reuse the cache
  const deg = (view[2] - view[0]) / Math.max(256, pxWide)
  const q = Math.max(deg * 64, 0.0005)
  const qb: BBox = [Math.floor(view[0] / q) * q, Math.floor(view[1] / q) * q, Math.ceil(view[2] / q) * q, Math.ceil(view[3] / q) * q]
  const offset = Number((deg * 1.2).toPrecision(2))
  const key = `${src.id}|${qb.map((v) => v.toFixed(4)).join(',')}|${offset}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL) return hit

  const params = new URLSearchParams({
    where: src.where ?? '1=1',
    geometry: qb.map((v) => v.toFixed(5)).join(','),
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: src.outFields.join(',') || '*',
    returnGeometry: 'true',
    outSR: '4326',
    maxAllowableOffset: String(offset),
    geometryPrecision: offset < 0.0001 ? '6' : '5',
    resultRecordCount: String(src.maxRecordCount),
  })
  const features: OverlayFeature[] = []
  let truncated = false
  // Up to three pages; national forests in a wide view can run long
  for (let page = 0; page < 3; page++) {
    if (page) params.set('resultOffset', String(page * src.maxRecordCount))
    const r = await fetchPage(src, params, signal)
    for (const f of r.features) features.push(toFeature(src, f, features.length))
    truncated = r.exceeded
    if (!r.exceeded) break
  }
  const result = { at: Date.now(), features, truncated }
  if (!signal.aborted) {
    cache.set(key, result)
    if (cache.size > 80) cache.delete(cache.keys().next().value as string)
  }
  return result
}

interface RawFeature {
  properties: Record<string, unknown>
  geometry: Polygon | MultiPolygon | null
}

async function fetchPage(src: OverlaySource, params: URLSearchParams, signal: AbortSignal): Promise<{ features: RawFeature[]; exceeded: boolean }> {
  let res = await fetch(`${src.url}/query?${params.toString()}&f=geojson`, { signal })
  const body = (await res.json()) as { type?: string; features?: RawFeature[]; exceededTransferLimit?: boolean; properties?: { exceededTransferLimit?: boolean }; error?: { message?: string } }
  if (res.ok && !body.error && body.type === 'FeatureCollection') {
    return { features: (body.features ?? []).filter((f) => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')), exceeded: !!(body.exceededTransferLimit || body.properties?.exceededTransferLimit) }
  }
  // Older servers: Esri JSON
  res = await fetch(`${src.url}/query?${params.toString()}&f=json`, { signal })
  const ej = (await res.json()) as { features?: Array<{ attributes: Record<string, unknown>; geometry?: { rings?: Position[][] } }>; exceededTransferLimit?: boolean; error?: { message?: string } }
  if (ej.error) throw new Error(ej.error.message || 'query rejected')
  return {
    features: (ej.features ?? []).filter((f) => f.geometry?.rings?.length).map((f) => ({ properties: f.attributes, geometry: ringsToGeoJSON(f.geometry!.rings!) })),
    exceeded: !!ej.exceededTransferLimit,
  }
}

function toFeature(src: OverlaySource, f: RawFeature, i: number): OverlayFeature {
  const g = f.geometry as Polygon | MultiPolygon
  const id = src.idField ? f.properties[src.idField] : f.properties.OBJECTID ?? f.properties.objectid ?? f.properties.FID ?? i
  return { key: `${src.id}:${String(id)}:${i}`, sourceId: src.id, kind: src.kind, props: f.properties, geometry: g, bbox: bboxOf(g) }
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
