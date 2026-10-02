import { ArrowSquareOut, CopySimple, Trash } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { deleteWaypoint, updateWaypoint } from '../../lib/db'
import { fmtDateTime } from '../../lib/format'
import { fmtCoord, fmtDistance, haversineM } from '../../lib/geo'
import { WAYPOINT_ORDER, WAYPOINT_TYPES, type Waypoint, type WaypointType } from '../../lib/types'
import { useApp } from '../AppContext'
import { TYPE_ICON } from '../icons'
import { Button, Field, Input, SectionLabel, Sheet, Textarea } from '../ui'
import PhotoGallery from './PhotoGallery'
import WindPicker from './WindPicker'

export default function WaypointSheet({ waypoint, me, windDir, onClose }: { waypoint: Waypoint | null; me: { lat: number; lon: number } | null; windDir?: number; onClose: () => void }) {
  const { toast, settings } = useApp()
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  // Winds are kept locally so rapid taps do not race the live query
  const [winds, setWinds] = useState<string[]>([])
  useEffect(() => {
    if (waypoint) {
      setName(waypoint.name)
      setNote(waypoint.note)
      setWinds(waypoint.goodWinds)
    }
  }, [waypoint?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const w = waypoint
  const meta = w ? WAYPOINT_TYPES[w.type] : null
  const I = w ? TYPE_ICON[w.type] : null

  async function save(patch: Partial<Waypoint>) {
    if (!w?.id) return
    await updateWaypoint(w.id, patch)
  }

  async function remove() {
    if (!w?.id) return
    if (!confirm(`Delete "${w.name}" and its photos?`)) return
    await deleteWaypoint(w.id)
    toast('Pin deleted')
    onClose()
  }

  return (
    <Sheet
      open={!!w}
      onClose={onClose}
      scrollKey={w?.id ?? null}
      title={
        w && I ? (
          <span className="inline-flex items-center gap-2">
            <I size={18} weight="duotone" className="text-ember-400" />
            {meta?.label}
          </span>
        ) : null
      }
      footer={
        w ? (
          <div className="flex items-center justify-between gap-2">
            <Button variant="danger" size="sm" onClick={remove}>
              <Trash size={15} /> Delete
            </Button>
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${w.lat},${w.lon}&travelmode=walking`} target="_blank" rel="noreferrer" className="push inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[13px] font-medium text-bone-200 hover:bg-pine-700/60">
              Navigate <ArrowSquareOut size={14} />
            </a>
          </div>
        ) : null
      }
    >
      {w && (
        <div className="space-y-6">
          <Field label="Name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                if (name.trim() && name !== w.name) void save({ name: name.trim() })
              }}
            />
          </Field>

          <Field label="Type">
            <select value={w.type} onChange={(e) => void save({ type: e.target.value as WaypointType })} className="w-full h-11 px-3.5 rounded-xl bg-pine-900 border border-bone-50/10 text-bone-50 outline-none focus:border-ember-500/60">
              {WAYPOINT_ORDER.map((t) => (
                <option key={t} value={t}>
                  {WAYPOINT_TYPES[t].label}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <SectionLabel>Position</SectionLabel>
              <button
                className="push mt-1 inline-flex items-center gap-1.5 font-mono text-[12.5px] text-bone-200 tnum hover:text-bone-50"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(fmtCoord(w.lat, w.lon))
                    toast('Coordinates copied')
                  } catch {
                    toast(fmtCoord(w.lat, w.lon))
                  }
                }}
              >
                {fmtCoord(w.lat, w.lon)} <CopySimple size={13} />
              </button>
              <div className="text-[11.5px] text-bone-600 mt-0.5">Drag the pin on the map to move it.</div>
            </div>
            <div>
              <SectionLabel>From you</SectionLabel>
              <div className="mt-1 font-mono text-[12.5px] text-bone-200 tnum">{me ? fmtDistance(haversineM(me, w), settings.units) : 'no GPS fix'}</div>
              <div className="text-[11.5px] text-bone-600 mt-0.5">added {fmtDateTime(w.createdAt)}</div>
            </div>
          </div>

          {meta?.hasWinds && (
            <div>
              <SectionLabel>Huntable winds</SectionLabel>
              <p className="text-[12.5px] text-bone-600 mt-1 mb-2">Tap the directions the wind can blow from and still hunt this spot. The orange tick is the wind right now.</p>
              <WindPicker
                value={winds}
                onChange={(goodWinds) => {
                  setWinds(goodWinds)
                  void save({ goodWinds })
                }}
                windDir={windDir}
              />
            </div>
          )}

          <Field label="Notes" helper="Entry route, shooting lanes, what the cam has shown.">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => {
                if (note !== w.note) void save({ note })
              }}
              placeholder="Walk in from the north gate, stay on the creek bottom..."
            />
          </Field>

          <PhotoGallery waypointId={w.id!} />
        </div>
      )}
    </Sheet>
  )
}
