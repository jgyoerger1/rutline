import {
  Acorn, ArrowsInCardinal, Bed, Binoculars, Camera, Car, Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun,
  Drop, DropHalf, Footprints, MapPin, MoonStars, Snowflake, Sun, Tent, Tree, type Icon, type IconProps,
} from '@phosphor-icons/react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { WaypointType } from '../lib/types'
import type { WxCode } from '../lib/format'

export const TYPE_ICON: Record<WaypointType, Icon> = {
  stand: Binoculars,
  blind: Tent,
  camera: Camera,
  scrape: Footprints,
  rub: Tree,
  bedding: Bed,
  food: Acorn,
  water: Drop,
  funnel: ArrowsInCardinal,
  access: Car,
  blood: DropHalf,
  other: MapPin,
}

const WX_ICON: Record<WxCode['icon'], Icon> = {
  sun: Sun,
  partly: CloudSun,
  cloud: Cloud,
  fog: CloudFog,
  drizzle: CloudRain,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
  sleet: Snowflake,
}

export function WxIcon({ icon, isDay = true, ...rest }: { icon: WxCode['icon']; isDay?: boolean } & IconProps) {
  const I = !isDay && icon === 'sun' ? MoonStars : WX_ICON[icon]
  return <I {...rest} />
}

const markerCache = new Map<string, string>()

export function markerHtml(type: WaypointType, selected: boolean, isNew = false, shared = false): string {
  const key = `${type}:${selected ? 1 : 0}:${isNew ? 1 : 0}:${shared ? 1 : 0}`
  const hit = markerCache.get(key)
  if (hit) return hit
  const I = TYPE_ICON[type]
  const html = renderToStaticMarkup(
    <div className={`dw-pin${selected ? ' is-selected' : ''}${type === 'blood' ? ' is-blood' : ''}${isNew ? ' is-new' : ''}${shared ? ' is-shared' : ''}`}>
      <I weight={selected ? 'fill' : 'duotone'} />
    </div>,
  )
  markerCache.set(key, html)
  return html
}
