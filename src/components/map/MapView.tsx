import { AnimatePresence, motion } from 'framer-motion'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowUp, Check, GpsFix, List, MapPin, Path, Plus, Polygon as ParcelsIcon, X } from '@phosphor-icons/react'
import L from 'leaflet'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Circle, MapContainer, Marker, Polygon, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { addTrail, addWaypoint, deleteTrail, liveTrails, liveWaypoints, updateTrail, updateWaypoint } from '../../lib/db'
import { degToCompass, fmtDistance, haversineM } from '../../lib/geo'
import { TRAIL_KINDS, WAYPOINT_ORDER, WAYPOINT_TYPES, type MapLayer, type Trail, type TrailKind, type Waypoint, type WaypointType } from '../../lib/types'
import { useWatchPosition } from '../../lib/useGeo'
import { boundsOf, type Parcel } from '../../lib/parcels'
import { nowIndex } from '../../lib/weather'
import { useApp } from '../AppContext'
import { markerHtml, TYPE_ICON } from '../icons'
import { Button, Chip, IconButton, Input, SectionLabel, Segmented, Sheet } from '../ui'
import LetterSheet, { type LetterTarget } from './LetterSheet'
import ParcelLayer, { type ParcelStatus } from './ParcelLayer'
import ParcelSheet from './ParcelSheet'
import WaypointSheet from './WaypointSheet'

const LAYERS: Record<MapLayer, { url: string; attribution: string; maxNativeZoom: number }> = {
  satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Imagery © Esri, Maxar, Earthstar Geographics', maxNativeZoom: 19 },
  topo: { url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}', attribution: 'USGS The National Map', maxNativeZoom: 16 },
  streets: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors', maxNativeZoom: 19 },
}

type AddMode = { kind: 'point'; type: WaypointType } | { kind: 'trail'; trail: TrailKind; points: [number, number][] } | null

const TRAIL_STYLE: Record<TrailKind, L.PathOptions> = {
  trail: { color: '#d6d0c3', weight: 3, opacity: 0.9 },
  entry: { color: '#e8702c', weight: 3, dashArray: '8 6', opacity: 0.95 },
  exit: { color: '#e8702c', weight: 3, dashArray: '2 7', opacity: 0.95 },
  drag: { color: '#f5a86b', weight: 4, opacity: 0.95 },
}

