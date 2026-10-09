/**
 * Finding a county's own parcel layer when no curated or statewide source
 * gives owner names. Most U.S. counties publish their tax parcels on
 * ArcGIS, and most of those services are public. For the county under the
 * map we search ArcGIS Online for parcel services whose extent covers the
 * spot, rank them (county-run servers and recent "tax parcel" layers first),
 * then open each candidate and keep the first polygon layer that has an
 * owner-name field and answers a point query with a real name.
 *
 * Results are remembered per county on this device: a hit for 30 days, a
 * miss for 7, and anything the hunter marks as wrong is never offered again.
 */
import type { BBox, ParcelSource } from './parcels'
import { guessFields } from './parcels'

export interface CountyRef {
  fips: string
  county: string
  state: string
  stateName: string
}

interface CacheEntry {
  at: number
  source: ParcelSource | null
}

const COUNTY_KEY = 'rutline.parcels.county.v1'
const FOUND_KEY = 'rutline.parcels.found.v1'
const REJECT_KEY = 'rutline.parcels.rejected.v1'
const HIT_TTL = 30 * 86400000
const MISS_TTL = 7 * 86400000

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full or blocked: discovery still works, it just repeats */
  }
}

// ---------- which county is this ----------

const countyMem = new Map<string, CountyRef | null>()

/** County and state at a point, from the FCC's census area API (free, no key, CORS open). Cached on a ~2 km grid. */
export async function countyAt(lat: number, lon: number, signal?: AbortSignal): Promise<CountyRef | null> {
  const cell = `${(Math.round(lat * 50) / 50).toFixed(2)},${(Math.round(lon * 50) / 50).toFixed(2)}`
  if (countyMem.has(cell)) return countyMem.get(cell)!
  const stored = read<Record<string, CountyRef>>(COUNTY_KEY, {})
  if (stored[cell]) {
    countyMem.set(cell, stored[cell])
    return stored[cell]
  }
  const res = await fetch(`https://geo.fcc.gov/api/census/area?lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}&censusYear=2020&format=json`, { signal })
  if (!res.ok) throw new Error(`County lookup failed (${res.status})`)
  const j = (await res.json()) as { results?: Array<{ county_fips?: string; county_name?: string; state_code?: string; state_name?: string }> }
  const r = j.results?.[0]
  const ref = r?.county_fips ? { fips: r.county_fips, county: stripCountyWord(r.county_name ?? ''), state: r.state_code ?? '', stateName: r.state_name ?? '' } : null
  countyMem.set(cell, ref)
  if (ref) {
    const keys = Object.keys(stored)
    if (keys.length > 400) for (const k of keys.slice(0, 100)) delete stored[k]
    stored[cell] = ref
    write(COUNTY_KEY, stored)
  }
  return ref
}

export function stripCountyWord(name: string): string {
  return name.replace(/\s+(County|Parish|Borough|Census Area|Municipality|City and Borough)$/i, '').trim()
}

export function sameCounty(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  return stripCountyWord(a).toLowerCase() === stripCountyWord(b).toLowerCase()
}

// ---------- the cache ----------

export function discoveredFor(bbox: BBox): ParcelSource[] {
  const found = read<Record<string, CacheEntry>>(FOUND_KEY, {})
  const out: ParcelSource[] = []
  for (const e of Object.values(found)) {
    const s = e.source
    if (!s?.extent || Date.now() - e.at > HIT_TTL) continue
    if (s.extent[0] < bbox[2] && s.extent[2] > bbox[0] && s.extent[1] < bbox[3] && s.extent[3] > bbox[1]) out.push(s)
  }
  return out
}

/** undefined = never looked; null = looked recently and found nothing */
export function cachedDiscovery(fips: string): ParcelSource | null | undefined {
  const e = read<Record<string, CacheEntry>>(FOUND_KEY, {})[fips]
  if (!e) return undefined
  const age = Date.now() - e.at
  if (e.source ? age > HIT_TTL : age > MISS_TTL) return undefined
  return e.source
}

