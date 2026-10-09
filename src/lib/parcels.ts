/**
 * Property lines, in layers of trust:
 *  1. Statewide parcel services (STATEWIDE, see parcelRegistry.ts). Some carry
 *     owner names, some only boundaries and mailing addresses.
 *  2. Curated county services that publish owner names (COUNTY_SOURCES).
 *  3. A county's own layer found automatically on ArcGIS Online when nothing
 *     above names the owner (parcelDiscovery.ts).
 *  4. A layer the hunter pasted in Settings.
 * County-level rows replace statewide rows for the same county.
 */
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson'
import { discoveredFor, sameCounty } from './parcelDiscovery'
import { STATEWIDE_SOURCES, COUNTY_REGISTRY } from './parcelRegistry'
import type { CustomParcelSource, ParcelFieldMap } from './types'

export type BBox = [number, number, number, number] // west, south, east, north

export interface ParcelSource {
  id: string
  label: string
  shortLabel: string
  url: string
  fields: ParcelFieldMap
  /** Rows from the statewide layer with this County are replaced by this source */
  county: string | null
  /** Two-letter state code; '' when unknown (custom layers) */
  state: string
  stateName?: string
  extent: BBox | null
  kind: 'statewide' | 'county' | 'discovered' | 'custom'
  recordsUrl?: string
  /** ArcGIS Online account that published a discovered layer */
  publisher?: string
  /** Server page size when it is below 2000; we page with resultOffset */
  pageSize?: number
  /** SQL filter applied to every query */
  where?: string
  /** Owner fields live in a related table, joined on this field */
  ownerTable?: { url: string; joinField: string }
  /** Where owner names are actually present. Default: everywhere the layer has rows. */
  ownerCounties?: { only?: string[]; except?: string[] }
  /** Names are a snapshot from this year; still shown, but county layers are sought */
  ownerAsOf?: number
  /** Names exist for some places but not reliably; keep looking for county layers */
  ownerPartial?: boolean
  /** Server rejects a named field list; ask for every field */
  allFields?: boolean
}

export interface Parcel {
  key: string
  sourceId: string
  sourceLabel: string
  sourceKind: ParcelSource['kind']
  parcelId: string
  county: string
  state: string
  stateName: string
  /** Year of the owner snapshot when the source is old */
  ownerAsOf: number | null
  owner: string | null
  mailName: string | null
  mailAddress: string | null
  situs: string | null
  acres: number | null
  landUse: string | null
  link: string | null
  recordsUrl: string | null
  /** Condo and unit records share one footprint; this is how many stack here */
  units: number
  geometry: Polygon | MultiPolygon
  /** [lat, lon] */
  centroid: [number, number]
}

export const MIN_PARCEL_ZOOM = 15
/** Widest view, in metres across, that we will fetch and draw */
export const MAX_VIEW_METRES = 3600
const PAGE = 2000

export const STATEWIDE: ParcelSource[] = STATEWIDE_SOURCES
export const COUNTY_SOURCES: ParcelSource[] = COUNTY_REGISTRY

/** Where to look a parcel up by hand when the service withholds the name (Ohio counties) */
const COUNTY_RECORDS: Record<string, string> = {
  Portage: 'https://beacon.schneidercorp.com/Application.aspx?App=PortageCountyOH',
  Cuyahoga: 'https://myplace.cuyahogacounty.gov/',
  Medina: 'https://www.medinacountyauditor.org/',
  Trumbull: 'https://www.trumbullcountyauditor.org/',
  Wayne: 'https://www.waynecountyauditor.org/',
  Lake: 'https://www.lakecountyohio.gov/auditor/',
  Ashtabula: 'https://www.ashtabulacounty.us/160/Auditor',
  Mahoning: 'https://www.mahoningcountyoh.gov/179/Auditor',
  Holmes: 'https://www.holmescountyauditor.org/',
  Tuscarawas: 'https://www.co.tuscarawas.oh.us/auditor',
  Columbiana: 'https://www.columbianacountyauditor.org/',
}

