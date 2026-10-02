/**
 * HuntCast: an hour-by-hour whitetail daylight-movement index, 0-100.
 *
 * Built from what the commercial forecasts say they use (HuntWise HuntCast,
 * DeerCast, BestHuntingTime) and weighted by what GPS-collar research actually
 * supports: time of day and rut phase dominate; pressure trend, a real
 * temperature drop and a workable wind are the next tier; moon is a minor
 * factor; precipitation mostly suppresses except at its edges.
 */
import { minutesToNearest, moonInfo, sunInfo, type MoonInfo } from './astro'
import { rutInfo, type RutInfo } from './rut'
import type { Forecast, HourData } from './types'

export type Tier = 'poor' | 'fair' | 'good' | 'great' | 'best'

export const TIERS: Record<Tier, { label: string; min: number }> = {
  poor: { label: 'Poor', min: 0 },
  fair: { label: 'Fair', min: 25 },
  good: { label: 'Good', min: 50 },
  great: { label: 'Great', min: 75 },
  best: { label: 'Best', min: 90 },
}

export function tierOf(score: number): Tier {
  if (score >= 90) return 'best'
  if (score >= 75) return 'great'
  if (score >= 50) return 'good'
  if (score >= 25) return 'fair'
  return 'poor'
}

export type FactorKey =
  | 'pressure' | 'trend' | 'front' | 'tempdrop' | 'temp' | 'wind' | 'gusts' | 'precip' | 'rainEnd' | 'rainSoon'
  | 'cloud' | 'fog' | 'moonPhase' | 'moonTransit' | 'rutMidday' | 'lateFeed'

export interface Factor {
  key: FactorKey
  label: string
  points: number
  detail: string
}

export interface HourScore {
  index: number
  time: Date
  hour: HourData
  score: number
  tier: Tier
  base: number
  factors: Factor[]
  rut: RutInfo
  legal: boolean
  night: boolean
  summary: string
}

export interface DayScore {
  date: string
  dayDate: Date
  score: number
  tier: Tier
  hours: HourScore[]
  morning: HourScore | null
  midday: HourScore | null
  evening: HourScore | null
  rut: RutInfo
  moon: MoonInfo
  sunrise: Date
  sunset: Date
  postFront: boolean
  headline: string
}

export interface HuntcastOptions {
  lat: number
  lon: number
  peakRut: Date
  legalLightMinutes?: number
}

const gauss = (x: number, sigma: number) => Math.exp(-(x * x) / (2 * sigma * sigma))
const MIN = 60000

export function scoreForecast(fc: Forecast, opts: HuntcastOptions): DayScore[] {
  const legalMin = opts.legalLightMinutes ?? 30
  const hours = fc.hours
  const dayKeys: string[] = []
  for (const h of hours) {
    const k = h.iso.slice(0, 10)
    if (dayKeys[dayKeys.length - 1] !== k) dayKeys.push(k)
  }
  const apiDays = new Map(fc.days.map((d) => [d.date, d]))

  // Front passage flags: a real cold front = 10°F+ colder than 24h ago while
  // pressure has climbed 0.10+ inHg over the last 12h. The flag lasts 36h.
  const frontAt: number[] = []
  for (let i = 24; i < hours.length; i++) {
    const h = hours[i]
    const d24 = h.tempF - hours[i - 24].tempF
    const p12 = i >= 12 ? h.pressureInHg - hours[i - 12].pressureInHg : 0
    if (d24 <= -10 && p12 >= 0.1) frontAt.push(i)
  }
  const isPostFront = (i: number) => frontAt.some((f) => i >= f && i - f <= 36)

  const days: DayScore[] = []
  for (const key of dayKeys) {
    const idx = hours.map((h, i) => (h.iso.startsWith(key) ? i : -1)).filter((i) => i >= 0)
    if (idx.length < 24) continue // partial day at either end of the pull
    const dayDate = new Date(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10))
    const api = apiDays.get(key)
    const sun = sunInfo(dayDate, opts.lat, opts.lon)
    const sunrise = api?.sunrise ?? sun.sunrise
    const sunset = api?.sunset ?? sun.sunset
    const moon = moonInfo(dayDate, opts.lat, opts.lon)
    const rut = rutInfo(dayDate, opts.peakRut)

    const scored: HourScore[] = idx.map((i) => scoreHour(hours, i, { sunrise, sunset, moon, rut, legalMin, postFront: isPostFront(i) }))

    const legal = scored.filter((h) => h.legal)
    const noon = sun.solarNoon.getTime()
    const morning = best(legal.filter((h) => h.time.getTime() + 30 * MIN < noon - 2.5 * 3600000))
    const midday = best(legal.filter((h) => Math.abs(h.time.getTime() + 30 * MIN - noon) <= 2.5 * 3600000))
    const evening = best(legal.filter((h) => h.time.getTime() + 30 * MIN > noon + 2.5 * 3600000))
    const top = [...legal].sort((a, b) => b.score - a.score).slice(0, 3)
    const score = top.length ? Math.round(top.reduce((s, h) => s + h.score, 0) / top.length) : 0
    const postFront = idx.some((i) => isPostFront(i))

    days.push({
      date: key,
      dayDate,
      score,
      tier: tierOf(score),
      hours: scored,
      morning,
      midday,
      evening,
      rut,
      moon,
      sunrise,
      sunset,
      postFront,
      headline: headline(score, morning, evening, rut, postFront),
    })
  }
  return days
}

