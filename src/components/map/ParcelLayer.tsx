import L from 'leaflet'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GeoJSON, useMap, useMapEvents } from 'react-leaflet'
import { countyAt, discoverCounty, type CountyRef } from '../../lib/parcelDiscovery'
import { fetchParcelsFor, MAX_VIEW_METRES, MIN_PARCEL_ZOOM, namesOwnersFor, sourcesFor, toFeatureCollection, type BBox, type Parcel } from '../../lib/parcels'
import type { CustomParcelSource } from '../../lib/types'

export type ParcelState = 'off' | 'zoom' | 'finding' | 'loading' | 'ready' | 'empty' | 'nosource' | 'error'

export interface ParcelStatus {
  state: ParcelState
  count: number
  truncated: boolean
  sources: string[]
  message?: string
  /** County under the middle of the map, when known */
  county?: CountyRef | null
}

const BASE_STYLE: L.PathOptions = { color: '#f2ede2', weight: 1, opacity: 0.55, fillColor: '#f2ede2', fillOpacity: 0.025 }
const SELECTED_STYLE: L.PathOptions = { color: '#f5a86b', weight: 2.5, opacity: 1, fillColor: '#e8702c', fillOpacity: 0.16 }

export default function ParcelLayer({ enabled, custom, interactive, selectedKey, onSelect, onStatus, reloadKey = 0 }: { enabled: boolean; custom: CustomParcelSource | null; interactive: boolean; selectedKey: string | null; onSelect: (p: Parcel) => void; onStatus: (s: ParcelStatus) => void; reloadKey?: number }) {
  const map = useMap()
  const [batch, setBatch] = useState<{ id: number; parcels: Parcel[] }>({ id: 0, parcels: [] })
  const timer = useRef<number | null>(null)
  const ctl = useRef<AbortController | null>(null)
  const interactiveRef = useRef(interactive)
  interactiveRef.current = interactive
  const byKey = useRef(new Map<string, Parcel>())

  const load = useCallback(async () => {
    if (!enabled) {
      setBatch({ id: 0, parcels: [] })
      onStatus({ state: 'off', count: 0, truncated: false, sources: [] })
      return
    }
    const bounds0 = map.getBounds()
    const across = map.distance(bounds0.getSouthWest(), bounds0.getSouthEast())
    if (map.getZoom() < MIN_PARCEL_ZOOM || across > MAX_VIEW_METRES) {
      setBatch({ id: 0, parcels: [] })
      onStatus({ state: 'zoom', count: 0, truncated: false, sources: [] })
      return
    }
    const b = map.getBounds()
    const bbox: BBox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
    ctl.current?.abort()
    const c = new AbortController()
    ctl.current = c
    const mid = b.getCenter()

    // Which county is this, and does anything we already know name its owners?
    let county: CountyRef | null = null
    try {
      county = await countyAt(mid.lat, mid.lng, c.signal)
    } catch {
      county = null
    }
    if (c.signal.aborted) return
    if (county && !namesOwnersFor(sourcesFor(bbox, custom), county.state, county.county)) {
      onStatus({ state: 'finding', count: 0, truncated: false, sources: [], county })
      await discoverCounty(county, mid.lat, mid.lng)
      if (c.signal.aborted) return
    }

    const sources = sourcesFor(bbox, custom)
    if (!sources.length) {
      setBatch({ id: 0, parcels: [] })
      onStatus({ state: 'nosource', count: 0, truncated: false, sources: [], county })
      return
    }
    onStatus({ state: 'loading', count: 0, truncated: false, sources: [], county })
    try {
      const r = await fetchParcelsFor(bbox, custom, c.signal)
      if (c.signal.aborted) return
      byKey.current = new Map(r.parcels.map((p) => [p.key, p]))
      setBatch({ id: Date.now(), parcels: r.parcels })
      onStatus({ state: r.parcels.length ? 'ready' : r.errors.length ? 'error' : 'empty', count: r.parcels.length, truncated: r.truncated, sources: r.sources, message: r.errors[0], county })
    } catch (e) {
      if (c.signal.aborted) return
      onStatus({ state: 'error', count: 0, truncated: false, sources: [], message: e instanceof Error ? e.message : 'Could not load parcels', county })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, custom, map, onStatus, reloadKey])

  const schedule = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void load(), 350)
  }, [load])

  useMapEvents({ moveend: schedule, zoomend: schedule })
  useEffect(() => {
    schedule()
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
      ctl.current?.abort()
    }
  }, [schedule])

  const data = useMemo(() => toFeatureCollection(batch.parcels), [batch])
  const selected = useMemo(() => (selectedKey ? batch.parcels.find((p) => p.key === selectedKey) ?? null : null), [batch, selectedKey])
  const selectedData = useMemo(() => (selected ? toFeatureCollection([selected]) : null), [selected])

  if (!enabled || !batch.parcels.length) return null
  return (
    <>
      <GeoJSON
        key={batch.id}
        data={data}
        style={() => BASE_STYLE}
        // Parcels redraw on every pan; keep them under trails and their tap targets
        eventHandlers={{ add: (e) => (e.target as L.GeoJSON).bringToBack() }}
        onEachFeature={(feature, layer) => {
          layer.on('click', (e: L.LeafletMouseEvent) => {
            if (!interactiveRef.current) return
            L.DomEvent.stopPropagation(e)
            const p = byKey.current.get((feature.properties as { key: string }).key)
            if (p) onSelect(p)
          })
        }}
      />
      {selectedData && <GeoJSON key={`sel-${selected!.key}`} data={selectedData} style={() => SELECTED_STYLE} interactive={false} />}
    </>
  )
}