export function customToSource(c: CustomParcelSource): ParcelSource {
  return {
    id: 'custom',
    label: c.label || 'Your parcel layer',
    shortLabel: c.label || 'Custom layer',
    url: c.url.replace(/\/query.*$/, '').replace(/\/+$/, ''),
    fields: c.fields,
    county: c.county.trim() || null,
    state: '',
    extent: c.extent,
    kind: 'custom',
  }
}

export function bboxIntersects(a: BBox, b: BBox): boolean {
  return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]
}

/** Sources worth asking for this view: the custom layer, county-level layers, then statewide layers that overlap. */
export function sourcesFor(bbox: BBox, custom: CustomParcelSource | null): ParcelSource[] {
  const out: ParcelSource[] = []
  if (custom?.url) {
    const c = customToSource(custom)
    if (!c.extent || bboxIntersects(bbox, c.extent)) out.push(c)
  }
  for (const s of COUNTY_SOURCES) if (s.extent && bboxIntersects(bbox, s.extent)) out.push(s)
  for (const s of discoveredFor(bbox)) if (!out.some((o) => o.url === s.url)) out.push(s)
  for (const s of STATEWIDE) if (s.extent && bboxIntersects(bbox, s.extent)) out.push(s)
  return out
}

/** True when some source in the list names current owners for this county. */
export function namesOwnersFor(sources: ParcelSource[], state: string, county: string): boolean {
  const thisYear = new Date().getFullYear()
  return sources.some((s) => {
    if (!s.fields.owner) return false
    if (s.kind === 'custom') return true
    if (s.state !== state) return false
    if (s.kind !== 'statewide') return sameCounty(s.county, county)
    if (s.ownerAsOf && thisYear - s.ownerAsOf > 2) return false
    if (s.ownerPartial) return false
    const oc = s.ownerCounties
    if (oc?.only) return oc.only.some((c) => sameCounty(c, county))
    if (oc?.except) return !oc.except.some((c) => sameCounty(c, county))
    return true
  })
}

export interface ParcelResult {
  parcels: Parcel[]
  truncated: boolean
  sources: string[]
  errors: string[]
}

const cache = new Map<string, { at: number; result: ParcelResult }>()
const TTL = 10 * 60 * 1000

function quantize(bbox: BBox): BBox {
  const q = 0.004
  return [Math.floor(bbox[0] / q) * q, Math.floor(bbox[1] / q) * q, Math.ceil(bbox[2] / q) * q, Math.ceil(bbox[3] / q) * q]
}

