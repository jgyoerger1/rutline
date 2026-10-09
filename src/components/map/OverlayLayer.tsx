/**
 * Draws one overlay kind (public land, walk-in access, hunt units) from every
 * source whose extent meets the view. Read-only and tap-through: taps are
 * resolved at the map level with overlaysAt(), so parcels, pins and trails
 * keep their own tap targets.
 */
import L from 'leaflet'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GeoJSON, Marker, useMap, useMapEvents } from 'react-leaflet'
import type { BBox } from '../../lib/parcels'
import { labelPoint, queryOverlay, setLoaded, type OverlayFeature, type OverlayKind, type OverlaySource } from '../../lib/overlays'

export type OverlayState = 'off' | 'zoom' | 'loading' | 'ready' | 'empty' | 'nosource' | 'error'

const PANES: Record<OverlayKind, number> = { public: 360, access: 365, units: 385 }

export default function OverlayLayer({
  kind,
  enabled,
  sources,
  minZoom,
  style,
  label,
  onStatus,
}: {
  kind: OverlayKind
  enabled: boolean
  sources: OverlaySource[]
  minZoom: number
  style: (f: OverlayFeature) => L.PathOptions | null
  /** Text for a permanent label at the feature's label point, or null for none */
  label?: (f: OverlayFeature) => string | null
  onStatus: (s: OverlayState, detail?: string) => void
}) {
  const map = useMap()
  const [batch, setBatch] = useState<{ id: number; features: OverlayFeature[] }>({ id: 0, features: [] })
  const ctl = useRef<AbortController | null>(null)
  const timer = useRef<number | null>(null)
  const pane = `ov-${kind}`

  useEffect(() => {
    if (!map.getPane(pane)) {
      const p = map.createPane(pane)
      p.style.zIndex = String(PANES[kind])
      p.style.pointerEvents = 'none'
    }
  }, [map, pane, kind])

  const load = useCallback(async () => {
    ctl.current?.abort()
    if (!enabled) {
      setBatch({ id: 0, features: [] })
      setLoaded(kind, [])
      onStatus('off')
      return
    }
    if (map.getZoom() < minZoom) {
      setBatch({ id: 0, features: [] })
      setLoaded(kind, [])
      onStatus('zoom')
      return
    }
    const b = map.getBounds().pad(0.15)
    const view: BBox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
    const here = sources.filter((s) => s.extent[0] < view[2] && s.extent[2] > view[0] && s.extent[1] < view[3] && s.extent[3] > view[1])
    if (!here.length) {
      setBatch({ id: 0, features: [] })
      setLoaded(kind, [])
      onStatus('nosource')
      return
    }
    const c = new AbortController()
    ctl.current = c
    onStatus('loading')
    const px = map.getSize().x * 1.3
    const settled = await Promise.allSettled(here.map((s) => queryOverlay(s, view, px, c.signal)))
    if (c.signal.aborted) return
    const features: OverlayFeature[] = []
    let failed = 0
    for (const r of settled) {
      if (r.status === 'fulfilled') features.push(...r.value.features)
      else failed += 1
    }
    setBatch({ id: Date.now(), features })
    setLoaded(kind, features)
    onStatus(features.length ? 'ready' : failed ? 'error' : 'empty', here.map((s) => s.label).join(' · '))
  }, [enabled, map, minZoom, sources, kind, onStatus])

  const schedule = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void load(), 300)
  }, [load])

  useMapEvents({ moveend: schedule })
  useEffect(() => {
    schedule()
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
      ctl.current?.abort()
    }
  }, [schedule])

  const fc = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: batch.features.filter((f) => style(f)).map((f) => ({ type: 'Feature' as const, properties: { key: f.key }, geometry: f.geometry })),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [batch],
  )
  const byKey = useMemo(() => new Map(batch.features.map((f) => [f.key, f])), [batch])
  const labels = useMemo(() => {
    if (!label) return []
    const seen = new Set<string>()
    const out: Array<{ key: string; at: [number, number]; text: string }> = []
    for (const f of batch.features) {
      const text = label(f)
      if (!text || seen.has(text)) continue
      seen.add(text)
      out.push({ key: f.key, at: labelPoint(f.geometry), text })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch])

  if (!enabled || !batch.features.length) return null
  return (
    <>
      <GeoJSON key={batch.id} data={fc} pane={pane} interactive={false} style={(feat) => style(byKey.get((feat?.properties as { key: string }).key)!) ?? {}} />
      {labels.map((l) => (
        <Marker
          key={`${batch.id}-${l.key}`}
          position={l.at}
          interactive={false}
          keyboard={false}
          icon={L.divIcon({ className: `ov-label ov-label-${kind}`, html: `<span>${escapeHtml(l.text)}</span>`, iconSize: [0, 0] })}
        />
      ))}
    </>
  )
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}
