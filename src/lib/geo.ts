export const DIRS16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'] as const
export const DIRS8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const

export function degToCompass(deg: number, points: 8 | 16 = 16): string {
  const list = points === 8 ? DIRS8 : DIRS16
  const step = 360 / list.length
  const i = Math.round((((deg % 360) + 360) % 360) / step) % list.length
  return list[i]
}

export function compassToDeg(name: string): number {
  const i = (DIRS16 as readonly string[]).indexOf(name)
  return i < 0 ? 0 : i * 22.5
}

/** Smallest angle between two bearings, 0..180 */
export function angleDiff(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360
  return d > 180 ? 360 - d : d
}

export type WindFit = 'good' | 'marginal' | 'bad' | 'unset'

/** How a forecast wind (direction it blows FROM) suits a stand's huntable winds */
export function windFit(windFromDeg: number, goodWinds: string[]): WindFit {
  if (!goodWinds.length) return 'unset'
  let best = 999
  for (const g of goodWinds) best = Math.min(best, angleDiff(windFromDeg, compassToDeg(g)))
  if (best <= 25) return 'good'
  if (best <= 50) return 'marginal'
  return 'bad'
}

export function haversineM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371000
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export function fmtDistance(m: number, units: 'imperial' | 'metric'): string {
  if (units === 'metric') return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`
  const yd = m * 1.09361
  return yd < 1000 ? `${Math.round(yd)} yd` : `${(yd / 1760).toFixed(2)} mi`
}

export function fmtCoord(lat: number, lon: number): string {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`
}

export function locate(options: PositionOptions = {}): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('This device has no location service.'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, (e) => reject(new Error(describeGeoError(e))), {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 10000,
      ...options,
    })
  })
}

export function describeGeoError(e: GeolocationPositionError): string {
  switch (e.code) {
    case e.PERMISSION_DENIED:
      return 'Location permission was denied. Allow it in your browser settings, or search for your ground instead.'
    case e.POSITION_UNAVAILABLE:
      return 'No GPS fix yet. Try again in the open.'
    case e.TIMEOUT:
      return 'The GPS took too long. Try again.'
    default:
      return 'Could not get your location.'
  }
}

export interface Place {
  name: string
  admin1?: string
  country?: string
  lat: number
  lon: number
}

export async function searchPlaces(query: string): Promise<Place[]> {
  const [namePart, regionPart] = query.split(',').map((s) => s.trim())
  if (!namePart) return []
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  url.searchParams.set('name', namePart)
  url.searchParams.set('count', '10')
  url.searchParams.set('language', 'en')
  url.searchParams.set('format', 'json')
  const res = await fetch(url)
  if (!res.ok) throw new Error('Place search is unavailable right now.')
  const data = (await res.json()) as { results?: Array<{ name: string; admin1?: string; country?: string; country_code?: string; latitude: number; longitude: number }> }
  let results = data.results ?? []
  if (regionPart) {
    const r = regionPart.toLowerCase()
    const filtered = results.filter((x) => (x.admin1 ?? '').toLowerCase().startsWith(r) || (x.country_code ?? '').toLowerCase() === r)
    if (filtered.length) results = filtered
  }
  return results.slice(0, 6).map((x) => ({ name: x.name, admin1: x.admin1, country: x.country, lat: x.latitude, lon: x.longitude }))
}

export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&localityLanguage=en`
    const res = await fetch(url)
    if (!res.ok) return null
    const d = (await res.json()) as { locality?: string; city?: string; principalSubdivisionCode?: string; principalSubdivision?: string }
    const town = d.locality || d.city
    const state = d.principalSubdivisionCode?.split('-')[1] || d.principalSubdivision
    if (town && state) return `${town}, ${state}`
    return town || state || null
  } catch {
    return null
  }
}
