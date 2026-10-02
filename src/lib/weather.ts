import { useCallback, useEffect, useRef, useState } from 'react'
import type { DayData, Forecast, HourData } from './types'

const CACHE_KEY = 'rutline.forecast.v1'
const FRESH_MS = 30 * 60 * 1000

interface OpenMeteo {
  timezone: string
  elevation: number
  hourly: {
    time: string[]
    temperature_2m: number[]
    apparent_temperature: number[]
    relative_humidity_2m: number[]
    dew_point_2m: number[]
    precipitation_probability: (number | null)[]
    precipitation: number[]
    weather_code: number[]
    pressure_msl: number[]
    cloud_cover: number[]
    wind_speed_10m: number[]
    wind_direction_10m: number[]
    wind_gusts_10m: number[]
    is_day: number[]
  }
  daily: {
    time: string[]
    sunrise: string[]
    sunset: string[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    precipitation_sum: number[]
    wind_speed_10m_max: number[]
    wind_direction_10m_dominant: number[]
    weather_code: number[]
  }
}

const HPA_TO_INHG = 0.02952998

export async function fetchForecast(lat: number, lon: number): Promise<Forecast> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', lat.toFixed(4))
  url.searchParams.set('longitude', lon.toFixed(4))
  url.searchParams.set(
    'hourly',
    [
      'temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'dew_point_2m', 'precipitation_probability',
      'precipitation', 'weather_code', 'pressure_msl', 'cloud_cover', 'wind_speed_10m', 'wind_direction_10m',
      'wind_gusts_10m', 'is_day',
    ].join(','),
  )
  url.searchParams.set(
    'daily',
    ['sunrise', 'sunset', 'temperature_2m_max', 'temperature_2m_min', 'precipitation_sum', 'wind_speed_10m_max', 'wind_direction_10m_dominant', 'weather_code'].join(','),
  )
  url.searchParams.set('temperature_unit', 'fahrenheit')
  url.searchParams.set('wind_speed_unit', 'mph')
  url.searchParams.set('precipitation_unit', 'inch')
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('forecast_days', '8')
  url.searchParams.set('past_days', '2')

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Weather service answered ${res.status}.`)
  const d = (await res.json()) as OpenMeteo
  const h = d.hourly
  const hours: HourData[] = h.time.map((iso, i) => ({
    iso,
    time: new Date(iso),
    tempF: h.temperature_2m[i],
    feelsF: h.apparent_temperature[i],
    humidity: h.relative_humidity_2m[i],
    dewF: h.dew_point_2m[i],
    precipProb: h.precipitation_probability[i] ?? 0,
    precipIn: h.precipitation[i] ?? 0,
    code: h.weather_code[i],
    pressureInHg: h.pressure_msl[i] * HPA_TO_INHG,
    cloud: h.cloud_cover[i],
    windMph: h.wind_speed_10m[i],
    windDir: h.wind_direction_10m[i],
    gustMph: h.wind_gusts_10m[i],
    isDay: h.is_day[i] === 1,
  }))
  const dd = d.daily
  const days: DayData[] = dd.time.map((date, i) => ({
    date,
    sunrise: new Date(dd.sunrise[i]),
    sunset: new Date(dd.sunset[i]),
    hiF: dd.temperature_2m_max[i],
    loF: dd.temperature_2m_min[i],
    precipIn: dd.precipitation_sum[i] ?? 0,
    windMaxMph: dd.wind_speed_10m_max[i],
    windDomDir: dd.wind_direction_10m_dominant[i],
    code: dd.weather_code[i],
  }))
  return { lat, lon, tz: d.timezone, elevationFt: Math.round(d.elevation * 3.28084), fetchedAt: Date.now(), hours, days }
}

function cacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`
}

function readCache(lat: number, lon: number): Forecast | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { key: string; forecast: Forecast }
    if (parsed.key !== cacheKey(lat, lon)) return null
    const f = parsed.forecast
    // revive dates
    f.hours = f.hours.map((h) => ({ ...h, time: new Date(h.iso) }))
    f.days = f.days.map((d) => ({ ...d, sunrise: new Date(d.sunrise), sunset: new Date(d.sunset) }))
    return f
  } catch {
    return null
  }
}

function writeCache(lat: number, lon: number, forecast: Forecast): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ key: cacheKey(lat, lon), forecast }))
  } catch {
    /* quota or private mode */
  }
}

export interface ForecastState {
  forecast: Forecast | null
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useForecast(lat: number | null, lon: number | null): ForecastState {
  const [forecast, setForecast] = useState<Forecast | null>(() => (lat != null && lon != null ? readCache(lat, lon) : null))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inflight = useRef<AbortController | null>(null)

  const load = useCallback(
    async (force: boolean) => {
      if (lat == null || lon == null) return
      const cached = readCache(lat, lon)
      if (cached) setForecast(cached)
      if (!force && cached && Date.now() - cached.fetchedAt < FRESH_MS) return
      inflight.current?.abort()
      const ctl = new AbortController()
      inflight.current = ctl
      setLoading(true)
      setError(null)
      try {
        const f = await fetchForecast(lat, lon)
        if (ctl.signal.aborted) return
        writeCache(lat, lon, f)
        setForecast(f)
      } catch (e) {
        if (ctl.signal.aborted) return
        setError(e instanceof Error ? e.message : 'Could not reach the weather service.')
      } finally {
        if (!ctl.signal.aborted) setLoading(false)
      }
    },
    [lat, lon],
  )

  useEffect(() => {
    void load(false)
    const id = window.setInterval(() => void load(false), FRESH_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load(false)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      inflight.current?.abort()
    }
  }, [load])

  return { forecast, loading, error, refresh: () => void load(true) }
}

/** Index of the hour bucket containing `now`, or the nearest one. */
export function nowIndex(f: Forecast, now = new Date()): number {
  const t = now.getTime()
  let best = 0
  for (let i = 0; i < f.hours.length; i++) {
    if (f.hours[i].time.getTime() <= t) best = i
    else break
  }
  return best
}
