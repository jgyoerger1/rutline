import { Clock, GpsFix, House } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { locate } from '../../lib/geo'
import type { HomeGround } from '../../lib/types'
import { useApp } from '../AppContext'
import HomePicker from '../HomePicker'
import { SectionLabel, Sheet } from '../ui'

const RECENT_KEY = 'rutline.goto.recent.v1'
const MAX_RECENT = 6

export interface GoTo extends HomeGround {
  zoom: number
}

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
    localStorage.setItem(RECENT_KEY, JSON.stringify([s, ...readRecent().filter((r) => !same(r, s))].slice(0, MAX_RECENT)))
  } catch {
    /* ignore */
  }
}
/** Coordinates get a close look; a town gets the whole town */
const zoomFor = (p: HomeGround) => (/^-?\d/.test(p.label) ? 16 : 13)

/**
 * Move the map to a place without touching home ground: a town, pasted
 * coordinates, home, your GPS fix or somewhere you went recently.
 */
export default function GoToSheet({ open, onClose, onGo }: { open: boolean; onClose: () => void; onGo: (p: GoTo) => void }) {
  const { home, toast } = useApp()
  const [busy, setBusy] = useState(false)
  const recent = useMemo(() => readRecent(), [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function go(p: HomeGround, zoom: number, remember = true) {
    if (remember) pushRecent(p)
    onGo({ ...p, zoom })
    onClose()
  }
  async function myLocation() {
    setBusy(true)
    try {
      const f = await locate()
      go({ lat: f.coords.latitude, lon: f.coords.longitude, label: 'My location' }, 16, false)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not get a fix')
    } finally {
      setBusy(false)
    }
  }

  const row = 'push w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-pine-800/70 transition-colors disabled:opacity-50'

  return (
    <Sheet open={open} onClose={onClose} title="Go to" scrollKey={open ? 1 : 0}>
      <div className="space-y-5">
        <p className="text-[13px] text-bone-400 leading-relaxed">Moves the map only. Home ground, the forecast and your pins stay where they are.</p>

        <ul className="divide-y divide-bone-50/8 rounded-xl border border-bone-50/8 overflow-hidden">
          {home && (
            <li>
              <button onClick={() => go(home, 15, false)} className={row}>
                <House size={16} className="text-ember-400 shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-bone-50">Home ground</span>
                  <span className="block text-[12px] text-bone-600 truncate">{home.label}</span>
                </span>
              </button>
            </li>
          )}
          <li>
            <button onClick={myLocation} disabled={busy} className={row}>
              <GpsFix size={16} weight="bold" className="text-ember-400 shrink-0" />
              <span className="text-sm text-bone-50">{busy ? 'Getting a fix' : 'My location'}</span>
            </button>
          </li>
        </ul>

        <div>
          <SectionLabel>Search</SectionLabel>
          <div className="mt-2">
            <HomePicker compact gps={false} placeholder="A town, or coordinates: 41.3745, -81.0565" onPick={(p) => go(p, zoomFor(p))} />
          </div>
        </div>

        {recent.length > 0 && (
          <div>
            <SectionLabel>Recent</SectionLabel>
            <ul className="mt-2 divide-y divide-bone-50/8 rounded-xl border border-bone-50/8 overflow-hidden">
              {recent.map((r) => (
                <li key={`${r.lat},${r.lon}`}>
                  <button onClick={() => go(r, zoomFor(r))} className={row}>
                    <Clock size={16} className="text-bone-600 shrink-0" />
                    <span className="flex-1 min-w-0 text-sm text-bone-50 truncate">{r.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Sheet>
  )
}