function remember(fips: string, source: ParcelSource | null) {
  const found = read<Record<string, CacheEntry>>(FOUND_KEY, {})
  found[fips] = { at: Date.now(), source }
  write(FOUND_KEY, found)
}

/** The hunter says this layer is wrong for the county: forget it and never offer it again. */
export function rejectDiscovered(sourceId: string) {
  const found = read<Record<string, CacheEntry>>(FOUND_KEY, {})
  const rejected = read<string[]>(REJECT_KEY, [])
  for (const [k, e] of Object.entries(found)) {
    if (e.source?.id !== sourceId) continue
    if (!rejected.includes(e.source.url)) rejected.push(e.source.url)
    delete found[k]
  }
  write(REJECT_KEY, rejected)
  write(FOUND_KEY, found)
}

// ---------- the search ----------

interface Item {
  id: string
  title: string
  owner: string
  url?: string
  access: string
  type: string
  tags?: string[]
  modified: number
  numViews?: number
  extent?: number[][]
}

const inflight = new Map<string, Promise<ParcelSource | null>>()

export function discoverCounty(ref: CountyRef, lat: number, lon: number): Promise<ParcelSource | null> {
  const cached = cachedDiscovery(ref.fips)
  if (cached !== undefined) return Promise.resolve(cached)
  const running = inflight.get(ref.fips)
  if (running) return running
  const p = run(ref, lat, lon)
    .then((s) => {
      remember(ref.fips, s)
      return s
    })
    .catch(() => null)
    .finally(() => inflight.delete(ref.fips))
  inflight.set(ref.fips, p)
  return p
}

async function getJson<T>(url: string, ms = 9000): Promise<T> {
  const ctl = new AbortController()
  const t = window.setTimeout(() => ctl.abort(), ms)
  try {
    const res = await fetch(url, { signal: ctl.signal })
    if (!res.ok) throw new Error(String(res.status))
    return (await res.json()) as T
  } finally {
    window.clearTimeout(t)
  }
}

async function run(ref: CountyRef, lat: number, lon: number): Promise<ParcelSource | null> {
  const rejected = new Set(read<string[]>(REJECT_KEY, []))
  const d = 0.02
  const q = `"${ref.county}" AND (parcel OR parcels OR "tax parcel" OR "tax parcels" OR cadastral OR property) AND (type:"Feature Service" OR type:"Map Service")`
  const url = `https://www.arcgis.com/sharing/rest/search?q=${encodeURIComponent(q)}&bbox=${[lon - d, lat - d, lon + d, lat + d].map((v) => v.toFixed(4)).join(',')}&num=60&f=json`
  const s = await getJson<{ results?: Item[] }>(url)
  const countyWord = ref.county.toLowerCase().replace(/[^a-z]/g, '')
  const ranked = (s.results ?? [])
    .filter((it) => it.access === 'public' && it.url && !rejected.has(it.url))
    .map((it) => {
      const [[x0, y0], [x1, y1]] = it.extent?.length === 2 ? it.extent : [[-180, -90], [180, 90]]
      const area = (x1 - x0) * (y1 - y0)
      const contains = lon >= x0 && lon <= x1 && lat >= y0 && lat <= y1
      const title = it.title.toLowerCase()
      const host = (() => {
        try {
          return new URL(it.url!).hostname.toLowerCase()
        } catch {
          return ''
        }
      })()
      let score = 0
      if (/parcel|cadastr/.test(title)) score += 4
      else if (/tax|property|land ?records/.test(title)) score += 2
      if ((it.tags ?? []).some((t) => /parcel|cadastr/i.test(t))) score += 1
      if (title.replace(/[^a-z]/g, '').includes(countyWord)) score += 1
      // A county's own server, or an org account that looks like the county
      if (!/arcgis\.com$/.test(host) && host.replace(/[^a-z]/g, '').includes(countyWord)) score += 3
      if (/\.(gov|us)$/.test(host) || /gov|county|co\./i.test(it.owner)) score += 2
      if (/wfl1|_copy|copy of|test|sample|crime|soil|zoning|flood|sales|vacant|hydric/i.test(it.title)) score -= 3
      if (Date.now() - it.modified < 2 * 365 * 86400000) score += 1
      return { it, area, contains, score }
    })
    .filter((c) => c.contains && c.area < 12)
    .sort((a, b) => b.score - a.score || a.area - b.area)
    .slice(0, 8)

  for (const c of ranked) {
    const found = await tryService(c.it, ref, lat, lon).catch(() => null)
    if (found) return found
  }
  return null
}

