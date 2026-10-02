import * as SunCalc from 'suncalc'

export interface SunInfo {
  sunrise: Date
  sunset: Date
  dawn: Date
  dusk: Date
  solarNoon: Date
}

export function sunInfo(date: Date, lat: number, lon: number): SunInfo {
  const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0)
  const t = SunCalc.getTimes(noon, lat, lon)
  // Polar edge cases return null; fall back to sensible clock times so the curve still renders
  const or = (d: Date | null | undefined, hour: number) => d ?? new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, 0, 0)
  return { sunrise: or(t.sunrise, 7), sunset: or(t.sunset, 18), dawn: or(t.dawn, 6), dusk: or(t.dusk, 19), solarNoon: or(t.solarNoon, 12) }
}

export interface MoonInfo {
  /** 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter */
  phase: number
  illumination: number
  name: string
  rise: Date | null
  set: Date | null
  /** Upper transit (moon overhead) during this calendar day */
  overhead: Date[]
  /** Lower transit (moon underfoot) during this calendar day */
  underfoot: Date[]
}

export function moonPhaseName(phase: number): string {
  if (phase < 0.03 || phase > 0.97) return 'New moon'
  if (phase < 0.22) return 'Waxing crescent'
  if (phase < 0.28) return 'First quarter'
  if (phase < 0.47) return 'Waxing gibbous'
  if (phase < 0.53) return 'Full moon'
  if (phase < 0.72) return 'Waning gibbous'
  if (phase < 0.78) return 'Last quarter'
  return 'Waning crescent'
}

export function moonInfo(date: Date, lat: number, lon: number): MoonInfo {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0)
  const noon = new Date(start.getTime() + 12 * 3600 * 1000)
  const ill = SunCalc.getMoonIllumination(noon)
  const times = SunCalc.getMoonTimes(start, lat, lon)

  // Scan altitude in 10-minute steps; local maxima = overhead, minima = underfoot
  const overhead: Date[] = []
  const underfoot: Date[] = []
  const step = 10 * 60 * 1000
  let prev = SunCalc.getMoonPosition(new Date(start.getTime() - step), lat, lon).altitude
  let cur = SunCalc.getMoonPosition(start, lat, lon).altitude
  for (let t = start.getTime() + step; t <= start.getTime() + 24 * 3600 * 1000; t += step) {
    const next = SunCalc.getMoonPosition(new Date(t), lat, lon).altitude
    if (cur > prev && cur >= next) overhead.push(new Date(t - step))
    if (cur < prev && cur <= next) underfoot.push(new Date(t - step))
    prev = cur
    cur = next
  }
  return {
    phase: ill.phase,
    illumination: ill.fraction,
    name: moonPhaseName(ill.phase),
    rise: times.rise ?? null,
    set: times.set ?? null,
    overhead,
    underfoot,
  }
}

/** Minutes from a moment to the nearest of a list of moments */
export function minutesToNearest(t: number, list: Date[]): number {
  let best = Infinity
  for (const d of list) best = Math.min(best, Math.abs(d.getTime() - t) / 60000)
  return best
}