export default function MapView({ active }: { active: boolean }) {
  const { home, settings, setSettings, forecast, toast, focusRequest, clearFocus, setView } = useApp()
  const waypoints = useLiveQuery(liveWaypoints, [])
  const trails = useLiveQuery(liveTrails, [])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [selectedTrail, setSelectedTrail] = useState<number | null>(null)
  const [addMode, setAddMode] = useState<AddMode>(null)
  const [picker, setPicker] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [filter, setFilter] = useState<Set<WaypointType>>(new Set())
  const [watch, setWatch] = useState(false)
  const [dismissHint, setDismissHint] = useState(false)
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null)
  const [parcelStatus, setParcelStatus] = useState<ParcelStatus>({ state: 'off', count: 0, truncated: false, sources: [] })
  const [letter, setLetter] = useState<LetterTarget | null>(null)
  const onParcelStatus = useCallback((s: ParcelStatus) => setParcelStatus(s), [])
  const { fix, error: geoError } = useWatchPosition(watch)
  const mapRef = useRef<L.Map | null>(null)

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
        />

        {(trails ?? []).map((t) => (
          <Polyline key={t.id} positions={t.points} pathOptions={{ ...TRAIL_STYLE[t.kind], weight: selectedTrail === t.id ? (TRAIL_STYLE[t.kind].weight as number) + 2 : TRAIL_STYLE[t.kind].weight }} eventHandlers={{ click: () => { setSelectedTrail(t.id!); setSelectedId(null) } }} />
        ))}

        {cone && <Polygon positions={cone} pathOptions={{ color: '#f5a86b', weight: 1.5, opacity: 0.9, fillColor: '#e8702c', fillOpacity: 0.26, className: 'scent-cone' }} interactive={false} />}

        {visible.map((w) => {
          const isNew = Date.now() - w.createdAt < 4000
          return (
          <Marker
            key={`${w.id}-${w.type}-${w.id === selectedId ? 's' : ''}${isNew ? '-n' : ''}`}
            position={[w.lat, w.lon]}
            icon={L.divIcon({ className: '', html: markerHtml(w.type, w.id === selectedId, isNew), iconSize: [36, 36], iconAnchor: [18, 41] })}
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
      </MapContainer>
      </div>

      {/* Top controls */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-start gap-2 pointer-events-none">
        {now && (
          <button onClick={() => setView('forecast')} className="push pointer-events-auto glass rounded-xl h-11 px-3 inline-flex items-center gap-2 text-sm">
            <ArrowUp size={16} weight="bold" className="text-ember-400" style={{ transform: `rotate(${now.windDir + 180}deg)` }} />
            <span className="font-medium">{degToCompass(now.windDir)}</span>
            <span className="font-mono text-bone-400 tnum">{Math.round(settings.units === 'metric' ? now.windMph * 1.60934 : now.windMph)} {settings.units === 'metric' ? 'km/h' : 'mph'}</span>
          </button>
        )}
        <button
          onClick={() => setSettings({ parcelsEnabled: !settings.parcelsEnabled })}
          aria-pressed={settings.parcelsEnabled}
          title="Property lines"
          className={`push pointer-events-auto glass rounded-xl h-11 px-3 inline-flex items-center gap-2 text-sm ${settings.parcelsEnabled ? 'text-bone-50' : 'text-bone-400'}`}
        >
          <ParcelsIcon size={16} weight={settings.parcelsEnabled ? 'fill' : 'regular'} className={settings.parcelsEnabled ? 'text-ember-400' : ''} />
          <span className="font-medium">Lines</span>
          {settings.parcelsEnabled && (
            <span className="font-mono text-[11px] text-bone-400 tnum inline-flex items-center gap-1.5">
              {parcelStatus.state === 'loading' && <span className="w-1.5 h-1.5 rounded-full bg-ember-400 breathe" />}
              {parcelStatus.state === 'zoom' ? 'zoom in' : parcelStatus.state === 'ready' ? `${parcelStatus.count}${parcelStatus.truncated ? '+' : ''}` : parcelStatus.state === 'empty' ? 'none here' : parcelStatus.state === 'nosource' ? 'no source' : parcelStatus.state === 'error' ? 'offline' : ''}
            </span>
          )}
        </button>
        <div className="ml-auto pointer-events-auto">
          <Segmented id="layer" value={settings.mapLayer} onChange={(mapLayer) => setSettings({ mapLayer })} options={[{ value: 'satellite', label: 'Sat' }, { value: 'topo', label: 'Topo' }, { value: 'streets', label: 'Streets' }]} className="glass" />
        </div>
      </div>

      {typesPresent.length > 1 && (
        <div className="absolute top-[62px] left-3 right-3 z-10 overflow-x-auto no-bar pointer-events-none">
          <div className="flex gap-1.5 min-w-max pointer-events-auto pr-4">
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

      {/* Right-side controls */}
      <div className="absolute right-3 bottom-6 z-10 flex flex-col gap-2 items-end">
        <IconButton label="Pins list" onClick={() => setListOpen(true)}>
          <List size={20} />
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
          <SectionLabel className="mb-2">Draw a line</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(TRAIL_KINDS) as TrailKind[]).map((k) => (
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
      <PinList open={listOpen} onClose={() => setListOpen(false)} waypoints={waypoints ?? []} trails={trails ?? []} me={fix} onPick={(w) => { setListOpen(false); setSelectedId(w.id!); mapRef.current?.flyTo([w.lat, w.lon], Math.max(mapRef.current.getZoom(), 16), { duration: 0.8 }) }} onPickTrail={(t) => { setListOpen(false); setSelectedTrail(t.id!); mapRef.current?.fitBounds(L.latLngBounds(t.points), { padding: [60, 60] }) }} />

      <WaypointSheet waypoint={selected} me={fix} windDir={now?.windDir} onClose={() => setSelectedId(null)} onLetter={(t) => setLetter(t)} />

      <ParcelSheet
        parcel={selectedParcel}
        onClose={() => setSelectedParcel(null)}
        onCenter={(p) => mapRef.current?.fitBounds(L.latLngBounds(boundsOf(p.geometry)), { padding: [48, 48] })}
        onLetter={(t) => setLetter(t)}
        onSaved={(id) => {
          setSelectedParcel(null)
          setSelectedId(id)
        }}
      />

      <LetterSheet target={letter} onClose={() => setLetter(null)} />

      <TrailSheet trail={trails?.find((t) => t.id === selectedTrail) ?? null} onClose={() => setSelectedTrail(null)} />
    </div>
  )
}

function MapEvents({ onClick }: { onClick: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (e) => onClick(e.latlng.lat, e.latlng.lng) })
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
                  <div className="text-[11.5px] text-bone-600 truncate">{WAYPOINT_TYPES[w.type].label}{w.note ? ` · ${w.note}` : ''}</div>
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
                    <div className="text-[11.5px] text-bone-600">{TRAIL_KINDS[t.kind].label} · {t.points.length} points</div>
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

function TrailSheet({ trail, onClose }: { trail: Trail | null; onClose: () => void }) {
  const { toast, settings } = useApp()
  const [name, setName] = useState('')
  useEffect(() => {
    if (trail) setName(trail.name)
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
      title={trail ? TRAIL_KINDS[trail.kind].label : ''}
      footer={
        trail ? (
          <Button
            variant="danger"
            size="sm"
            onClick={async () => {
              if (!confirm(`Delete "${trail.name}"?`)) return
              await deleteTrail(trail.id!)
              toast('Line deleted')
              onClose()
            }}
          >
            Delete
          </Button>
        ) : null
      }
    >
      {trail && (
        <div className="space-y-5">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (name.trim() && name !== trail.name) void updateTrail(trail.id!, { name: name.trim() })
            }}
          />
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
        </div>
      )}
    </Sheet>
  )
}
