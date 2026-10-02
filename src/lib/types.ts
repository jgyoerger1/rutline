export type WaypointType =
  | 'stand'
  | 'blind'
  | 'camera'
  | 'scrape'
  | 'rub'
  | 'bedding'
  | 'food'
  | 'water'
  | 'funnel'
  | 'access'
  | 'blood'
  | 'other'

export interface WaypointMeta {
  label: string
  plural: string
  hint: string
  /** Stands and blinds carry a set of huntable wind directions */
  hasWinds?: boolean
}

export const WAYPOINT_TYPES: Record<WaypointType, WaypointMeta> = {
  stand: { label: 'Tree stand', plural: 'Stands', hint: 'Hang-on, ladder or climber', hasWinds: true },
  blind: { label: 'Ground blind', plural: 'Blinds', hint: 'Box or pop-up blind', hasWinds: true },
  camera: { label: 'Trail camera', plural: 'Cameras', hint: 'Attach the pulls here', hasWinds: false },
  scrape: { label: 'Scrape', plural: 'Scrapes', hint: 'Licking branch and pawed ground' },
  rub: { label: 'Rub', plural: 'Rubs', hint: 'Rub or rub line' },
  bedding: { label: 'Bedding', plural: 'Bedding', hint: 'Beds, thickets, benches' },
  food: { label: 'Food source', plural: 'Food', hint: 'Plot, oaks, ag edge, feeder' },
  water: { label: 'Water', plural: 'Water', hint: 'Creek crossing, pond, seep' },
  funnel: { label: 'Funnel', plural: 'Funnels', hint: 'Pinch point, saddle, inside corner' },
  access: { label: 'Access', plural: 'Access', hint: 'Parking, gate, entry point' },
  blood: { label: 'Blood sign', plural: 'Blood', hint: 'Dropped from the tracker' },
  other: { label: 'Other', plural: 'Other', hint: 'Anything else worth a pin' },
}

export const WAYPOINT_ORDER: WaypointType[] = [
  'stand', 'blind', 'camera', 'scrape', 'rub', 'bedding', 'food', 'water', 'funnel', 'access', 'blood', 'other',
]

export interface Waypoint {
  id?: number
  type: WaypointType
  name: string
  lat: number
  lon: number
  note: string
  /** Compass points (N, NE, ...) that are huntable from this spot */
  goodWinds: string[]
  createdAt: number
  updatedAt: number
}

export interface Photo {
  id?: number
  waypointId: number
  blob: Blob
  thumb: Blob
  /** Capture time from EXIF when present, else file time */
  takenAt: number
  addedAt: number
  caption: string
  width: number
  height: number
}

export type TrailKind = 'trail' | 'entry' | 'exit' | 'drag'

export const TRAIL_KINDS: Record<TrailKind, { label: string; hint: string }> = {
  trail: { label: 'Deer trail', hint: 'Travel corridor the deer use' },
  entry: { label: 'Entry route', hint: 'Your way in, quiet and downwind' },
  exit: { label: 'Exit route', hint: 'Your way out after dark' },
  drag: { label: 'Blood trail', hint: 'Recovered track from the tracker' },
}

export interface Trail {
  id?: number
  name: string
  kind: TrailKind
  points: [number, number][]
  note: string
  createdAt: number
  updatedAt: number
}

export type Units = 'imperial' | 'metric'
export type MapLayer = 'satellite' | 'topo' | 'streets'
export type TrackerMode = 'low' | 'high' | 'soil'
export type TrackerColor = 'red' | 'yellow' | 'green'

export interface HomeGround {
  lat: number
  lon: number
  label: string
}

export interface Settings {
  home: HomeGround | null
  units: Units
  /** 'MM-DD' override of the assumed peak-breeding date */
  rutPeakOverride: string | null
  mapLayer: MapLayer
  trackerMode: TrackerMode
  trackerColor: TrackerColor
  trackerSound: boolean
  legalLightMinutes: number
}

export interface HourData {
  iso: string
  time: Date
  tempF: number
  feelsF: number
  humidity: number
  dewF: number
  precipProb: number
  precipIn: number
  code: number
  pressureInHg: number
  cloud: number
  windMph: number
  windDir: number
  gustMph: number
  isDay: boolean
}

export interface DayData {
  date: string
  sunrise: Date
  sunset: Date
  hiF: number
  loF: number
  precipIn: number
  windMaxMph: number
  windDomDir: number
  code: number
}

export interface Forecast {
  lat: number
  lon: number
  tz: string
  elevationFt: number
  fetchedAt: number
  hours: HourData[]
  days: DayData[]
}
