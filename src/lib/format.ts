import type { Units } from './types'

export function fmtTemp(f: number, units: Units, withUnit = true): string {
  if (units === 'metric') return `${Math.round(((f - 32) * 5) / 9)}${withUnit ? '°C' : '°'}`
  return `${Math.round(f)}${withUnit ? '°F' : '°'}`
}

export function fmtDelta(f: number, units: Units): string {
  const v = units === 'metric' ? (f * 5) / 9 : f
  const r = Math.round(v)
  return `${r > 0 ? '+' : ''}${r}°`
}

export function fmtSpeed(mph: number, units: Units): string {
  if (units === 'metric') return `${Math.round(mph * 1.60934)} km/h`
  return `${Math.round(mph)} mph`
}

export function fmtPressure(inHg: number, units: Units): string {
  if (units === 'metric') return `${Math.round(inHg * 33.8639)} hPa`
  return `${inHg.toFixed(2)} inHg`
}

export function fmtPressureDelta(inHg: number, units: Units): string {
  if (units === 'metric') {
    const v = inHg * 33.8639
    return `${v > 0 ? '+' : ''}${v.toFixed(1)} hPa`
  }
  return `${inHg > 0 ? '+' : ''}${inHg.toFixed(2)}`
}

export function fmtPrecip(inch: number, units: Units): string {
  if (units === 'metric') return `${(inch * 25.4).toFixed(1)} mm`
  return `${inch.toFixed(2)} in`
}

export function fmtHour(d: Date): string {
  const h = d.getHours()
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hh = h % 12 === 0 ? 12 : h % 12
  return `${hh} ${ampm}`
}

export function fmtHourShort(d: Date): string {
  const h = d.getHours()
  const hh = h % 12 === 0 ? 12 : h % 12
  return `${hh}${h >= 12 ? 'p' : 'a'}`
}

export function fmtTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function fmtDay(d: Date): string {
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

export function fmtDayLong(d: Date): string {
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
}

export function fmtDateTime(ms: number): string {
  const d = new Date(ms)
  return d.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function relTime(ms: number): string {
  const diff = Date.now() - ms
  const m = Math.round(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hr ago`
  const d = Math.round(h / 24)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

export function dateFromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function dayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export interface WxCode {
  label: string
  icon: 'sun' | 'partly' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm' | 'sleet'
}

export function wxCode(code: number, isDay = true): WxCode {
  if (code === 0) return { label: isDay ? 'Clear' : 'Clear night', icon: 'sun' }
  if (code === 1) return { label: 'Mostly clear', icon: 'sun' }
  if (code === 2) return { label: 'Partly cloudy', icon: 'partly' }
  if (code === 3) return { label: 'Overcast', icon: 'cloud' }
  if (code === 45 || code === 48) return { label: 'Fog', icon: 'fog' }
  if (code >= 51 && code <= 55) return { label: 'Drizzle', icon: 'drizzle' }
  if (code === 56 || code === 57) return { label: 'Freezing drizzle', icon: 'sleet' }
  if (code === 61) return { label: 'Light rain', icon: 'rain' }
  if (code === 63) return { label: 'Rain', icon: 'rain' }
  if (code === 65) return { label: 'Heavy rain', icon: 'rain' }
  if (code === 66 || code === 67) return { label: 'Freezing rain', icon: 'sleet' }
  if (code === 71) return { label: 'Light snow', icon: 'snow' }
  if (code === 73) return { label: 'Snow', icon: 'snow' }
  if (code === 75) return { label: 'Heavy snow', icon: 'snow' }
  if (code === 77) return { label: 'Snow grains', icon: 'snow' }
  if (code === 80) return { label: 'Light showers', icon: 'rain' }
  if (code === 81) return { label: 'Showers', icon: 'rain' }
  if (code === 82) return { label: 'Heavy showers', icon: 'rain' }
  if (code === 85) return { label: 'Snow showers', icon: 'snow' }
  if (code === 86) return { label: 'Heavy snow showers', icon: 'snow' }
  if (code === 95) return { label: 'Thunderstorm', icon: 'storm' }
  if (code === 96 || code === 99) return { label: 'Storm with hail', icon: 'storm' }
  return { label: 'Unknown', icon: 'cloud' }
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}
