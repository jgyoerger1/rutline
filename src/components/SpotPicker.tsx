import { ArrowCounterClockwise, Clock, MapPin } from '@phosphor-icons/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { liveWaypoints } from '../lib/db'
import { fmtDistance, haversineM } from '../lib/geo'
import { WAYPOINT_TYPES, type HomeGround, type Waypoint } from '../lib/types'
import { useApp } from './AppContext'
import HomePicker from './HomePicker'
import { SectionLabel, Sheet } from './ui'

const RECENT_KEY = 'rutline.spots.recent.v1'
const MAX_RECENT = 5

function readRecent(): HomeGround[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    return raw ? (JSON.parse(raw) as HomeGround[]) : []
  } catch {
    return []
  }
}
function same(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  return Math.abs(a.lat - b.lat) < 0.0005 && Math.abs(a.lon - b.lon) < 0.0005
}
function pushRecent(s: HomeGround) {
  try {
    const next = [s, ...readRecent().filter((r) => !same(r, s))].slice(0, MAX_RECENT)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

/**
 * Pick where the forecast and HuntCast are for, without leaving the page:
 * your GPS fix, one of your pins, a town, or a recent place. The pick lasts
 * for the session and never moves home ground, the map or your pins.
 */
export default function SpotPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { home, spot, setSpot, settings, toast } = useApp()
  const pins = useLiveQuery(() => liveWaypoints(), [])
  const recent = useMemo(() => readRecent(), [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const current = spot ?? home
  const sorted = useMemo(() => {
    const list = (pins ?? []).filter((w) => w.type !== 'blood')
    const rank = (w: Waypoint) => (w.type === 'stand' || w.type === 'blind' ? 0 : w.type === 'camera' ? 1 : 2)
    return list.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
  }, [pins])

  function pick(s: HomeGround) {
    if (home && same(s, home)) {
      setSpot(null)
      toast(`Back to home ground`)
    } else {
      setSpot(s)
      pushRecent(s)
      toast(`Forecast moved to ${s.label}`)
    }
    onClose()
  }
  function pickPin(w: Waypoint) {
    pick({ lat: w.lat, lon: w.lon, label: w.name })
  }
  function backHome() {
    setSpot(null)
    toast('Back to home ground')
    onClose()
  }

  const dist = (s: { lat: number; lon: number }) => (home ? fmtDistance(haversineM(home, s), settings.units) : null)
  const row = 'push w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-pine-800/70 transition-colors'

  return (
    <Sheet open={open} onClose={onClose} title="Forecast for" scrollKey={open ? 1 : 0}>
      <div className="space-y-5">
        <div className="text-[13px] text-bone-400 leading-relaxed">
          Wind, weather and HuntCast follow this place until you change it or close the app. Home ground, the map and your pins stay put.
        </div>

        {spot && home && (
          <button onClick={backHome} className={`${row} rounded-xl border border-ember-500/30 bg-ember-500/10`}>
            <ArrowCounterClockwise size={18} className="text-ember-400 shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-bone-50">Back to home ground</span>
              <span className="block text-[12px] text-bone-500 truncate">{home.label}</span>
            </span>
          </button>
        )}

        <HomePicker compact onPick={pick} />

        {sorted.length > 0 && (
          <div>
            <SectionLabel>Your pins</SectionLabel>
            <ul className="mt-2 divide-y divide-bone-50/8 rounded-xl border border-bone-50/8 overflow-hidden">
              {sorted.map((w) => {
                const active = !!current && same(current, w)
                return (
                  <li key={w.id}>
                    <button onClick={() => pickPin(w)} className={row} aria-current={active ? 'true' : undefined}>
                      <MapPin size={16} weight={active ? 'fill' : 'regular'} className={active ? 'text-ember-400 shrink-0' : 'text-bone-600 shrink-0'} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-bone-50 truncate">{w.name}</span>
                        <span className="block text-[12px] text-bone-600">{WAYPOINT_TYPES[w.type].label}</span>
                      </span>
                      {dist(w) && <span className="font-mono text-[12px] tnum text-bone-500 shrink-0">{dist(w)}</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {recent.length > 0 && (
          <div>
            <SectionLabel>Recent</SectionLabel>
            <ul className="mt-2 divide-y divide-bone-50/8 rounded-xl border border-bone-50/8 overflow-hidden">
              {recent.map((r) => {
                const active = !!current && same(current, r)
                return (
                  <li key={`${r.lat},${r.lon}`}>
                    <button onClick={() => pick(r)} className={row} aria-current={active ? 'true' : undefined}>
                      <Clock size={16} className={active ? 'text-ember-400 shrink-0' : 'text-bone-600 shrink-0'} />
                      <span className="flex-1 min-w-0 text-sm text-bone-50 truncate">{r.label}</span>
                      {dist(r) && <span className="font-mono text-[12px] tnum text-bone-500 shrink-0">{dist(r)}</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </Sheet>
  )
}
