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
  access: { label: 'Access', plural: 'Access', hint: 'Parking, gate, entry point, landowner' },
  blood: { label: 'Blood sign', plural: 'Blood', hint: 'Dropped from the tracker' },
  other: { label: 'Other', plural: 'Other', hint: 'Anything else worth a pin' },
}

export const WAYPOINT_ORDER: WaypointType[] = [
  'stand', 'blind', 'camera', 'scrape', 'rub', 'bedding', 'food', 'water', 'funnel', 'access', 'blood', 'other',
]

/** Landowner record copied from a parcel onto a pin */
export interface OwnerInfo {
  name: string
  mailAddress: string
  parcelId: string
  county: string
  /** Two-letter state, when the source knew it */
  state?: string
  situs: string
  acres: number | null
  source: string
  savedAt: number
  /** A number the hunter found and saved */
  phone?: string
  /** Free note about the landowner ("answered, said call in August") */
  contactNote?: string
}

/** Columns every synced row carries */
export interface SyncMeta {
  /** Stable id shared with the account */
  uid: string
  /** 1 = has local changes the account has not seen */
  dirty: number
  /** Tombstone: set when deleted, kept until the deletion has been pushed */
  deletedAt: number | null
  /** Camp this row is shared with; null = private */
  campId: string | null
  /** Account that owns the row; null = me */
  ownerId: string | null
}

export interface Waypoint extends SyncMeta {
  id?: number
  type: WaypointType
  name: string
  lat: number
  lon: number
  note: string
  /** Compass points (N, NE, ...) that are huntable from this spot */
  goodWinds: string[]
  owner?: OwnerInfo | null
  createdAt: number
  updatedAt: number
}

export interface Photo extends SyncMeta {
  id?: number
  waypointId: number
  waypointUid: string | null
  /** Bytes live here once captured or downloaded; null for an account photo not opened yet */
  blob: Blob | null
  thumb: Blob | null
  /** Object paths in the account's photo store */
  path: string | null
  thumbPath: string | null
  uploadedAt: number | null
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

export interface Trail extends SyncMeta {
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
/** LiDAR terrain overlay renders from the USGS 3DEP service */
export type TerrainMode = 'hillshade' | 'slope' | 'contours'
export type TrackerMode = 'low' | 'high' | 'soil'
export type TrackerColor = 'red' | 'yellow' | 'green'

export interface HomeGround {
  lat: number
  lon: number
  label: string
}

/** How a parcel layer's attributes map onto Rutline's parcel record */
export interface ParcelFieldMap {
  parcelId?: string
  owner?: string
  owner2?: string
  mailName?: string
  /** One field holding the whole mailing address */
  mailAddress?: string
  /** Or several fields: street part(s), then city, state, zip */
  mailParts?: string[]
  situs?: string
  /** Or the site address split up: number, direction, name, suffix, then city last if present */
  situsParts?: string[]
  acres?: string
  landUse?: string
  county?: string
  link?: string
}

export interface CustomParcelSource {
  label: string
  url: string
  /** County name as the statewide layer spells it, so its rows can be replaced; blank = unknown */
  county: string
  fields: ParcelFieldMap
  /** [west, south, east, north] from the layer's metadata, null = unknown */
  extent: [number, number, number, number] | null
}

export interface HunterProfile {
  name: string
  phone: string
  email: string
}

export interface Settings {
  home: HomeGround | null
  units: Units
  /** 'MM-DD' override of the assumed peak-breeding date */
  rutPeakOverride: string | null
  mapLayer: MapLayer
  /** LiDAR terrain overlay on the map */
  terrainOn: boolean
  terrain: TerrainMode
  trackerMode: TrackerMode
  trackerColor: TrackerColor
  trackerSound: boolean
  legalLightMinutes: number
  parcelsEnabled: boolean
  customParcelSource: CustomParcelSource | null
  hunter: HunterProfile
  /** The user chose to run without an account on this device */
  localOnly: boolean
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
