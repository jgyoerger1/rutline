/**
 * LiDAR terrain overlay from the USGS 3D Elevation Program. Nationwide, no
 * key: the seamless DEM (1 m where lidar exists, 10 m elsewhere) rendered on
 * demand through one of the service's raster functions.
 *
 * One render per map view, not tiles: the renderer is slow under a burst of
 * parallel tile requests, but a single viewport-sized export comes back in
 * about a second. The previous image stays up until the new one has loaded,
 * then crossfades. The image sits in its own pane and multiplies onto the
 * basemap, so flat ground is untouched and relief darkens it.
 */
import L from 'leaflet'
import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import type { TerrainMode } from '../../lib/types'

export type TerrainState = 'off' | 'zoom' | 'loading' | 'ready' | 'error'

const SERVICE = 'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage'
export const MIN_TERRAIN_ZOOM = 10
const MAX_PX = 2048
const PAD = 0.12

const FUNCTION: Record<TerrainMode, string> = {
  hillshade: 'Hillshade Multidirectional',
  slope: 'Slope Map',
  contours: 'Preset 5ft Contour Interval',
}
const OPACITY: Record<TerrainMode, number> = { hillshade: 0.82, slope: 0.6, contours: 0.75 }

export function terrainUrl(bounds: L.LatLngBounds, width: number, height: number, mode: TerrainMode): string {
  const nw = L.CRS.EPSG3857.project(bounds.getNorthWest())
  const se = L.CRS.EPSG3857.project(bounds.getSouthEast())
  const bbox = [nw.x, se.y, se.x, nw.y].map((v) => v.toFixed(2)).join(',')
  const rule = encodeURIComponent(JSON.stringify({ rasterFunction: FUNCTION[mode] }))
  return `${SERVICE}?bbox=${bbox}&bboxSR=3857&imageSR=3857&size=${width},${height}&format=png&f=image&renderingRule=${rule}`
}

export default function TerrainLayer({ enabled, mode, onStatus }: { enabled: boolean; mode: TerrainMode; onStatus: (s: TerrainState) => void }) {
  const map = useMap()

  useEffect(() => {
    if (!map.getPane('terrain')) {
      const pane = map.createPane('terrain')
      pane.style.zIndex = '350'
      pane.style.mixBlendMode = 'multiply'
      pane.style.pointerEvents = 'none'
    }
  }, [map])

  useEffect(() => {
    if (!enabled) {
      onStatus('off')
      return
    }
    let current: L.ImageOverlay | null = null
    let currentUrl: string | null = null
    let ctl: AbortController | null = null
    let timer: number | null = null
    let disposed = false

    const drop = () => {
      current?.remove()
      current = null
      if (currentUrl) URL.revokeObjectURL(currentUrl)
      currentUrl = null
    }

    const render = async () => {
      if (disposed) return
      if (map.getZoom() < MIN_TERRAIN_ZOOM) {
        ctl?.abort()
        drop()
        onStatus('zoom')
        return
      }
      ctl?.abort()
      const mine = new AbortController()
      ctl = mine
      const bounds = map.getBounds().pad(PAD)
      const size = map.getSize()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      let w = Math.round(size.x * (1 + 2 * PAD) * dpr)
      let h = Math.round(size.y * (1 + 2 * PAD) * dpr)
      const k = Math.min(1, MAX_PX / Math.max(w, h))
      w = Math.max(64, Math.round(w * k))
      h = Math.max(64, Math.round(h * k))
      onStatus('loading')
      try {
        const res = await fetch(terrainUrl(bounds, w, h, mode), { signal: mine.signal })
        if (!res.ok || !(res.headers.get('content-type') ?? '').startsWith('image/')) throw new Error(`terrain ${res.status}`)
        const blob = await res.blob()
        if (mine.signal.aborted || disposed) return
        const url = URL.createObjectURL(blob)
        const next = L.imageOverlay(url, bounds, { pane: 'terrain', opacity: 0, interactive: false, className: `terrain-image terrain-${mode}`, attribution: 'Terrain: USGS 3DEP' })
        next.once('load', () => {
          if (mine.signal.aborted || disposed) {
            next.remove()
            URL.revokeObjectURL(url)
            return
          }
          drop()
          current = next
          currentUrl = url
          next.setOpacity(OPACITY[mode])
          onStatus('ready')
        })
        next.once('error', () => {
          next.remove()
          URL.revokeObjectURL(url)
          if (!mine.signal.aborted && !disposed) onStatus('error')
        })
        next.addTo(map)
      } catch (e) {
        if ((e as Error).name === 'AbortError' || disposed) return
        onStatus('error')
      }
    }

    const schedule = () => {
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(() => void render(), 280)
    }
    map.on('moveend', schedule)
    void render()
    return () => {
      disposed = true
      map.off('moveend', schedule)
      if (timer) window.clearTimeout(timer)
      ctl?.abort()
      drop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, mode, map])

  return null
}