export async function fetchParcelsFor(bbox: BBox, custom: CustomParcelSource | null, signal: AbortSignal): Promise<ParcelResult> {
  const sources = sourcesFor(bbox, custom)
  const qb = quantize(bbox)
  const key = `${sources.map((s) => s.id).join('+')}|${qb.map((v) => v.toFixed(3)).join(',')}|${custom?.url ?? ''}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL) return hit.result
  if (!sources.length) return { parcels: [], truncated: false, sources: [], errors: [] }

  const settled = await Promise.allSettled(sources.map((s) => fetchTiled(s, qb, signal, 0)))
  const errors: string[] = []
  const bySource = new Map<string, { parcels: Parcel[]; truncated: boolean }>()
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') bySource.set(sources[i].id, r.value)
    else errors.push(`${sources[i].shortLabel}: ${r.reason instanceof Error ? r.reason.message : 'failed'}`)
  })

  // County-level layers (curated, discovered, custom) win over statewide rows for their county.
  // Where a statewide layer carries no county name, drop statewide rows that sit on a county-level parcel.
  const replaced = new Set<string>()
  const parcels: Parcel[] = []
  const grid = new Set<string>()
  const cell = ([lat, lon]: [number, number]) => `${Math.round(lat / 0.0004)},${Math.round(lon / 0.0004)}`
  let truncated = false
  for (const s of sources) {
    const got = bySource.get(s.id)
    if (!got) continue
    truncated ||= got.truncated
    if (s.kind === 'statewide') continue
    for (const p of got.parcels) {
      if (parcels.some((q) => q.key === p.key)) continue
      parcels.push(p)
      grid.add(cell(p.centroid))
    }
    if (s.county) replaced.add(`${s.state}|${s.county.toLowerCase()}`)
  }
  for (const s of sources) {
    if (s.kind !== 'statewide') continue
    const got = bySource.get(s.id)
    if (!got) continue
    for (const p of got.parcels) {
      if (p.county && replaced.has(`${p.state}|${p.county.toLowerCase()}`)) continue
      if (grid.size && grid.has(cell(p.centroid))) continue
      parcels.push(p)
    }
  }
  // Condominiums come back as one identical polygon per unit. Keep one, count the rest,
  // and pool the owner names so the sheet can say "12 units" instead of painting a white slab.
  const byFootprint = new Map<string, Parcel>()
  for (const p of parcels) {
    const sig = [p.centroid[0].toFixed(6), p.centroid[1].toFixed(6), (p.acres ?? 0).toFixed(3)].join(',')
    const seen = byFootprint.get(sig)
    if (!seen) byFootprint.set(sig, p)
    else {
      seen.units += 1
      if (!seen.owner && p.owner) seen.owner = p.owner
      if (!seen.mailAddress && p.mailAddress) seen.mailAddress = p.mailAddress
    }
  }
  const collapsed = Array.from(byFootprint.values())
  const result: ParcelResult = { parcels: collapsed, truncated, sources: sources.filter((s) => bySource.has(s.id)).map((s) => s.label), errors }
  if (!signal.aborted) {
    cache.set(key, { at: Date.now(), result })
    if (cache.size > 60) cache.delete(cache.keys().next().value as string)
  }
  return result
}

function outFields(f: ParcelFieldMap): string[] {
  const list = [f.parcelId, f.owner, f.owner2, f.mailName, f.mailAddress, f.situs, f.acres, f.landUse, f.county, f.link, ...(f.mailParts ?? []), ...(f.mailLines ?? []), ...(f.situsParts ?? [])]
  return Array.from(new Set(list.filter((x): x is string => !!x)))
}

/** Owner fields kept in a related table: fetch them for these parcels and merge them in. */
async function joinOwnerTable(source: ParcelSource, feats: Array<{ properties: Record<string, unknown> }>, signal: AbortSignal) {
  const t = source.ownerTable!
  const ids = Array.from(new Set(feats.map((f) => f.properties[t.joinField]).filter((v): v is string | number => v != null && v !== '')))
  const rows = new Map<string, Record<string, unknown>>()
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    const where = `${t.joinField} IN (${chunk.map((v) => (typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`)).join(',')})`
    // POST: a hundred IDs overflow some servers' URL limits. Form-encoded POST needs no CORS preflight.
    const body = new URLSearchParams({ where, outFields: '*', returnGeometry: 'false', f: 'json' })
    const res = await fetch(`${t.url}/query`, { method: 'POST', body, signal })
    let j: { features?: Array<{ attributes: Record<string, unknown> }> } = {}
    try {
      j = await res.json()
    } catch {
      continue // an HTML error page: leave these parcels without the joined fields
    }
    for (const r of j.features ?? []) rows.set(String(r.attributes[t.joinField]), r.attributes)
  }
  for (const f of feats) {
    const r = rows.get(String(f.properties[t.joinField]))
    if (r) for (const [k, v] of Object.entries(r)) if (f.properties[k] == null || f.properties[k] === '') f.properties[k] = v
  }
}

/**
 * ArcGIS caps a query at 2000 rows. When a view overflows, split it into
 * quadrants (one level, so at most 4 requests) and merge by parcel key.
 */
async function fetchTiled(source: ParcelSource, bbox: BBox, signal: AbortSignal, depth: number): Promise<{ parcels: Parcel[]; truncated: boolean }> {
  const first = await fetchOne(source, bbox, signal)
  if (!first.truncated || depth >= 1) return first
  const [w, s, e, n] = bbox
  const mx = (w + e) / 2
  const my = (s + n) / 2
  const quads: BBox[] = [
    [w, s, mx, my],
    [mx, s, e, my],
    [w, my, mx, n],
    [mx, my, e, n],
  ]
  const parts = await Promise.all(quads.map((q) => fetchTiled(source, q, signal, depth + 1)))
  const seen = new Map<string, Parcel>()
  for (const part of parts) for (const p of part.parcels) if (!seen.has(p.key)) seen.set(p.key, p)
  return { parcels: Array.from(seen.values()), truncated: parts.some((x) => x.truncated) }
}

type RawParcel = { properties: Record<string, unknown>; geometry: Polygon | MultiPolygon | null }

async function fetchPage(source: ParcelSource, params: URLSearchParams, signal: AbortSignal): Promise<{ feats: RawParcel[]; exceeded: boolean }> {
  let res = await fetch(`${source.url}/query?${params.toString()}&f=geojson`, { signal })
  let body: unknown = await res.json()
  const fc = body as { type?: string; features?: RawParcel[]; exceededTransferLimit?: boolean; properties?: { exceededTransferLimit?: boolean }; error?: { message?: string } }
  if (res.ok && !fc.error && fc.type === 'FeatureCollection') return { feats: fc.features ?? [], exceeded: !!(fc.exceededTransferLimit || fc.properties?.exceededTransferLimit) }
  // Older ArcGIS Servers: ask for Esri JSON and convert
  res = await fetch(`${source.url}/query?${params.toString()}&f=json`, { signal })
  body = await res.json()
  const ej = body as { features?: Array<{ attributes: Record<string, unknown>; geometry?: { rings?: Position[][] } }>; exceededTransferLimit?: boolean; error?: { message?: string } }
  if (ej.error) throw new Error(ej.error.message || 'query rejected')
  return { feats: (ej.features ?? []).map((f) => ({ properties: f.attributes, geometry: f.geometry?.rings ? ringsToGeoJSON(f.geometry.rings) : null })), exceeded: !!ej.exceededTransferLimit }
}

async function fetchOne(source: ParcelSource, bbox: BBox, signal: AbortSignal): Promise<{ parcels: Parcel[]; truncated: boolean }> {
  const size = Math.min(PAGE, source.pageSize ?? PAGE)
  const params = new URLSearchParams({
    where: source.where ?? '1=1',
    geometry: bbox.map((v) => v.toFixed(6)).join(','),
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    // A joined owner table means the polygon layer lacks some mapped fields; take what it has
    outFields: source.ownerTable || source.allFields ? '*' : outFields(source.fields).join(',') || '*',
    returnGeometry: 'true',
    outSR: '4326',
    geometryPrecision: '6',
    resultRecordCount: String(size),
  })
  // Small server pages: walk them until we hold about PAGE parcels
  const maxPages = Math.max(1, Math.ceil(PAGE / size))
  const feats: RawParcel[] = []
  let exceeded = false
  for (let page = 0; page < maxPages; page++) {
    if (page) params.set('resultOffset', String(page * size))
    const r = await fetchPage(source, params, signal)
    feats.push(...r.feats)
    exceeded = r.exceeded || r.feats.length >= size
    if (!exceeded) break
  }
  if (source.ownerTable && feats.length) await joinOwnerTable(source, feats, signal)
  const parcels: Parcel[] = []
  for (const f of feats) {
    if (!f.geometry || (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon')) continue
    parcels.push(normalize(source, f.properties ?? {}, f.geometry))
  }
  return { parcels, truncated: exceeded }
}

const str = (v: unknown): string | null => {
  if (v == null) return null
  const s = String(v).replace(/\s+/g, ' ').trim()
  return s && s !== 'null' ? s : null
}

/** Street parts..., city, state, zip. The last three are always city, state and zip when four or more are listed. */
function joinAddress(values: Array<string | null>): string | null {
  if (values.length >= 4) {
    const street = values.slice(0, -3).filter(Boolean).join(' ')
    const [city, st, zip] = values.slice(-3)
    const tail = [st, zip].filter(Boolean).join(' ')
    return [street, city, tail].filter(Boolean).join(', ') || null
  }
  return values.filter(Boolean).join(', ') || null
}

function normalize(source: ParcelSource, p: Record<string, unknown>, geometry: Polygon | MultiPolygon): Parcel {
  const f = source.fields
  const get = (k?: string) => (k ? str(p[k]) : null)
  const o1 = get(f.owner)
  const o2 = get(f.owner2)
  const owner = [o1, o2 && o2 !== o1 ? o2 : null].filter(Boolean).join(' & ') || null
  let mail = get(f.mailAddress)
  if (!mail && f.mailParts?.length) mail = joinAddress(f.mailParts.map((k) => str(p[k])))
  if (!mail && f.mailLines?.length) mail = f.mailLines.map((k) => str(p[k])).filter(Boolean).join(', ') || null
  let situs = get(f.situs)
  if (situs && /^0+$/.test(situs)) situs = null
  if (!situs && f.situsParts?.length) {
    const vals = f.situsParts.map((k) => str(p[k]))
    const last = f.situsParts[f.situsParts.length - 1]
    if (/city/i.test(last) && f.situsParts.length > 1) situs = [vals.slice(0, -1).filter(Boolean).join(' '), vals[vals.length - 1]].filter(Boolean).join(', ') || null
    else situs = vals.filter(Boolean).join(' ') || null
  }
  const county = get(f.county) ?? source.county ?? ''
  const parcelId = get(f.parcelId) ?? ''
  const acresRaw = f.acres ? p[f.acres] : null
  let acres: number | null = acresRaw == null ? null : parseFloat(String(acresRaw))
  if (acres == null || !Number.isFinite(acres) || acres <= 0) acres = round2(areaAcres(geometry))
  const centroid = centroidOf(geometry)
  const link = get(f.link)
  const stateName = source.stateName ?? STATE_NAMES[source.state] ?? ''
  const ohioCurated = source.state === 'OH' ? COUNTY_RECORDS[county] : undefined
  return {
    key: `${source.id}:${parcelId || centroid.map((v) => v.toFixed(5)).join(',')}`,
    sourceId: source.id,
    sourceLabel: source.label,
    sourceKind: source.kind,
    parcelId,
    county,
    state: source.state,
    stateName,
    ownerAsOf: source.ownerAsOf ?? null,
    owner,
    mailName: get(f.mailName),
    mailAddress: mail,
    situs,
    acres,
    landUse: get(f.landUse),
    link: link && /^https?:\/\//i.test(link) ? link : null,
    recordsUrl: source.kind === 'statewide' ? ohioCurated ?? (county ? auditorSearchUrl(county, stateName) : null) : source.recordsUrl ?? ohioCurated ?? null,
    units: 1,
    geometry,
    centroid,
  }
}

const round2 = (v: number) => Math.round(v * 100) / 100

/** No curated link for this county: send the hunter to a search for its property lookup */
export function auditorSearchUrl(county: string, stateName: string): string {
  return 'https://www.google.com/search?q=' + encodeURIComponent(`${county} County ${stateName} property records owner search`)
}

export const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
}

/** Esri rings to GeoJSON. Esri outer rings run clockwise, holes counter-clockwise. */
export function ringsToGeoJSON(rings: Position[][]): Polygon | MultiPolygon {
  const polys: Position[][][] = []
  for (const ring of rings) {
    if (ring.length < 4) continue
    if (signedArea(ring) < 0 || polys.length === 0) polys.push([ring])
    else polys[polys.length - 1].push(ring)
  }
  if (polys.length === 1) return { type: 'Polygon', coordinates: polys[0] }
  return { type: 'MultiPolygon', coordinates: polys }
}

/** Shoelace in lon/lat; negative = clockwise (Esri outer ring) */
function signedArea(ring: Position[]): number {
  let s = 0
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[(i + 1) % n]
    s += x1 * y2 - x2 * y1
  }
  return s / 2
}

function ringsOf(g: Polygon | MultiPolygon): Position[][][] {
  return g.type === 'Polygon' ? [g.coordinates] : g.coordinates
}

/** Equirectangular area, good to well under a percent at parcel scale */
export function areaAcres(g: Polygon | MultiPolygon): number {
  let m2 = 0
  for (const poly of ringsOf(g)) {
    poly.forEach((ring, i) => {
      const lat0 = (ring.reduce((s, p) => s + p[1], 0) / ring.length) * (Math.PI / 180)
      const kx = 111320 * Math.cos(lat0)
      const ky = 110540
      let a = 0
      for (let j = 0, n = ring.length; j < n; j++) {
        const [x1, y1] = ring[j]
        const [x2, y2] = ring[(j + 1) % n]
        a += x1 * kx * (y2 * ky) - x2 * kx * (y1 * ky)
      }
      m2 += (i === 0 ? 1 : -1) * Math.abs(a / 2)
    })
  }
  return Math.max(0, m2) / 4046.856
}

export function centroidOf(g: Polygon | MultiPolygon): [number, number] {
  let w = Infinity
  let s = Infinity
  let e = -Infinity
  let n = -Infinity
  for (const poly of ringsOf(g)) {
    for (const [x, y] of poly[0]) {
      if (x < w) w = x
      if (x > e) e = x
      if (y < s) s = y
      if (y > n) n = y
    }
  }
  return [(s + n) / 2, (w + e) / 2]
}

export function boundsOf(g: Polygon | MultiPolygon): [[number, number], [number, number]] {
  let w = Infinity
  let s = Infinity
  let e = -Infinity
  let n = -Infinity
  for (const poly of ringsOf(g)) {
    for (const [x, y] of poly[0]) {
      if (x < w) w = x
      if (x > e) e = x
      if (y < s) s = y
      if (y > n) n = y
    }
  }
  return [
    [s, w],
    [n, e],
  ]
}

export function toFeatureCollection(parcels: Parcel[]): FeatureCollection<Polygon | MultiPolygon, { key: string }> {
  return {
    type: 'FeatureCollection',
    features: parcels.map((p): Feature<Polygon | MultiPolygon, { key: string }> => ({ type: 'Feature', properties: { key: p.key }, geometry: p.geometry })),
  }
}

// ---------- Custom source helpers ----------

export interface LayerInfo {
  name: string
  geometryType: string | null
  fields: Array<{ name: string; alias: string; type: string }>
  extent: BBox | null
  guess: ParcelFieldMap
}

/** Read a layer's metadata so the user can map fields without reading docs. */
export async function inspectLayer(rawUrl: string): Promise<LayerInfo> {
  const url = rawUrl.trim().replace(/\/query.*$/, '').replace(/\/+$/, '')
  if (!/\/(FeatureServer|MapServer)\/\d+$/i.test(url)) throw new Error('Paste a layer URL that ends in /FeatureServer/0 or /MapServer/0.')
  const res = await fetch(`${url}?f=json`)
  if (!res.ok) throw new Error(`The server answered ${res.status}.`)
  const j = (await res.json()) as { name?: string; geometryType?: string; fields?: Array<{ name: string; alias?: string; type: string }>; extent?: { xmin: number; ymin: number; xmax: number; ymax: number; spatialReference?: { wkid?: number; latestWkid?: number } }; error?: { message?: string } }
  if (j.error) throw new Error(j.error.message || 'The server rejected the request.')
  if (j.geometryType && j.geometryType !== 'esriGeometryPolygon') throw new Error('That layer is not polygons. Parcel layers are polygon layers.')
  const fields = (j.fields ?? []).map((f) => ({ name: f.name, alias: f.alias ?? f.name, type: f.type.replace('esriFieldType', '') }))
  let extent: BBox | null = null
  if (j.extent) {
    const wkid = j.extent.spatialReference?.latestWkid ?? j.extent.spatialReference?.wkid
    if (wkid === 4326) extent = [j.extent.xmin, j.extent.ymin, j.extent.xmax, j.extent.ymax]
    else if (wkid === 3857 || wkid === 102100) {
      const toLon = (x: number) => (x / 20037508.34) * 180
      const toLat = (y: number) => (Math.atan(Math.exp((y / 20037508.34) * Math.PI)) * 360) / Math.PI - 90
      extent = [toLon(j.extent.xmin), toLat(j.extent.ymin), toLon(j.extent.xmax), toLat(j.extent.ymax)]
    }
  }
  return { name: j.name ?? 'Layer', geometryType: j.geometryType ?? null, fields, extent, guess: guessFields(fields.map((f) => f.name)) }
}

export function guessFields(names: string[]): ParcelFieldMap {
  const pick = (res: RegExp[]) => {
    for (const re of res) {
      const hit = names.find((n) => re.test(n))
      if (hit) return hit
    }
    return undefined
  }
  const g: ParcelFieldMap = {}
  const notName = /addr|street|city|state|zip|mail|type|code|count|id$|flag|pct|percent|date/i
  g.parcelId = pick([/^(parcel_?id|pin|parcelno|parcel_?no|apn|prop_?id|lowparcelid|parcel_?number)$/i, /parcel.*id/i, /^pin/i])
  g.owner =
    pick([/^(deeded_?owner|owner|owner_?1|ownernme1|oname1|owner_?name1?|ownername1?|own1|own_?name1?|ownname|taxpayer(_?name)?1?|grantee)$/i]) ??
    names.find((n) => /owner_?(name|nme)?_?1?$/i.test(n) && !notName.test(n))
  g.owner2 = pick([/^(owner_?2|ownernme2|oname2|owner_?name_?2|ownername2|own2|own_?name_?2)$/i])
  g.mailName = pick([/mail(ing)?_?name1?$/i])
  g.mailAddress = pick([/^mail(ing)?_?(address|addr)(all|1)?$/i, /mail.*address.*all/i, /^(owner|own|pstl|taxp?)_?(full_?)?(mail_?)?address$/i])
  if (!g.mailAddress) {
    // Street may be one field or number + direction + name + suffix; then city, state, zip
    const pre = '(mail(ing)?|pstl|own(er)?|taxp(ayer)?)_?'
    const one = pick([new RegExp(`^${pre}(street|addr(ess)?_?1?|add1|line_?1|str(eet)?_?addr)$`, 'i'), /mail.*(street|addr1|add1|line1)/i])
    const split = ['(street_?)?(number|no|num)', '(street_?)?dir(ection)?', 'street_?name', '(street_?)?suffix'].map((s) => pick([new RegExp(`^${pre}${s}$`, 'i')]))
    const street = one ? [one] : split.filter((x): x is string => !!x)
    const city = pick([new RegExp(`^${pre}city$`, 'i'), /mail.*city/i])
    const state = pick([new RegExp(`^${pre}(state|st)$`, 'i'), /mail.*(state|_st)$/i])
    const zip = pick([new RegExp(`^${pre}zip(code|5)?$`, 'i'), /mail.*zip/i])
    if (street.length && (city || zip)) g.mailParts = [...street, city ?? '', state ?? '', zip ?? ''].filter((x, i, a) => x || i >= a.length - 3)
    if (g.mailParts?.some((x) => !x)) g.mailParts = g.mailParts.filter(Boolean)
  }
  g.situs = pick([/^(situs|site_?address|siteaddress|situsaddressall|situs_?address|prop(erty)?_?address|location_?a|locdesc|address|full_?address|loc_?address)$/i, /situs.*addr/i, /site.*addr/i])
  if (!g.situs) {
    const pre = '(m?loc|site|situs|prop(erty)?)_?'
    const parts = ['(str(eet)?_?)?(no|num|number)', '(str(eet)?_?)?dir', 'str(eet)?_?name', '(str(eet)?_?)?suffix', 'city'].map((s) => pick([new RegExp(`^${pre}${s}$`, 'i')]))
    const got = parts.filter((x): x is string => !!x)
    if (got.length >= 2) g.situsParts = got
  }
  g.acres = pick([/^(acres|acre|acreage|gis_?acres|calc_?acres|land_?area|statedarea|deeded_?acres)$/i, /acre/i])
  g.landUse = pick([/^(land_?use_?desc(ription)?|landuse|luc|stateluc|usedscrp|propclass|class_?desc|use_?code)$/i, /land.?use/i, /class/i])
  g.county = pick([/^county(_?name)?$/i])
  return g
}

if (import.meta.env.DEV) (window as unknown as { __fetchParcels: typeof fetchParcelsFor }).__fetchParcels = fetchParcelsFor
