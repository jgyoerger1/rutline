/**
 * Property lines. Boundaries and owner mailing addresses come from Ohio's
 * statewide parcel service (OGRIP, all 88 counties, owner names withheld).
 * Counties that publish owner names on their own ArcGIS services are layered
 * on top as adapters and replace the statewide rows for that county. Any
 * other county's ArcGIS parcel layer can be added by the user as a custom
 * source with a field mapping.
 */
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson'
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
  extent: BBox | null
  kind: 'statewide' | 'county' | 'custom'
  recordsUrl?: string
}

export interface Parcel {
  key: string
  sourceId: string
  sourceLabel: string
  parcelId: string
  county: string
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

export const OHIO_STATEWIDE: ParcelSource = {
  id: 'oh-statewide',
  label: 'Ohio Statewide Parcels (OGRIP)',
  shortLabel: 'Ohio statewide',
  url: 'https://services2.arcgis.com/MlJ0G8iWUyC7jAmu/arcgis/rest/services/OhioStatewidePacels_full_view/FeatureServer/0',
  fields: { parcelId: 'LocalParcelID', mailAddress: 'MailAddressAll', situs: 'SitusAddressAll', acres: 'LandArea', landUse: 'StateLUC', county: 'County', link: 'CAMADataSite' },
  county: null,
  extent: [-84.82, 38.4, -80.52, 41.98],
  kind: 'statewide',
  recordsUrl: 'https://ohioparcels-geohio.hub.arcgis.com/',
}

export const COUNTY_SOURCES: ParcelSource[] = [
  {
    id: 'oh-summit',
    label: 'Summit County Fiscal Office',
    shortLabel: 'Summit County',
    url: 'https://services3.arcgis.com/3Ukh5HzAdI6WZ3KP/arcgis/rest/services/TaxParcels_public/FeatureServer/0',
    fields: { parcelId: 'PARCELID', owner: 'OWNERNME1', owner2: 'OWNERNME2', mailParts: ['PSTLADDRESS', 'PSTLCITY', 'PSTLSTATE', 'PSTLZIP5'], situs: 'SITEADDRESS', acres: 'STATEDAREA', landUse: 'USEDSCRP' },
    county: 'Summit',
    extent: [-81.7, 40.98, -81.38, 41.36],
    kind: 'county',
    recordsUrl: 'https://fiscaloffice.summitoh.net/',
  },
  {
    id: 'oh-stark',
    label: 'Stark County Auditor',
    shortLabel: 'Stark County',
    url: 'https://scgisa.starkcountyohio.gov/arcgis/rest/services/Auditor/StarkCountyParcels/FeatureServer/0',
    fields: { parcelId: 'PIN', owner: 'OWNER', mailName: 'MAILING_NAME', mailAddress: 'MAILING_ADDRESS', situs: 'SITE_ADDRESS', acres: 'ACRES', landUse: 'LAND_USE_DESCRIPTION' },
    county: 'Stark',
    extent: [-81.66, 40.63, -81.07, 41.0],
    kind: 'county',
    recordsUrl: 'https://www.starkcountyohio.gov/auditor',
  },
  {
    id: 'oh-geauga',
    label: 'Geauga County Auditor',
    shortLabel: 'Geauga County',
    url: 'https://gcgis.geauga.oh.gov/parcel/rest/services/AzureParcels/Parcels/FeatureServer/0',
    fields: { parcelId: 'PARCEL_ID', owner: 'Oname1', owner2: 'Oname2', mailName: 'MailName1', mailParts: ['MailStreet', 'MailCitySt', 'MailZip'], situs: 'LocDesc', acres: 'ACRES', landUse: 'PropClass' },
    county: 'Geauga',
    extent: [-81.4, 41.34, -80.99, 41.73],
    kind: 'county',
    recordsUrl: 'https://auditor.geauga.oh.gov/',
  },
]

/** Where to look a parcel up by hand when the service withholds the name */
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
    extent: c.extent,
    kind: 'custom',
  }
}

export function bboxIntersects(a: BBox, b: BBox): boolean {
  return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]
}