function best(list: HourScore[]): HourScore | null {
  if (!list.length) return null
  return list.reduce((a, b) => (b.score > a.score ? b : a))
}

interface Ctx {
  sunrise: Date
  sunset: Date
  moon: MoonInfo
  rut: RutInfo
  legalMin: number
  postFront: boolean
}

function scoreHour(hours: HourData[], i: number, ctx: Ctx): HourScore {
  const h = hours[i]
  const tc = h.time.getTime() + 30 * MIN // centre of the hour bucket
  const sr = ctx.sunrise.getTime()
  const ss = ctx.sunset.getTime()
  const legal = tc >= sr - ctx.legalMin * MIN && tc <= ss + ctx.legalMin * MIN
  const night = tc < sr - 60 * MIN || tc > ss + 60 * MIN
  const localHour = h.time.getHours()

  // Base: crepuscular curve. Peaks just after sunrise and just before sunset.
  const base = 14 + 46 * gauss((tc - (sr + 15 * MIN)) / MIN, 75) + 46 * gauss((tc - (ss - 40 * MIN)) / MIN, 80)

  const f: Factor[] = []
  const add = (key: FactorKey, label: string, points: number, detail: string) => {
    if (points !== 0) f.push({ key, label, points, detail })
  }

  // --- Barometric pressure: level ---
  const p = h.pressureInHg
  if (p >= 30.4) add('pressure', 'High pressure', 3, `Bluebird high at ${p.toFixed(2)} inHg`)
  else if (p >= 30.1) add('pressure', 'Pressure in the sweet spot', 8, `${p.toFixed(2)} inHg, the 30.10-30.40 band deer move best in`)
  else if (p >= 29.9) add('pressure', 'Decent pressure', 4, `${p.toFixed(2)} inHg, just under the ideal band`)
  else if (p >= 29.7) add('pressure', 'Low pressure', -2, `${p.toFixed(2)} inHg, unsettled`)
  else add('pressure', 'Storm-low pressure', -8, `${p.toFixed(2)} inHg, deer hold tight`)

  // --- Barometric pressure: trend over 3h, plus 24h rise bonus ---
  const p3 = i >= 3 ? p - hours[i - 3].pressureInHg : 0
  const p24 = i >= 24 ? p - hours[i - 24].pressureInHg : 0
  const heavyNow = h.precipIn >= 0.1 || h.code >= 95
  if (p3 >= 0.06) add('trend', 'Pressure rising fast', 8, `Up ${p3.toFixed(2)} in 3 hrs, classic behind-the-front surge`)
  else if (p3 >= 0.02) add('trend', 'Pressure rising', 4, `Up ${p3.toFixed(2)} in 3 hrs`)
  else if (p3 <= -0.06) add('trend', heavyNow ? 'Pressure crashing' : 'Pressure falling fast', heavyNow ? -4 : 2, heavyNow ? `Down ${Math.abs(p3).toFixed(2)} in 3 hrs with weather on top` : `Down ${Math.abs(p3).toFixed(2)} in 3 hrs, deer feed ahead of it`)
  else if (p3 <= -0.02) add('trend', 'Pressure falling', 3, `Down ${Math.abs(p3).toFixed(2)} in 3 hrs, pre-weather feeding`)
  if (p24 >= 0.3) add('front', 'Post-front rise', 5, `Barometer up ${p24.toFixed(2)} over 24 hrs`)
  else if (ctx.postFront) add('front', 'First days after a cold front', 6, 'Within 36 hrs of a cold front passing')

  // --- Temperature: 24h change and absolute comfort ---
  const d24 = i >= 24 ? h.tempF - hours[i - 24].tempF : 0
  if (d24 <= -15) add('tempdrop', 'Hard temperature drop', 10, `${Math.round(Math.abs(d24))}° colder than this time yesterday`)
  else if (d24 <= -8) add('tempdrop', 'Temperature drop', 6, `${Math.round(Math.abs(d24))}° colder than yesterday`)
  else if (d24 <= -3) add('tempdrop', 'Cooler than yesterday', 2, `${Math.round(Math.abs(d24))}° cooler`)
  else if (d24 >= 10) add('tempdrop', 'Warming trend', -5, `${Math.round(d24)}° warmer than yesterday`)

  const t = h.tempF
  const late = ctx.rut.phase === 'late' || ctx.rut.phase === 'second' || ctx.rut.phase === 'postrut'
  if (t > 70) add('temp', 'Hot', -9, `${Math.round(t)}°F, deer wait for dark`)
  else if (t > 60) add('temp', 'Warm', -4, `${Math.round(t)}°F, above the comfort band`)
  else if (t >= 50) add('temp', 'Mild', 1, `${Math.round(t)}°F`)
  else if (t >= 20) add('temp', 'In the comfort band', 4, `${Math.round(t)}°F, deer are comfortable on their feet`)
  else if (late && localHour >= 12 && localHour <= 16) add('lateFeed', 'Bitter cold, afternoon feed', 3, `${Math.round(t)}°F pushes deer to food early`)
  else add('temp', 'Bitter cold', -1, `${Math.round(t)}°F`)

  // --- Wind ---
  const w = h.windMph
  if (w < 4) add('wind', 'Light and variable', -2, `${Math.round(w)} mph, swirling scent and edgy deer`)
  else if (w <= 12) add('wind', 'Steady, workable wind', 5, `${Math.round(w)} mph, the band deer move best in`)
  else if (w <= 16) add('wind', 'Breezy', 2, `${Math.round(w)} mph`)
  else if (w <= 20) add('wind', 'Windy', -3, `${Math.round(w)} mph`)
  else if (w <= 25) add('wind', 'Strong wind', -7, `${Math.round(w)} mph, deer get nervous`)
  else add('wind', 'Howling', -12, `${Math.round(w)} mph, deer bed in the lee`)
  if (h.gustMph >= 30) add('gusts', 'Heavy gusts', -3, `Gusting ${Math.round(h.gustMph)} mph`)

  // --- Precipitation ---
  const snow = (h.code >= 71 && h.code <= 77) || h.code === 85 || h.code === 86
  if (h.code >= 95) add('precip', 'Thunderstorm', -14, 'Lightning and downpour')
  else if (snow) {
    if (h.precipIn >= 0.1) add('precip', 'Heavy snow', -6, 'Hard snow keeps deer down until it eases')
    else add('precip', 'Light snow', 3, 'Light snow gets deer up and feeding')
  } else if (h.precipIn >= 0.15) add('precip', 'Heavy rain', -12, `${h.precipIn.toFixed(2)} in/hr`)
  else if (h.precipIn >= 0.05) add('precip', 'Rain', -6, `${h.precipIn.toFixed(2)} in/hr`)
  else if (h.precipIn > 0) add('precip', 'Drizzle', -2, 'Light drizzle, deer still move')

  // Rain stopping: the hour after real rain ends is a feeding window
  const prev = i >= 1 ? hours[i - 1] : null
  const prev2 = i >= 2 ? hours[i - 2] : null
  if (prev && prev.precipIn >= 0.03 && h.precipIn < 0.01) add('rainEnd', 'Rain just ended', 8, 'Deer get up and feed as the rain quits')
  else if (prev2 && prev2.precipIn >= 0.03 && prev && prev.precipIn < 0.01 && h.precipIn < 0.01) add('rainEnd', 'Rain ended last hour', 4, 'Still inside the post-rain window')

  // Rain starting in the next 1-4 hours: pre-storm urgency
  if (h.precipIn < 0.01) {
    for (let k = 1; k <= 4; k++) {
      const n = hours[i + k]
      if (n && n.precipIn >= 0.05) {
        add('rainSoon', 'Weather on the way', 4, `Rain lands in about ${k} hr${k === 1 ? '' : 's'}`)
        break
      }
    }
  }

  // --- Sky ---
  if (h.cloud >= 80 && !night && h.precipIn < 0.01) add('cloud', 'Overcast', 3, 'Low light keeps deer moving later into the morning')
  if (h.code === 45 || h.code === 48) add('fog', 'Fog', -3, 'Dense fog makes deer secretive')

  // --- Moon (minor; the collar studies find little) ---
  const ill = ctx.moon.illumination
  const dawnHour = Math.abs(tc - sr) <= 90 * MIN
  const duskHour = Math.abs(tc - ss) <= 90 * MIN
  const middayHour = localHour >= 10 && localHour <= 14
  if (ill >= 0.85) {
    if (dawnHour) add('moonPhase', 'Bright moon', -3, 'Deer fed under the moon and bed early')
    else if (middayHour) add('moonPhase', 'Bright moon, midday bump', 2, 'Late risers stretch their legs at midday')
  } else if (ill <= 0.15 && (dawnHour || duskHour)) add('moonPhase', 'Dark moon', 2, 'Dark nights push movement into shooting light')
  const transit = Math.min(minutesToNearest(tc, ctx.moon.overhead), minutesToNearest(tc, ctx.moon.underfoot))
  if (transit <= 60 && !night) add('moonTransit', 'Moon overhead or underfoot', 3, 'Solunar major period')

  // --- Rut: midday lift, then multiplier ---
  if (ctx.rut.meta.middayLift && localHour >= 9 && localHour <= 15 && !night) {
    add('rutMidday', `${ctx.rut.meta.label}: bucks cruising`, ctx.rut.meta.middayLift, 'Midday movement during the rut')
  }

  let raw = base + f.reduce((s, x) => s + x.points, 0)
  raw *= ctx.rut.meta.multiplier
  if (night) raw *= 0.3
  else if (!legal) raw *= 0.6
  const score = Math.round(Math.min(100, Math.max(0, raw)))

  return {
    index: i,
    time: h.time,
    hour: h,
    score,
    tier: tierOf(score),
    base: Math.round(base),
    factors: f.sort((a, b) => Math.abs(b.points) - Math.abs(a.points)),
    rut: ctx.rut,
    legal,
    night,
    summary: summarize(f, night, legal),
  }
}

