export type RutPhase = 'offseason' | 'early' | 'prerut' | 'seeking' | 'chasing' | 'peak' | 'postrut' | 'second' | 'late'

export interface RutPhaseMeta {
  label: string
  short: string
  /** Multiplier on daylight movement score */
  multiplier: number
  /** Flat points added to the 9am-3pm band (bucks cruising) */
  middayLift: number
  tactic: string
}

export const RUT_PHASES: Record<RutPhase, RutPhaseMeta> = {
  offseason: { label: 'Off season', short: 'Off', multiplier: 1.0, middayLift: 0, tactic: 'Scout, hang cameras, learn the ground.' },
  early: { label: 'Early season', short: 'Early', multiplier: 1.0, middayLift: 0, tactic: 'Bed-to-food patterns. Evening sits on food, mornings only when you can get in clean.' },
  prerut: { label: 'Pre-rut', short: 'Pre-rut', multiplier: 1.05, middayLift: 3, tactic: 'Scrapes light up. Hunt scrape lines and staging cover off doe bedding.' },
  seeking: { label: 'Seeking', short: 'Seeking', multiplier: 1.18, middayLift: 12, tactic: 'Bucks cover ground checking does. Funnels and downwind edges of doe bedding, all day sits pay.' },
  chasing: { label: 'Chasing', short: 'Chasing', multiplier: 1.32, middayLift: 18, tactic: 'Peak daylight buck movement of the year. Sit all day in funnels between doe groups. Grunt and rattle.' },
  peak: { label: 'Peak breeding', short: 'Peak', multiplier: 1.2, middayLift: 12, tactic: 'Lockdown: bucks are with does. Hunt doe bedding and the next unbred doe. Movement is high but short.' },
  postrut: { label: 'Post-rut', short: 'Post', multiplier: 1.02, middayLift: 4, tactic: 'Worn-down bucks return to food. Evening sits on the best food, cold fronts matter again.' },
  second: { label: 'Second rut', short: '2nd rut', multiplier: 1.12, middayLift: 8, tactic: 'Late does and fawns cycle. Food sources with doe groups, midday checks.' },
  late: { label: 'Late season', short: 'Late', multiplier: 0.96, middayLift: 0, tactic: 'Calories rule. Afternoon sits on standing grain or cut corn, biggest on the coldest days.' },
}

export interface PeakGuess {
  date: Date
  confidence: 'high' | 'medium' | 'low'
  reason: string
}

/**
 * Peak breeding is photoperiod-driven and remarkably stable year to year in the
 * north. Conception data by region (NE/Midwest Nov 8-17, upper South Nov 12-18,
 * mid-latitudes first ten days of Nov, Deep South late Dec-Jan and county-level
 * variable). Latitude is a decent first guess; the user can override it.
 */
export function defaultPeakRut(lat: number, lon: number, year: number): PeakGuess {
  void lon
  if (lat >= 40) return { date: new Date(year, 10, 13), confidence: 'high', reason: 'Northern latitude: peak breeding lands in the second week of November.' }
  if (lat >= 36) return { date: new Date(year, 10, 11), confidence: 'high', reason: 'Mid-latitude: peak breeding in the first half of November.' }
  if (lat >= 33) return { date: new Date(year, 10, 16), confidence: 'medium', reason: 'Upper South: peak breeding mid to late November, but it shifts county to county.' }
  return { date: new Date(year + 1, 0, 5), confidence: 'low', reason: 'Deep South: breeding runs late December into January and varies by county. Set your local peak.' }
}

export function parsePeakOverride(override: string | null, lat: number, lon: number, forDate: Date): PeakGuess {
  const year = seasonYear(forDate)
  if (override) {
    const m = /^(\d{2})-(\d{2})$/.exec(override)
    if (m) {
      const month = +m[1] - 1
      const day = +m[2]
      // Jan/Feb peaks belong to the following calendar year of the season
      const y = month <= 2 ? year + 1 : year
      return { date: new Date(y, month, day), confidence: 'high', reason: 'Set by you.' }
    }
  }
  return defaultPeakRut(lat, lon, year)
}

/** The hunting season "year": Aug-Dec map to this year, Jan-Jul to the previous */
export function seasonYear(d: Date): number {
  return d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1
}

export interface RutInfo {
  phase: RutPhase
  meta: RutPhaseMeta
  daysToPeak: number
  peak: Date
}

const DAY = 86400000

export function rutInfo(date: Date, peak: Date): RutInfo {
  const d = Math.round((startOfDay(date).getTime() - startOfDay(peak).getTime()) / DAY)
  let phase: RutPhase
  if (d < -75) phase = 'offseason'
  else if (d < -35) phase = 'early'
  else if (d < -21) phase = 'prerut'
  else if (d < -11) phase = 'seeking'
  else if (d < -3) phase = 'chasing'
  else if (d <= 6) phase = 'peak'
  else if (d <= 20) phase = 'postrut'
  else if (d <= 34) phase = 'second'
  else if (d <= 90) phase = 'late'
  else phase = 'offseason'
  return { phase, meta: RUT_PHASES[phase], daysToPeak: -d, peak }
}

export interface RutSegment {
  phase: RutPhase
  start: Date
  end: Date
}

export function rutTimeline(peak: Date): RutSegment[] {
  const p = startOfDay(peak).getTime()
  const seg = (phase: RutPhase, from: number, to: number): RutSegment => ({ phase, start: new Date(p + from * DAY), end: new Date(p + to * DAY) })
  return [
    seg('early', -75, -35),
    seg('prerut', -35, -21),
    seg('seeking', -21, -11),
    seg('chasing', -11, -3),
    seg('peak', -3, 7),
    seg('postrut', 7, 21),
    seg('second', 21, 35),
    seg('late', 35, 90),
  ]
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