const OWNER_STRICT = /^(deeded_?owner|owner|owner_?1|ownernme1|oname1|owner_?name1?|ownername1?|own1|own_?name1?|ownname|taxpayer(_?name)?1?|name_?1|grantee)$/i
const OWNER_LOOSE = /owner_?(name|nme)?_?1?$/i
const NOT_A_NAME = /addr|street|city|state|zip|mail|type|code|count|id$|flag|occ|pct|percent|date/i

function ownerField(names: string[]): string | undefined {
  return names.find((n) => OWNER_STRICT.test(n)) ?? names.find((n) => OWNER_LOOSE.test(n) && !NOT_A_NAME.test(n))
}

async function tryService(item: Item, ref: CountyRef, lat: number, lon: number): Promise<ParcelSource | null> {
  const base = item.url!.replace(/\/+$/, '')
  let layerUrls: string[]
  if (/\/(FeatureServer|MapServer)\/\d+$/i.test(base)) layerUrls = [base]
  else {
    const svc = await getJson<{ layers?: Array<{ id: number; name: string; geometryType?: string; subLayerIds?: number[] | null }> }>(`${base}?f=json`)
    const layers = (svc.layers ?? []).filter((l) => !l.subLayerIds?.length && (!l.geometryType || l.geometryType === 'esriGeometryPolygon'))
    const named = layers.filter((l) => /parcel|tax|cadast|propert|lot|owner/i.test(l.name))
    layerUrls = (named.length ? named : layers.length <= 2 ? layers : []).slice(0, 4).map((l) => `${base}/${l.id}`)
  }
  for (const lu of layerUrls) {
    const meta = await getJson<{ name?: string; geometryType?: string; capabilities?: string; fields?: Array<{ name: string }> }>(`${lu}?f=json`)
    if (meta.geometryType !== 'esriGeometryPolygon') continue
    if (meta.capabilities && !/query/i.test(meta.capabilities)) continue
    const names = (meta.fields ?? []).map((f) => f.name)
    const owner = ownerField(names)
    if (!owner) continue
    const probe = await getJson<{ features?: Array<{ attributes: Record<string, unknown> }>; error?: unknown }>(
      `${lu}/query?geometry=${lon.toFixed(6)},${lat.toFixed(6)}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=${encodeURIComponent(owner)}&returnGeometry=false&f=json`,
    )
    const val = String(probe.features?.[0]?.attributes?.[owner] ?? '').trim()
    if (!val || /^\d+$/.test(val) || /redact|confidential|withheld|not available|unknown/i.test(val)) continue
    const fields = guessFields(names)
    fields.owner = owner
    const [[x0, y0], [x1, y1]] = item.extent!
    return {
      id: `found:${ref.fips}`,
      label: item.title.trim(),
      shortLabel: `${ref.county} County`,
      url: lu,
      fields,
      county: ref.county,
      state: ref.state,
      stateName: ref.stateName,
      extent: [x0, y0, x1, y1],
      kind: 'discovered',
      recordsUrl: `https://www.arcgis.com/home/item.html?id=${item.id}`,
      publisher: item.owner,
    }
  }
  return null
}