function summarize(f: Factor[], night: boolean, legal: boolean): string {
  if (night) return 'After dark. Deer move, you cannot shoot.'
  const ups = f.filter((x) => x.points > 0).slice(0, 2).map((x) => x.label.toLowerCase())
  const down = f.find((x) => x.points < 0)
  let s = ''
  if (ups.length) s = ups.join(' and ')
  if (down) s += (s ? '; ' : '') + down.label.toLowerCase() + ' drags it down'
  if (!s) s = 'Nothing special in the air'
  if (!legal) s += ' (outside legal light)'
  return s.charAt(0).toUpperCase() + s.slice(1) + '.'
}

function headline(score: number, morning: HourScore | null, evening: HourScore | null, rut: RutInfo, postFront: boolean): string {
  const tier = tierOf(score)
  const which = morning && evening ? (morning.score >= evening.score ? 'morning' : 'evening') : morning ? 'morning' : 'evening'
  const rutNote = rut.phase === 'chasing' ? ' Chasing phase: sit all day if you can.' : rut.phase === 'seeking' ? ' Seeking phase: bucks are on their feet.' : rut.phase === 'peak' ? ' Peak breeding: hunt the does.' : ''
  const front = postFront ? ' A front just cleared.' : ''
  switch (tier) {
    case 'best':
      return `Take the day off. ${cap(which)} is the sit.${front}${rutNote}`
    case 'great':
      return `Strong day. Favor the ${which}.${front}${rutNote}`
    case 'good':
      return `Worth a sit, lean ${which}.${front}${rutNote}`
    case 'fair':
      return `Marginal. The ${which} is your best shot.${rutNote}`
    default:
      return `Stay out of your best stands today.${rutNote}`
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Plain-language documentation of each factor, for the "how this works" view. */
export const FACTOR_DOCS: Array<{ key: FactorKey; title: string; range: string; why: string }> = [
  { key: 'pressure', title: 'Barometric pressure level', range: '-8 to +8', why: 'Deer feed hardest with the barometer between 30.10 and 30.40 inHg. Storm-low pressure under 29.70 pins them down.' },
  { key: 'trend', title: 'Pressure trend (3 hrs)', range: '-4 to +8', why: 'A barometer moving either way beats a flat one. Rising fast behind a front is the strongest signal; falling ahead of weather triggers feeding.' },
  { key: 'front', title: 'Cold front passage', range: '+5 to +6', why: 'The first 24-48 hours after a real front (10°F+ colder, pressure climbing) is the most reliable daylight surge outside the rut.' },
  { key: 'tempdrop', title: 'Temperature vs. yesterday', range: '-5 to +10', why: 'A 10-15°F drop from the previous day gets deer up to feed. A warm-up does the opposite.' },
  { key: 'temp', title: 'Absolute temperature', range: '-9 to +4', why: 'Deer in a winter coat are comfortable from the 20s to the 40s. Above 60°F they wait for dark.' },
  { key: 'wind', title: 'Wind speed', range: '-12 to +5', why: 'Steady 5-12 mph is the sweet spot. Light and variable makes scent swirl; over 20 mph deer get nervous and bed in the lee.' },
  { key: 'precip', title: 'Precipitation', range: '-14 to +3', why: 'Light snow helps. Rain suppresses in proportion to how hard it falls; thunderstorms shut things down.' },
  { key: 'rainEnd', title: 'Rain ending', range: '+4 to +8', why: 'The first hour after real rain quits is a feeding window.' },
  { key: 'rainSoon', title: 'Rain within four hours', range: '+4', why: 'Deer feed ahead of incoming weather.' },
  { key: 'cloud', title: 'Overcast sky', range: '+3', why: 'Low light stretches the morning movement and starts the evening earlier.' },
  { key: 'moonPhase', title: 'Moon phase', range: '-3 to +2', why: 'Kept small on purpose. Collar studies find little, but a bright moon shifts some movement to night and a dark one concentrates it in shooting light.' },
  { key: 'moonTransit', title: 'Moon overhead or underfoot', range: '+3', why: 'The solunar major periods. A folk factor with weak evidence, weighted accordingly.' },
  { key: 'rutMidday', title: 'Rut midday lift', range: '+3 to +18', why: 'Seeking and chasing bucks cruise at noon. The score floor lifts between 9 and 3 in those phases.' },
  { key: 'lateFeed', title: 'Late-season cold feed', range: '+3', why: 'Below 20°F in December and January, deer hit food early in the afternoon.' },
]
