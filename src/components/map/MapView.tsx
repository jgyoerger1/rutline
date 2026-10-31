import { AnimatePresence, motion } from 'framer-motion'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowUp, Check, CloudArrowDown, CrosshairSimple, Footprints, GpsFix, List, Lock, MagnifyingGlass, MapPin, Mountains, Path, Pause, Play, Plus, Polygon as ParcelsIcon, Signpost, Trash, TreeEvergreen, X } from '@phosphor-icons/react'
import L from 'leaflet'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Circle, CircleMarker, MapContainer, Marker, Polygon, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { addTrail, addWaypoint, deleteTrail, liveTrails, liveWaypoints, updateTrail, updateWaypoint } from '../../lib/db'
import { degToCompass, fmtDistance, haversineM } from '../../lib/geo'
import { TRAIL_KINDS, WAYPOINT_ORDER, WAYPOINT_TYPES, type Trail, type TrailKind, type Waypoint, type WaypointType } from '../../lib/types'
import { useWatchPosition } from '../../lib/useGeo'
import { boundsOf, type Parcel } from '../../lib/parcels'
import { nowIndex } from '../../lib/weather'
import { campName, nameFor, useCamps } from '../../lib/camps'
import { useApp } from '../AppContext'
import { markerHtml, TYPE_ICON } from '../icons'
import { Button, Chip, Field, IconButton, Input, SectionLabel, Segmented, Sheet, Textarea } from '../ui'
import LetterSheet, { type LetterTarget } from './LetterSheet'
import ParcelLayer, { type ParcelStatus } from './ParcelLayer'
import TerrainLayer, { type TerrainState } from './TerrainLayer'
import OverlayLayer, { type OverlayState } from './OverlayLayer'
import PlaceSheet, { type Place } from './PlaceSheet'
import { UNIT_SOURCES, unitLabel, unitMapLabel } from '../../lib/huntUnits'
import { overlaysAt } from '../../lib/overlays'
import { ACCESS_SOURCES, PUBLIC_LEGEND, PUBLIC_SOURCES, accessStyle, describeAccess, describePublic, publicStyle } from '../../lib/publicLand'
import OfflineSheet from './OfflineSheet'
import GoToSheet, { type GoTo } from './GoToSheet'
import type { BBox } from '../../lib/parcels'
import ParcelSheet from './ParcelSheet'
import { rejectDiscovered } from '../../lib/parcelDiscovery'
import WaypointSheet from './WaypointSheet'

import { LAYERS } from '../../lib/basemaps'

const unitStyle = (): L.PathOptions => ({ color: '#f2ede2', weight: 1.6, opacity: 0.75, dashArray: '10 6', fill: false })

type AddMode = { kind: 'point'; type: WaypointType } | { kind: 'trail'; trail: TrailKind; points: [number, number][] } | null