/** Sources worth asking for this view: statewide if in Ohio, plus adapters and the custom layer that overlap. */
export function sourcesFor(bbox: BBox, custom: CustomParcelSource | null): ParcelSource[] {
  const out: ParcelSource[] = []
  if (custom?.url) {
    const c = customToSource(custom)
    if (!c.extent || bboxIntersects(bbox, c.extent)) out.push(c)
  }
  for (const s of COUNTY_SOURCES) if (s.extent && bboxIntersects(bbox, s.extent)) out.push(s)
  if (OHIO_STATEWIDE.extent && bboxIntersects(bbox, OHIO_STATEWIDE.extent)) out.push(OHIO_STATEWIDE)
  return out
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

  // Adapters and the custom layer win over statewide rows for their county
  const replaced = new Set<string>()
  const parcels: Parcel[] = []
  let truncated = false
  for (const s of sources) {
    const got = bySource.get(s.id)
    if (!got) continue
    truncated ||= got.truncated
    if (s.kind !== 'statewide') {
      parcels.push(...got.parcels)
      if (s.county) replaced.add(s.county.toLowerCase())
      else if (s.kind === 'custom' && s.extent) replaced.add(`extent:${s.id}`)
    }
  }
  const sw = bySource.get(OHIO_STATEWIDE.id)
  if (sw) {
    const customSrc = sources.find((s) => s.kind === 'custom')
    for (const p of sw.parcels) {
      if (replaced.has(p.county.toLowerCase())) continue
      if (customSrc && !customSrc.county && customSrc.extent && pointIn(customSrc.extent, p.centroid)) continue
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

function pointIn(b: BBox, [lat, lon]: [number, number]): boolean {
  return lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3]
}

function outFields(f: ParcelFieldMap): string[] {
  const list = [f.parcelId, f.owner, f.owner2, f.mailName, f.mailAddress, f.situs, f.acres, f.landUse, f.county, f.link, ...(f.mailParts ?? [])]
  return Array.from(new Set(list.filter((x): x is string => !!x)))
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

async function fetchOne(source: ParcelSource, bbox: BBox, signal: AbortSignal): Promise<{ parcels: Parcel[]; truncated: boolean }> {
  const base = new URLSearchParams({
    geometry: bbox.map((v) => v.toFixed(6)).join(','),
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: outFields(source.fields).join(',') || '*',
    returnGeometry: 'true',
    outSR: '4326',
    geometryPrecision: '6',
    resultRecordCount: String(PAGE),
  })
  const url = `${source.url}/query?${base.toString()}&f=geojson`
  let res = await fetch(url, { signal })
  let body: unknown = await res.json()
  let fc = body as { type?: string; features?: Array<{ properties: Record<string, unknown>; geometry: Polygon | MultiPolygon | null }>; exceededTransferLimit?: boolean; properties?: { exceededTransferLimit?: boolean }; error?: { message?: string } }
  if (!res.ok || fc.error || fc.type !== 'FeatureCollection') {
    // Older ArcGIS Servers: ask for Esri JSON and convert
    res = await fetch(`${source.url}/query?${base.toString()}&f=json`, { signal })
    body = await res.json()
    const ej = body as { features?: Array<{ attributes: Record<string, unknown>; geometry?: { rings?: Position[][] } }>; exceededTransferLimit?: boolean; error?: { message?: string } }
    if (ej.error) throw new Error(ej.error.message || 'query rejected')
    fc = {
      type: 'FeatureCollection',
      features: (ej.features ?? []).map((f) => ({ properties: f.attributes, geometry: f.geometry?.rings ? ringsToGeoJSON(f.geometry.rings) : null })),
      exceededTransferLimit: ej.exceededTransferLimit,
    }
  }
  const feats = fc.features ?? []
  const parcels: Parcel[] = []
  for (const f of feats) {
    if (!f.geometry || (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon')) continue
    parcels.push(normalize(source, f.properties ?? {}, f.geometry))
  }
  const truncated = !!(fc.exceededTransferLimit || fc.properties?.exceededTransferLimit) || feats.length >= PAGE
  return { parcels, truncated }
}

const str = (v: unknown): string | null => {
  if (v == null) return null
  const s = String(v).replace(/\s+/g, ' ').trim()
  return s && s !== 'null' ? s : null
}

function normalize(source: ParcelSource, p: Record<string, unknown>, geometry: Polygon | MultiPolygon): Parcel {
  const f = source.fields
  const get = (k?: string) => (k ? str(p[k]) : null)
  const owner = [get(f.owner), get(f.owner2)].filter(Boolean).join(' & ') || null
  let mail = get(f.mailAddress)
  if (!mail && f.mailParts?.length) {
    const parts = f.mailParts.map((k) => str(p[k])).filter((x): x is string => !!x)
    // street, city, state zip
    if (parts.length >= 4) mail = `${parts[0]}, ${parts[1]}, ${parts[2]} ${parts.slice(3).join(' ')}`
    else mail = parts.join(', ') || null
  }
  const county = get(f.county) ?? source.county ?? ''
  const parcelId = get(f.parcelId) ?? ''
  const acresRaw = f.acres ? p[f.acres] : null
  let acres: number | null = acresRaw == null ? null : parseFloat(String(acresRaw))
  if (acres == null || !Number.isFinite(acres) || acres <= 0) acres = round2(areaAcres(geometry))
  const centroid = centroidOf(geometry)
  const link = get(f.link)
  return {
    key: `${source.id}:${parcelId || centroid.map((v) => v.toFixed(5)).join(',')}`,
    sourceId: source.id,
    sourceLabel: source.label,
    parcelId,
    county,
    owner,
    mailName: get(f.mailName),
    mailAddress: mail,
    situs: get(f.situs),
    acres,
    landUse: get(f.landUse),
    link: link && /^https?:\/\//i.test(link) ? link : null,
    recordsUrl: source.kind === 'statewide' ? COUNTY_RECORDS[county] ?? (county ? auditorSearchUrl(county) : null) : source.recordsUrl ?? COUNTY_RECORDS[county] ?? null,
    units: 1,
    geometry,
    centroid,
  }
}

const round2 = (v: number) => Math.round(v * 100) / 100

/** No curated link for this county: send the hunter to a search for its auditor property lookup */
function auditorSearchUrl(county: string): string {
  return 'https://www.google.com/search?q=' + encodeURIComponent(county + ' County Ohio auditor property search')
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
  g.parcelId = pick([/^(parcel_?id|pin|parcelno|parcel_?no|apn|prop_?id|lowparcelid|parcel_?number)$/i, /parcel.*id/i, /^pin/i])
  g.owner = pick([/^(owner|owner1|ownernme1|oname1|owner_?name|ownername1?|own1|deeded_?owner)$/i, /owner.*(name|nme)?1?$/i])
  g.owner2 = pick([/^(owner2|ownernme2|oname2|ownername2|own2)$/i])
  g.mailName = pick([/mail(ing)?_?name1?$/i])
  g.mailAddress = pick([/^mail(ing)?_?(address|addr)(all|1)?$/i, /mail.*address.*all/i])
  if (!g.mailAddress) {
    const street = pick([/mail.*(street|addr1|add1|line1)/i, /^owner_?add(r)?1$/i])
    const city = pick([/mail.*city/i, /^owner_?city$/i])
    const state = pick([/mail.*(state|_st)$/i, /^owner_?stat(e)?$/i])
    const zip = pick([/mail.*zip/i, /^owner_?zip/i])
    const parts = [street, city, state, zip].filter((x): x is string => !!x)
    if (parts.length >= 2) g.mailParts = parts
  }
  g.situs = pick([/^(situs|site_?address|siteaddress|situsaddressall|prop(erty)?_?address|location_?a|locdesc|address)$/i, /situs/i, /site.*addr/i])
  g.acres = pick([/^(acres|acre|acreage|gis_?acres|calc_?acres|land_?area|statedarea|deeded_?acres)$/i, /acre/i])
  g.landUse = pick([/^(land_?use_?desc(ription)?|landuse|luc|stateluc|usedscrp|propclass|class_?desc|use_?code)$/i, /land.?use/i, /class/i])
  g.county = pick([/^county(_?name)?$/i])
  return g
}
