import type { MapLayer } from './types'

// Esri imagery in a shipped app needs an ArcGIS Location Platform key (the
// first 2M tiles a month are free). With VITE_ESRI_API_KEY set the keyed
// endpoint is used; without it, development falls back to the open one.
const ESRI_KEY = (import.meta.env.VITE_ESRI_API_KEY as string | undefined)?.trim()

export interface Basemap {
  url: string
  attribution: string
  maxNativeZoom: number
  /** Rough bytes per tile, for offline-area estimates */
  tileBytes: number
}

export const LAYERS: Record<MapLayer, Basemap> = {
  satellite: ESRI_KEY
    ? { url: `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${encodeURIComponent(ESRI_KEY)}`, attribution: 'Powered by Esri · Maxar, Earthstar Geographics', maxNativeZoom: 19, tileBytes: 28000 }
    : { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Imagery © Esri, Maxar, Earthstar Geographics', maxNativeZoom: 19, tileBytes: 28000 },
  topo: { url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}', attribution: 'USGS The National Map', maxNativeZoom: 16, tileBytes: 16000 },
}

export function tileUrl(layer: MapLayer, z: number, x: number, y: number): string {
  return LAYERS[layer].url.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y))
}