// Deer trails carry the brand orange; your own routes are bone so they read as yours, not theirs
const TRAIL_STYLE: Record<TrailKind, L.PathOptions> = {
  trail: { color: '#e8702c', weight: 3.5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' },
  entry: { color: '#d6d0c3', weight: 3, dashArray: '10 7', opacity: 0.9, lineCap: 'round' },
  exit: { color: '#d6d0c3', weight: 3, dashArray: '2 8', opacity: 0.9, lineCap: 'round' },
  drag: { color: '#f5a86b', weight: 5, dashArray: '1 9', opacity: 1, lineCap: 'round' },
  walk: { color: '#f2ede2', weight: 3, dashArray: '1 6', opacity: 0.85, lineCap: 'round' },
}

/** A GPS recording in progress */
interface Recording {
  points: [number, number][]
  distance: number
  startedAt: number
  paused: boolean
}
const MAX_FIX_ACCURACY_M = 40
const MIN_STEP_M = 2.5
function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`
}

export default function MapView({ active }: { active: boolean }) {
  const { home, settings, setSettings, forecast, toast, focusRequest, clearFocus, setView, pro, openPro } = useApp()
  // Hillshade is free; slope and contours are Rutline Pro, so a saved Pro mode falls back without it
  const terrainOn = settings.terrainOn
  const terrainMode = pro ? settings.terrain : 'hillshade'
  const waypoints = useLiveQuery(liveWaypoints, [])
  const trails = useLiveQuery(liveTrails, [])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [selectedTrail, setSelectedTrail] = useState<number | null>(null)
  const [addMode, setAddMode] = useState<AddMode>(null)
  const [picker, setPicker] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [offlineOpen, setOfflineOpen] = useState(false)
  const [gotoOpen, setGotoOpen] = useState(false)
  // Where the last "Go to" landed; marked until the next one or until it is tapped
  const [gotoMark, setGotoMark] = useState<GoTo | null>(null)
  const [offlineBbox, setOfflineBbox] = useState<BBox | null>(null)
  const [filter, setFilter] = useState<Set<WaypointType>>(new Set())
  const [watch, setWatch] = useState(false)
  const [dismissHint, setDismissHint] = useState(false)
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null)
  const [parcelStatus, setParcelStatus] = useState<ParcelStatus>({ state: 'off', count: 0, truncated: false, sources: [] })
  const [letter, setLetter] = useState<LetterTarget | null>(null)
  const [place, setPlace] = useState<Place | null>(null)
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const onParcelStatus = useCallback((s: ParcelStatus) => setParcelStatus(s), [])
  const [parcelReload, setParcelReload] = useState(0)
  const { fix, error: geoError } = useWatchPosition(watch)
  const mapRef = useRef<L.Map | null>(null)

  // Record my walk: GPS fixes become a dotted line while the phone is awake
  const [rec, setRec] = useState<Recording | null>(null)
  const [recTick, setRecTick] = useState(0)
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null)
  useEffect(() => {
    if (!rec || rec.paused || !fix || fix.accuracy > MAX_FIX_ACCURACY_M) return
    setRec((r) => {
      if (!r || r.paused) return r
      const last = r.points[r.points.length - 1]
      const step = last ? haversineM({ lat: last[0], lon: last[1] }, fix) : 0
      if (last && step < MIN_STEP_M) return r
      return { ...r, points: [...r.points, [fix.lat, fix.lon]], distance: r.distance + step }
    })
  }, [fix]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!rec) return
    const id = window.setInterval(() => setRecTick((t) => t + 1), 1000)
    return () => window.clearInterval(id)
  }, [!!rec]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Keep the screen on while recording; the browser pauses GPS when it sleeps
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    const grab = async () => {
      if (!rec || !nav.wakeLock || document.visibilityState !== 'visible') return
      try {
        wakeLock.current = await nav.wakeLock.request('screen')
      } catch {
        /* not allowed, carry on */
      }
    }
    void grab()
    document.addEventListener('visibilitychange', grab)
    return () => {
      document.removeEventListener('visibilitychange', grab)
      void wakeLock.current?.release()
      wakeLock.current = null
    }
  }, [!!rec]) // eslint-disable-line react-hooks/exhaustive-deps
  function startWalk() {
    setPicker(false)
    setAddMode(null)
    setWatch(true)
    setRec({ points: fix && fix.accuracy <= MAX_FIX_ACCURACY_M ? [[fix.lat, fix.lon]] : [], distance: 0, startedAt: Date.now(), paused: false })
    toast(fix ? 'Recording your walk' : 'Recording. Waiting for a GPS fix')
  }
  async function finishWalk() {
    if (!rec) return
    if (rec.points.length < 2) {
      toast('Not enough movement to save yet')
      return
    }
    const d = new Date(rec.startedAt)
    const id = await addTrail({ name: `Walk ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`, kind: 'walk', points: rec.points })
    setRec(null)
    setSelectedTrail(id)
    toast(`Walk saved: ${fmtDistance(rec.distance, settings.units)}`)
  }

  const selected = useMemo(() => waypoints?.find((w) => w.id === selectedId) ?? null, [waypoints, selectedId])
  const now = forecast ? forecast.hours[nowIndex(forecast)] : null
  const visible = useMemo(() => (waypoints ?? []).filter((w) => filter.size === 0 || filter.has(w.type)), [waypoints, filter])
  const typesPresent = useMemo(() => WAYPOINT_ORDER.filter((t) => waypoints?.some((w) => w.type === t)), [waypoints])

  useEffect(() => {
    if (geoError) toast(geoError)
  }, [geoError, toast])

  // External "open this pin" request (from stand picks)
  useEffect(() => {
    if (focusRequest == null || !waypoints) return
    const w = waypoints.find((x) => x.id === focusRequest)
    if (w) {
      setSelectedId(w.id!)
      mapRef.current?.flyTo([w.lat, w.lon], Math.max(mapRef.current.getZoom(), 16), { duration: 0.8 })
    }
    clearFocus()
  }, [focusRequest, waypoints, clearFocus])

  // Leaflet needs a size recalculation when the view becomes visible again
  useEffect(() => {
    if (active) window.setTimeout(() => mapRef.current?.invalidateSize(), 50)
  }, [active])

  const placePoint = useCallback(
    async (type: WaypointType, lat: number, lon: number) => {
      const n = (waypoints ?? []).filter((w) => w.type === type).length + 1
      const id = await addWaypoint({ type, name: `${WAYPOINT_TYPES[type].label} ${n}`, lat, lon })
      setAddMode(null)
      setSelectedId(id)
      toast(`${WAYPOINT_TYPES[type].label} pinned`)
    },
    [waypoints, toast],
  )

  const onMapClick = useCallback(
    (lat: number, lon: number) => {
      if (!addMode) {
        setSelectedId(null)
        setSelectedTrail(null)
        setSelectedParcel(null)
        if (settingsRef.current.publicOn || settingsRef.current.unitsOn) {
          const at = overlaysAt(lat, lon)
          if (at.public.length || at.access.length || at.units.length) setPlace({ lat, lon, ...at })
        }
        return
      }
      if (addMode.kind === 'point') void placePoint(addMode.type, lat, lon)
      else setAddMode({ ...addMode, points: [...addMode.points, [lat, lon]] })
    },
    [addMode, placePoint],
  )

  async function finishTrail() {
    if (!addMode || addMode.kind !== 'trail') return
    if (addMode.points.length < 2) {
      toast('Tap at least two points')
      return
    }
    const n = (trails ?? []).filter((t) => t.kind === addMode.trail).length + 1
    await addTrail({ name: `${TRAIL_KINDS[addMode.trail].label} ${n}`, kind: addMode.trail, points: addMode.points })
    toast(`${TRAIL_KINDS[addMode.trail].label} saved`)
    setAddMode(null)
  }

  async function pinAtMyLocation(type: WaypointType) {
    setPicker(false)
    if (fix) {
      await placePoint(type, fix.lat, fix.lon)
      return
    }
    setWatch(true)
    toast('Waiting for a GPS fix, then tap the map or try again')
    setAddMode({ kind: 'point', type })
  }

  const center: [number, number] = home ? [home.lat, home.lon] : [39.5, -98.35]
  const zoom = home ? 15 : 4
  const layer = LAYERS[settings.mapLayer]
  const [terrainStatus, setTerrainStatus] = useState<TerrainState>('off')
  const [publicStatus, setPublicStatus] = useState<OverlayState>('off')
  const [unitsStatus, setUnitsStatus] = useState<OverlayState>('off')
  const onPublicStatus = useCallback((s: OverlayState) => setPublicStatus(s), [])
  const onAccessStatus = useCallback(() => {}, [])
  const onUnitsStatus = useCallback((s: OverlayState) => setUnitsStatus(s), [])

  // Scent cone from the selected stand, using the current wind
  const cone = useMemo(() => {
    if (!selected || !now || !WAYPOINT_TYPES[selected.type].hasWinds) return null
    const to = (now.windDir + 180) % 360
    const len = 420 // metres
    const pts: [number, number][] = [[selected.lat, selected.lon]]
    for (const off of [-16, -8, 0, 8, 16]) {
      const b = ((to + off) * Math.PI) / 180
      const dLat = (len * Math.cos(b)) / 111320
      const dLon = (len * Math.sin(b)) / (111320 * Math.cos((selected.lat * Math.PI) / 180))
      pts.push([selected.lat + dLat, selected.lon + dLon])
    }
    return pts
  }, [selected, now])

  return (
    <div className="relative w-full h-full">
      {/* Leaflet stacks its panes at z-index 400-1000; isolate them so app overlays sit above the map */}
      <div className="absolute inset-0 isolate z-0">
      <MapContainer center={center} zoom={zoom} zoomControl={false} attributionControl className="w-full h-full" ref={mapRef as never} maxZoom={20} preferCanvas>
        <TileLayer key={settings.mapLayer} url={layer.url} attribution={layer.attribution} maxNativeZoom={layer.maxNativeZoom} maxZoom={20} />
        <TerrainLayer enabled={terrainOn} mode={terrainMode} onStatus={setTerrainStatus} />
        <OverlayLayer kind="public" enabled={settings.publicOn} sources={PUBLIC_SOURCES} minZoom={9} style={publicStyle} onStatus={onPublicStatus} />
        <OverlayLayer kind="access" enabled={settings.publicOn} sources={ACCESS_SOURCES} minZoom={9} style={accessStyle} onStatus={onAccessStatus} />
        <OverlayLayer kind="units" enabled={settings.unitsOn} sources={UNIT_SOURCES} minZoom={7} style={unitStyle} label={unitMapLabel} onStatus={onUnitsStatus} />
        <MapEvents onClick={onMapClick} />
        <FlyToHome home={home} />
        <ParcelLayer
          enabled={settings.parcelsEnabled}
          custom={settings.customParcelSource}
          interactive={!addMode}
          selectedKey={selectedParcel?.key ?? null}
          onSelect={(p) => {
            setSelectedParcel(p)
            setSelectedId(null)
            setSelectedTrail(null)
          }}
          onStatus={onParcelStatus}
          reloadKey={parcelReload}
        />

        {(trails ?? []).map((t) => (
          <Polyline
            key={t.id}
            positions={t.points}
            pathOptions={{ ...TRAIL_STYLE[t.kind], weight: selectedTrail === t.id ? (TRAIL_STYLE[t.kind].weight as number) + 2 : TRAIL_STYLE[t.kind].weight }}
            interactive={false}
          />
        ))}
        {/* A wide, invisible stroke on top of each line so a finger can hit it */}
        {(trails ?? []).map((t) => (
          <Polyline
            key={`hit-${t.id}`}
            positions={t.points}
            pathOptions={{ color: '#000', weight: 24, opacity: 0.001, lineCap: 'round', lineJoin: 'round' }}
            eventHandlers={{
              click: (e) => {
                if (addMode) return
                L.DomEvent.stopPropagation(e)
                setSelectedTrail(t.id!)
                setSelectedId(null)
                setSelectedParcel(null)
              },
            }}
          />
        ))}
        {selectedTrail != null &&
          (trails ?? [])
            .find((t) => t.id === selectedTrail)
            ?.points.map((pt, i) => <Circle key={`v-${i}`} center={pt} radius={1.5} pathOptions={{ color: '#f2ede2', weight: 2, fillColor: '#0f1110', fillOpacity: 1 }} interactive={false} />)}

        {cone && <Polygon positions={cone} pathOptions={{ color: '#f5a86b', weight: 1.5, opacity: 0.9, fillColor: '#e8702c', fillOpacity: 0.26, className: 'scent-cone' }} interactive={false} />}

        {visible.map((w) => {
          const isNew = Date.now() - w.createdAt < 4000
          const shared = !!w.campId
          return (
          <Marker
            key={`${w.id}-${w.type}-${w.id === selectedId ? 's' : ''}${isNew ? '-n' : ''}${shared ? '-c' : ''}`}
            position={[w.lat, w.lon]}
            icon={L.divIcon({ className: '', html: markerHtml(w.type, w.id === selectedId, isNew, shared), iconSize: [36, 36], iconAnchor: [18, 41] })}
            draggable={w.id === selectedId}
            eventHandlers={{
              click: () => {
                setSelectedId(w.id!)
                setSelectedTrail(null)
                setSelectedParcel(null)
              },
              dragend: (e) => {
                const ll = (e.target as L.Marker).getLatLng()
                void updateWaypoint(w.id!, { lat: ll.lat, lon: ll.lng })
              },
            }}
            zIndexOffset={w.id === selectedId ? 1000 : 0}
          />
          )
        })}

        {rec && rec.points.length > 1 && <Polyline positions={rec.points} pathOptions={{ ...TRAIL_STYLE.walk, color: '#f5a86b', weight: 4 }} interactive={false} />}
        {addMode?.kind === 'trail' && addMode.points.length > 0 && (
          <>
            <Polyline positions={addMode.points} pathOptions={{ ...TRAIL_STYLE[addMode.trail], opacity: 0.7 }} />
            {addMode.points.map((p, i) => (
              <Circle key={i} center={p} radius={2} pathOptions={{ color: '#f2ede2', fillOpacity: 1 }} />
            ))}
          </>
        )}

        {fix && (
          <>
            <Circle center={[fix.lat, fix.lon]} radius={fix.accuracy} pathOptions={{ color: '#f2ede2', weight: 1, opacity: 0.35, fillOpacity: 0.06 }} interactive={false} />
            <Marker position={[fix.lat, fix.lon]} icon={L.divIcon({ className: '', html: '<div class="dw-me"></div>', iconSize: [16, 16], iconAnchor: [8, 8] })} interactive={false} />
          </>
        )}
        {gotoMark && (
          <CircleMarker center={[gotoMark.lat, gotoMark.lon]} radius={9} pathOptions={{ color: '#f2ede2', weight: 2, fillColor: '#e8702c', fillOpacity: 0.9 }} eventHandlers={{ click: () => setGotoMark(null) }}>
            <Tooltip permanent direction="top" offset={[0, -10]} className="goto-tip">
              {gotoMark.label}
            </Tooltip>
          </CircleMarker>
        )}
      </MapContainer>
      </div>

      {/* Top controls */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-col gap-2 pointer-events-none">
      {/* One strip: scrolls sideways on a phone, wraps on wider screens */}
      <div className="flex items-center gap-2 overflow-x-auto no-bar -mx-3 px-3 pb-0.5 pointer-events-auto md:pointer-events-none md:flex-wrap md:items-start md:overflow-visible md:mx-0 md:px-0 md:pb-0">
        <button onClick={() => setGotoOpen(true)} aria-label="Go to a place" title="Go to a place" className="push order-first md:order-none pointer-events-auto shrink-0 glass rounded-xl h-11 w-11 grid place-items-center text-bone-50">
          <MagnifyingGlass size={18} weight="bold" />
        </button>
        {now && (
          <button onClick={() => setView('forecast')} className="push pointer-events-auto shrink-0 whitespace-nowrap glass rounded-xl h-11 px-3 inline-flex items-center gap-2 text-sm">
            <ArrowUp size={16} weight="bold" className="text-ember-400" style={{ transform: `rotate(${now.windDir + 180}deg)` }} />
            <span className="font-medium">{degToCompass(now.windDir)}</span>
            <span className="font-mono text-bone-400 tnum">{Math.round(settings.units === 'metric' ? now.windMph * 1.60934 : now.windMph)} {settings.units === 'metric' ? 'km/h' : 'mph'}</span>
          </button>
        )}
        <button
          onClick={() => setSettings({ parcelsEnabled: !settings.parcelsEnabled })}
          aria-pressed={settings.parcelsEnabled}
          title="Property lines"
          className={`push pointer-events-auto shrink-0 glass rounded-xl h-11 px-3 inline-flex items-center gap-2 text-sm ${settings.parcelsEnabled ? 'text-bone-50' : 'text-bone-400'}`}
        >
          <ParcelsIcon size={16} weight={settings.parcelsEnabled ? 'fill' : 'regular'} className={settings.parcelsEnabled ? 'text-ember-400' : ''} />
          <span className="font-medium hidden md:inline">Lines</span>
          {settings.parcelsEnabled && (
            <span className="font-mono text-[11px] text-bone-400 tnum inline-flex items-center gap-1.5">
              {(parcelStatus.state === 'loading' || parcelStatus.state === 'finding') && <span className="w-1.5 h-1.5 rounded-full bg-ember-400 breathe" />}
              {parcelStatus.state === 'zoom' ? 'zoom in' : parcelStatus.state === 'finding' ? 'finding county' : parcelStatus.state === 'ready' ? `${parcelStatus.count}${parcelStatus.truncated ? '+' : ''}` : parcelStatus.state === 'empty' ? 'none here' : parcelStatus.state === 'nosource' ? 'no source' : parcelStatus.state === 'error' ? 'offline' : ''}
            </span>
          )}
        </button>
        <button
          onClick={() => setSettings({ publicOn: !settings.publicOn })}
          aria-pressed={settings.publicOn}
          title="Public land and walk-in access"
          className={`push pointer-events-auto shrink-0 glass rounded-xl h-11 px-3 inline-flex items-center gap-2 text-sm ${settings.publicOn ? 'text-bone-50' : 'text-bone-400'}`}
        >
          <TreeEvergreen size={16} weight={settings.publicOn ? 'fill' : 'regular'} className={settings.publicOn ? 'text-[#a9c79a]' : ''} />
          <span className="font-medium hidden md:inline">Public</span>
          {settings.publicOn && (
            <span className="font-mono text-[11px] text-bone-400 tnum inline-flex items-center gap-1.5">
              {publicStatus === 'loading' && <span className="w-1.5 h-1.5 rounded-full bg-ember-400 breathe" />}
              {publicStatus === 'zoom' ? 'zoom in' : publicStatus === 'empty' ? 'none here' : publicStatus === 'error' ? 'offline' : ''}
            </span>
          )}
        </button>
        <button
          onClick={() => setSettings({ unitsOn: !settings.unitsOn })}
          aria-pressed={settings.unitsOn}
          title="Deer hunting units"
          className={`push pointer-events-auto shrink-0 glass rounded-xl h-11 px-3 inline-flex items-center gap-2 text-sm ${settings.unitsOn ? 'text-bone-50' : 'text-bone-400'}`}
        >
          <Signpost size={16} weight={settings.unitsOn ? 'fill' : 'regular'} className={settings.unitsOn ? 'text-ember-400' : ''} />
          <span className="font-medium hidden md:inline">Units</span>
          {settings.unitsOn && (
            <span className="font-mono text-[11px] text-bone-400 tnum inline-flex items-center gap-1.5">
              {unitsStatus === 'loading' && <span className="w-1.5 h-1.5 rounded-full bg-ember-400 breathe" />}
              {unitsStatus === 'zoom' ? 'zoom in' : unitsStatus === 'nosource' ? 'by county' : unitsStatus === 'error' ? 'offline' : ''}
            </span>
          )}
        </button>
        <button
          onClick={() => {
            // Desktop: the chip toggles and the segmented picks the mode. Phone: no room, so the chip
            // cycles off -> shade -> slope -> 5 ft -> off; free skips the two Pro modes.
            if (window.innerWidth >= 768) setSettings({ terrainOn: !terrainOn })
            else if (!terrainOn) setSettings({ terrainOn: true, terrain: 'hillshade' })
            else if (!pro) setSettings({ terrainOn: false })
            else if (settings.terrain === 'hillshade') setSettings({ terrain: 'slope' })
            else if (settings.terrain === 'slope') setSettings({ terrain: 'contours' })
            else setSettings({ terrainOn: false })
          }}
          aria-pressed={terrainOn}
          title="LiDAR terrain (USGS 3DEP)"
          className={`push pointer-events-auto shrink-0 glass rounded-xl h-11 px-3 inline-flex items-center gap-2 text-sm ${terrainOn ? 'text-bone-50' : 'text-bone-400'}`}
        >
          <Mountains size={16} weight={terrainOn ? 'fill' : 'regular'} className={terrainOn ? 'text-ember-400' : ''} />
          <span className="font-medium hidden md:inline">Terrain</span>
          {terrainOn && (
            <span className="font-mono text-[11px] text-bone-400 tnum inline-flex items-center gap-1.5">
              <span className="md:hidden text-bone-50">{terrainMode === 'hillshade' ? 'shade' : terrainMode === 'slope' ? 'slope' : '5 ft'}</span>
              {terrainStatus === 'loading' && <span className="w-1.5 h-1.5 rounded-full bg-ember-400 breathe" />}
              {terrainStatus === 'zoom' ? 'zoom in' : terrainStatus === 'error' ? 'offline' : ''}
            </span>
          )}
        </button>
        {terrainOn && pro && (
          <div className="hidden md:block shrink-0 pointer-events-auto">
            <Segmented id="terrain" value={terrainMode} onChange={(terrain) => setSettings({ terrain })} options={[{ value: 'hillshade', label: 'Shade' }, { value: 'slope', label: 'Slope' }, { value: 'contours', label: '5 ft' }]} className="glass" />
          </div>
        )}
        {terrainOn && !pro && (
          <button onClick={() => openPro('terrain')} className="push pointer-events-auto shrink-0 glass rounded-xl h-11 px-3 inline-flex items-center gap-1.5 text-[12px] text-bone-400" title="Slope and 5-foot contours are Rutline Pro">
            <Lock size={12} /> Slope · 5 ft
          </button>
        )}
        <div className="order-first md:order-none md:ml-auto shrink-0 pointer-events-auto">
          <Segmented id="layer" value={settings.mapLayer} onChange={(mapLayer) => setSettings({ mapLayer })} options={[{ value: 'satellite', label: 'Sat' }, { value: 'topo', label: 'Topo' }]} className="glass" />
        </div>
      </div>
      {settings.publicOn && (
        <div className="self-start max-w-full pointer-events-auto glass rounded-xl px-3 py-1.5 flex items-center gap-x-3 text-[11px] text-bone-200 overflow-x-auto no-bar whitespace-nowrap">
          {PUBLIC_LEGEND.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5 shrink-0">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: l.tone, opacity: 0.85 }} />
              <span className="md:hidden">{l.short}</span>
              <span className="hidden md:inline">{l.label}</span>
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-sm border border-dashed border-ember-300" />
            Walk-in
          </span>
          <span className="hidden md:inline text-bone-600">Tap an area for access rules</span>
        </div>
      )}
      {typesPresent.length > 1 && (
        <div className="overflow-x-auto no-bar -mx-3 px-3 pointer-events-auto touch-pan-x">
          {/* The scroller itself needs pointer events: iOS will not pan a container that has none, even when its children do */}
          <div className="flex gap-1.5 min-w-max pr-4">
            <Chip active={filter.size === 0} onClick={() => setFilter(new Set())}>
              All
            </Chip>
            {typesPresent.map((t) => {
              const I = TYPE_ICON[t]
              const on = filter.has(t)
              return (
                <Chip
                  key={t}
                  active={on}
                  onClick={() => {
                    const next = new Set(filter)
                    if (on) next.delete(t)
                    else next.add(t)
                    setFilter(next)
                  }}
                >
                  <I size={14} weight="duotone" /> {WAYPOINT_TYPES[t].plural}
                </Chip>
              )
            })}
          </div>
        </div>
      )}
      </div>

      {/* Right-side controls */}
      <div className="absolute right-3 bottom-6 z-10 flex flex-col gap-2 items-end">
        <IconButton label="Pins list" onClick={() => setListOpen(true)}>
          <List size={20} />
        </IconButton>
        <IconButton
          label="Offline areas"
          onClick={() => {
            const b = mapRef.current?.getBounds()
            setOfflineBbox(b ? [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] : null)
            setOfflineOpen(true)
          }}
        >
          <CloudArrowDown size={20} />
        </IconButton>
        <IconButton
          label="My location"
          onClick={() => {
            setWatch(true)
            if (fix) mapRef.current?.flyTo([fix.lat, fix.lon], Math.max(mapRef.current.getZoom(), 16), { duration: 0.8 })
          }}
          className={watch && fix ? 'text-ember-400' : ''}
        >
          <GpsFix size={20} weight={fix ? 'fill' : 'regular'} />
        </IconButton>
        <button onClick={() => (addMode ? setAddMode(null) : setPicker(true))} aria-label={addMode ? 'Cancel' : 'Add a pin'} className={`push w-14 h-14 rounded-2xl grid place-items-center border shadow-pine transition-colors ${addMode ? 'glass text-bone-50' : 'bg-ember-500 text-ember-950 border-ember-300/30 hover:bg-ember-400'}`}>
          <motion.span animate={{ rotate: addMode ? 45 : 0 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} className="grid place-items-center">
            <Plus size={26} weight="bold" />
          </motion.span>
        </button>
      </div>

      {/* Add-mode banner */}
      <AnimatePresence>
        {rec && !addMode && (
          <motion.div key="rec" initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }} className="absolute left-1/2 -translate-x-1/2 bottom-6 z-10 glass rounded-2xl px-4 py-3 flex items-center gap-3 max-w-[calc(100%-7rem)]" role="status" aria-live="polite">
            <span className="text-sm inline-flex items-center gap-2 whitespace-nowrap">
              <span className={`w-2 h-2 rounded-full ${rec.paused ? 'bg-bone-600' : 'bg-ember-500 breathe'}`} />
              <span className="font-mono tnum">{fmtDistance(rec.distance, settings.units)}</span>
              <span className="text-bone-600">·</span>
              <span className="font-mono tnum">{fmtElapsed(Date.now() - rec.startedAt + recTick * 0)}</span>
              {rec.paused && <span className="text-bone-500">paused</span>}
              {!rec.paused && !rec.points.length && <span className="text-bone-500">waiting for GPS</span>}
            </span>
            <Button size="sm" onClick={() => setRec({ ...rec, paused: !rec.paused })} aria-label={rec.paused ? 'Resume recording' : 'Pause recording'}>
              {rec.paused ? <Play size={14} weight="fill" /> : <Pause size={14} weight="fill" />}
            </Button>
            <Button size="sm" variant="primary" onClick={() => void finishWalk()} disabled={rec.points.length < 2}>
              <Check size={14} /> Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRec(null)} aria-label="Discard recording">
              <X size={14} />
            </Button>
          </motion.div>
        )}
        {addMode && (
          <motion.div key="banner" initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }} className="absolute left-1/2 -translate-x-1/2 bottom-6 z-10 glass rounded-2xl px-4 py-3 flex items-center gap-3 max-w-[calc(100%-7rem)]">
            {addMode.kind === 'point' ? (
              <>
                <span className="text-sm">
                  Tap the map to place your <span className="font-medium">{WAYPOINT_TYPES[addMode.type].label.toLowerCase()}</span>
                </span>
                {fix && (
                  <Button size="sm" variant="primary" onClick={() => void placePoint(addMode.type, fix.lat, fix.lon)}>
                    <GpsFix size={14} /> Here
                  </Button>
                )}
              </>
            ) : (
              <>
                <span className="text-sm">
                  <span className="font-medium">{TRAIL_KINDS[addMode.trail].label}</span> · {addMode.points.length} point{addMode.points.length === 1 ? '' : 's'}
                </span>
                {fix && (
                  <Button size="sm" onClick={() => setAddMode({ ...addMode, points: [...addMode.points, [fix.lat, fix.lon]] })}>
                    <GpsFix size={14} /> Add here
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setAddMode({ ...addMode, points: addMode.points.slice(0, -1) })} disabled={!addMode.points.length}>
                  Undo
                </Button>
                <Button size="sm" variant="primary" onClick={finishTrail}>
                  <Check size={14} weight="bold" /> Save
                </Button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* First-run hint */}
      <AnimatePresence>
        {waypoints && waypoints.length === 0 && !addMode && !dismissHint && (
          <motion.div key="hint" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }} className="absolute left-3 bottom-6 z-10 max-w-[300px] glass rounded-2xl px-4 py-3.5">
            <div className="flex items-start gap-3">
              <MapPin size={20} weight="duotone" className="text-ember-400 mt-0.5 shrink-0" />
              <div className="text-[13px] leading-relaxed text-bone-200">
                <div className="font-medium text-bone-50">No pins yet</div>
                Tap the orange button to drop your first stand, camera or scrape. Everything stays on this device.
              </div>
              <button onClick={() => setDismissHint(true)} aria-label="Dismiss" className="text-bone-600 hover:text-bone-50 -mr-1">
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Type picker */}
      <Sheet open={picker} onClose={() => setPicker(false)} title="Drop a pin">
        <div className="grid grid-cols-3 gap-2 cascade">
          {WAYPOINT_ORDER.filter((t) => t !== 'blood').map((t, i) => {
            const I = TYPE_ICON[t]
            return (
              <button
                key={t}
                style={{ ['--i' as string]: i }}
                onClick={() => {
                  setPicker(false)
                  setAddMode({ kind: 'point', type: t })
                }}
                className="push rounded-2xl bg-pine-900 border border-bone-50/8 hover:border-bone-50/20 px-3 py-4 flex flex-col items-center gap-2 text-center transition-colors"
              >
                <I size={24} weight="duotone" className="text-ember-400" />
                <span className="text-[12.5px] font-medium leading-tight">{WAYPOINT_TYPES[t].label}</span>
              </button>
            )
          })}
        </div>
        <div className="mt-6">
          <SectionLabel className="mb-2">Record with GPS</SectionLabel>
          <button onClick={startWalk} className="push w-full rounded-2xl bg-pine-900 border border-bone-50/8 hover:border-bone-50/20 px-4 py-3 flex items-center gap-3 text-left transition-colors">
            <Footprints size={20} weight="duotone" className="text-ember-400 shrink-0" />
            <div>
              <div className="text-[13px] font-medium">Record my walk</div>
              <div className="text-[11.5px] text-bone-600">Your route as you move. Keep the phone awake; it saves as a line.</div>
            </div>
          </button>
        </div>
        <div className="mt-6">
          <SectionLabel className="mb-2">Draw a line</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(TRAIL_KINDS) as TrailKind[]).filter((k) => k !== 'walk').map((k) => (
              <button
                key={k}
                onClick={() => {
                  setPicker(false)
                  setAddMode({ kind: 'trail', trail: k, points: [] })
                }}
                className="push rounded-2xl bg-pine-900 border border-bone-50/8 hover:border-bone-50/20 px-4 py-3 flex items-center gap-3 text-left transition-colors"
              >
                <Path size={20} weight="duotone" className="text-ember-400 shrink-0" />
                <div>
                  <div className="text-[13px] font-medium">{TRAIL_KINDS[k].label}</div>
                  <div className="text-[11.5px] text-bone-600">{TRAIL_KINDS[k].hint}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="mt-6 border-t border-bone-50/8 pt-4">
          <SectionLabel className="mb-2">Pin at my location</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {(['stand', 'camera', 'scrape', 'rub', 'bedding'] as WaypointType[]).map((t) => (
              <Chip key={t} onClick={() => void pinAtMyLocation(t)}>
                <GpsFix size={13} /> {WAYPOINT_TYPES[t].label}
              </Chip>
            ))}
          </div>
        </div>
      </Sheet>

      {/* Pins list */}
      <OfflineSheet open={offlineOpen} onClose={() => setOfflineOpen(false)} bbox={offlineBbox} layer={settings.mapLayer} custom={settings.customParcelSource} onShow={(a) => mapRef.current?.fitBounds(L.latLngBounds([a.bbox[1], a.bbox[0]], [a.bbox[3], a.bbox[2]]), { padding: [20, 20] })} />
      <GoToSheet
        open={gotoOpen}
        onClose={() => setGotoOpen(false)}
        onGo={(p) => {
          setGotoMark(p)
          mapRef.current?.flyTo([p.lat, p.lon], p.zoom, { duration: 0.9 })
        }}
      />
      <PinList open={listOpen} onClose={() => setListOpen(false)} waypoints={waypoints ?? []} trails={trails ?? []} me={fix} onPick={(w) => { setListOpen(false); setSelectedId(w.id!); mapRef.current?.flyTo([w.lat, w.lon], Math.max(mapRef.current.getZoom(), 16), { duration: 0.8 }) }} onPickTrail={(t) => { setListOpen(false); setSelectedTrail(t.id!); mapRef.current?.fitBounds(L.latLngBounds(t.points), { padding: [60, 60] }) }} />

      <WaypointSheet waypoint={selected} me={fix} windDir={now?.windDir} onClose={() => setSelectedId(null)} onLetter={(t) => setLetter(t)} />

      <ParcelSheet
        parcel={selectedParcel}
        alsoHere={
          selectedParcel && (settings.publicOn || settings.unitsOn)
            ? (() => {
                const at = overlaysAt(selectedParcel.centroid[0], selectedParcel.centroid[1])
                const lines: string[] = []
                for (const f of at.units) {
                  const l = unitLabel(f)
                  if (l && !lines.includes(l)) lines.push(l)
                }
                for (const f of at.public) {
                  const d = describePublic(f)
                  const l = `${d.name}${d.manager ? ` · ${d.manager}` : ''}`
                  if (!lines.includes(l)) lines.push(l)
                }
                for (const f of at.access) {
                  const d = describeAccess(f)
                  if (!lines.includes(d.program)) lines.push(d.program)
                }
                return lines
              })()
            : []
        }
        onClose={() => setSelectedParcel(null)}
        onCenter={(p) => mapRef.current?.fitBounds(L.latLngBounds(boundsOf(p.geometry)), { padding: [48, 48] })}
        onLetter={(t) => setLetter(t)}
        onSaved={(id) => {
          setSelectedParcel(null)
          setSelectedId(id)
        }}
        onRejectSource={(sourceId) => {
          rejectDiscovered(sourceId)
          setSelectedParcel(null)
          setParcelReload((n) => n + 1)
          toast('Dropped that layer. Looking for another.')
        }}
      />

      <LetterSheet target={letter} onClose={() => setLetter(null)} />
      <PlaceSheet place={place} onClose={() => setPlace(null)} />

      <TrailSheet trail={trails?.find((t) => t.id === selectedTrail) ?? null} onClose={() => setSelectedTrail(null)} onZoom={(t) => mapRef.current?.fitBounds(L.latLngBounds(t.points), { padding: [60, 60] })} />
    </div>
  )
}

function MapEvents({ onClick }: { onClick: (lat: number, lon: number) => void }) {
  const map = useMapEvents({ click: (e) => onClick(e.latlng.lat, e.latlng.lng) })
  // Dev builds expose the map for console debugging
  if (import.meta.env.DEV) (window as unknown as { __map?: L.Map }).__map = map
  return null
}

function FlyToHome({ home }: { home: { lat: number; lon: number } | null }) {
  const map = useMap()
  const last = useRef<string>('')
  useEffect(() => {
    if (!home) return
    const key = `${home.lat},${home.lon}`
    if (key === last.current) return
    const first = last.current === ''
    last.current = key
    if (first) map.setView([home.lat, home.lon], 15)
    else map.flyTo([home.lat, home.lon], 15, { duration: 1 })
  }, [home, map])
  return null
}

function PinList({ open, onClose, waypoints, trails, me, onPick, onPickTrail }: { open: boolean; onClose: () => void; waypoints: Waypoint[]; trails: Trail[]; me: { lat: number; lon: number } | null; onPick: (w: Waypoint) => void; onPickTrail: (t: Trail) => void }) {
  const { settings } = useApp()
  const [q, setQ] = useState('')
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    const list = waypoints.filter((w) => !term || w.name.toLowerCase().includes(term) || w.note.toLowerCase().includes(term) || WAYPOINT_TYPES[w.type].label.toLowerCase().includes(term))
    if (me) return list.map((w) => ({ w, d: haversineM(me, w) })).sort((a, b) => a.d - b.d)
    return list.map((w) => ({ w, d: null as number | null })).sort((a, b) => b.w.updatedAt - a.w.updatedAt)
  }, [waypoints, me, q])
  return (
    <Sheet open={open} onClose={onClose} title={`Pins · ${waypoints.length}`}>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pins" className="mb-3" />
      {rows.length === 0 && <div className="text-sm text-bone-600 py-6 text-center">{waypoints.length ? 'No pins match.' : 'Nothing pinned yet.'}</div>}
      <ul className="divide-y divide-bone-50/8">
        {rows.map(({ w, d }) => {
          const I = TYPE_ICON[w.type]
          return (
            <li key={w.id}>
              <button onClick={() => onPick(w)} className="push w-full flex items-center gap-3 py-2.5 text-left hover:bg-pine-800/40 rounded-lg px-1 -mx-1">
                <I size={18} weight="duotone" className="text-bone-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{w.name}</div>
                  <div className="text-[11.5px] text-bone-600 truncate">
                    {WAYPOINT_TYPES[w.type].label}
                    {w.campId ? ` · ${campName(w.campId) ?? 'camp'}${w.ownerId ? `, ${nameFor(w.ownerId)}` : ''}` : ''}
                    {w.note ? ` · ${w.note}` : ''}
                  </div>
                </div>
                {d != null && <span className="font-mono text-[12px] text-bone-400 tnum shrink-0">{fmtDistance(d, settings.units)}</span>}
              </button>
            </li>
          )
        })}
      </ul>
      {trails.length > 0 && (
        <>
          <SectionLabel className="mt-5 mb-1">Lines</SectionLabel>
          <ul className="divide-y divide-bone-50/8">
            {trails.map((t) => (
              <li key={t.id}>
                <button onClick={() => onPickTrail(t)} className="push w-full flex items-center gap-3 py-2.5 text-left hover:bg-pine-800/40 rounded-lg px-1 -mx-1">
                  <Path size={18} weight="duotone" className="text-bone-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{t.name}</div>
                    <div className="text-[11.5px] text-bone-600 truncate">
                      {TRAIL_KINDS[t.kind].label} · {t.points.length} points
                      {t.campId ? ` · ${campName(t.campId) ?? 'camp'}${t.ownerId ? `, ${nameFor(t.ownerId)}` : ''}` : ''}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Sheet>
  )
}

function TrailSheet({ trail, onClose, onZoom }: { trail: Trail | null; onClose: () => void; onZoom: (t: Trail) => void }) {
  const { toast, settings } = useApp()
  const camps = useCamps()
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  useEffect(() => {
    if (trail) {
      setName(trail.name)
      setNote(trail.note)
    }
  }, [trail?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const length = useMemo(() => {
    if (!trail) return 0
    let m = 0
    for (let i = 1; i < trail.points.length; i++) m += haversineM({ lat: trail.points[i - 1][0], lon: trail.points[i - 1][1] }, { lat: trail.points[i][0], lon: trail.points[i][1] })
    return m
  }, [trail])
  return (
    <Sheet
      open={!!trail}
      onClose={onClose}
      scrollKey={trail?.id ?? null}
      title={
        trail ? (
          <span className="inline-flex items-center gap-2">
            <Path size={18} weight="duotone" className="text-ember-400" />
            {TRAIL_KINDS[trail.kind].label}
          </span>
        ) : null
      }
      footer={
        trail ? (
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                if (!confirm(`Delete "${trail.name}"?${trail.campId ? ' It disappears for the whole camp.' : ''}`)) return
                await deleteTrail(trail.id!)
                toast('Line deleted')
                onClose()
              }}
            >
              <Trash size={15} /> Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onZoom(trail)}>
              <CrosshairSimple size={16} /> Zoom to line
            </Button>
          </div>
        ) : null
      }
    >
      {trail && (
        <div className="space-y-6">
          <Field label="Name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                if (name.trim() && name !== trail.name) void updateTrail(trail.id!, { name: name.trim() })
              }}
            />
          </Field>

          <Field label="Kind">
            <select value={trail.kind} onChange={(e) => void updateTrail(trail.id!, { kind: e.target.value as TrailKind })} className="w-full h-11 px-3.5 rounded-xl bg-pine-900 border border-bone-50/10 text-bone-50 outline-none focus:border-ember-500/60">
              {(Object.keys(TRAIL_KINDS) as TrailKind[]).map((k) => (
                <option key={k} value={k}>
                  {TRAIL_KINDS[k].label}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <SectionLabel>Length</SectionLabel>
              <div className="mt-1 font-mono text-[13px] tnum">{fmtDistance(length, settings.units)}</div>
            </div>
            <div>
              <SectionLabel>Points</SectionLabel>
              <div className="mt-1 font-mono text-[13px] tnum">{trail.points.length}</div>
            </div>
          </div>

          {(camps.camps.length > 0 || trail.campId) && (
            <Field label="Share with" helper={trail.ownerId ? `Shared by ${nameFor(trail.ownerId)} in ${campName(trail.campId) ?? 'a camp'}. Camp members can edit it.` : trail.campId ? 'Everyone in the camp sees this line.' : 'Only you see this line.'}>
              <select value={trail.campId ?? ''} onChange={(e) => void updateTrail(trail.id!, { campId: e.target.value || null })} className="w-full h-11 px-3.5 rounded-xl bg-pine-900 border border-bone-50/10 text-bone-50 outline-none focus:border-ember-500/60">
                <option value="">Just me</option>
                {camps.camps.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                {trail.campId && !camps.camps.some((c) => c.id === trail.campId) && <option value={trail.campId}>{campName(trail.campId) ?? 'Camp'}</option>}
              </select>
            </Field>
          )}

          <Field label="Notes" helper="Where it comes from, where it goes, when they use it.">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => {
                if (note !== trail.note) void updateTrail(trail.id!, { note })
              }}
              placeholder="Bedding on the ridge to the beans, evenings..."
            />
          </Field>
        </div>
      )}
    </Sheet>
  )
}
