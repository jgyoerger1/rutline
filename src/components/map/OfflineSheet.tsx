import { CloudArrowDown, Crosshair, Lock, Trash, WifiSlash } from '@phosphor-icons/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { deleteArea, estimate, liveAreas, offlineStorageReady, saveArea, zoomsFor, type SaveProgress } from '../../lib/offline'
import type { BBox } from '../../lib/parcels'
import type { CustomParcelSource, MapLayer, OfflineArea } from '../../lib/types'
import { useApp } from '../AppContext'
import { Button, SectionLabel, Sheet } from '../ui'

const LAYER_LABEL: Record<MapLayer, string> = { satellite: 'satellite', topo: 'USGS topo' }

/**
 * Save what is on screen for offline use: every tile from zoom 12 to 17 for
 * the current basemap, plus the parcels inside the box. Lists what is saved.
 */
export default function OfflineSheet({ open, onClose, bbox, layer, custom, onShow }: { open: boolean; onClose: () => void; bbox: BBox | null; layer: MapLayer; custom: CustomParcelSource | null; onShow: (a: OfflineArea) => void }) {
  const { toast, pro, openPro, home } = useApp()
  const areas = useLiveQuery(() => liveAreas(), [])
  const [name, setName] = useState('')
  const [progress, setProgress] = useState<SaveProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ctl = useRef<AbortController | null>(null)

  useEffect(() => {
    if (open) {
      setName(`${home?.label?.split(',')[0] ?? 'Area'} ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`)
      setError(null)
    }
  }, [open, home?.label])
  useEffect(() => () => ctl.current?.abort(), [])

  const est = useMemo(() => (bbox ? estimate(bbox, layer) : null), [bbox, layer])
  const [zmin, zmax] = zoomsFor(layer)
  const ready = offlineStorageReady()

  async function download() {
    if (!bbox || !est) return
    if (!pro) return openPro('offline')
    if (est.tooBig) return
    setError(null)
    ctl.current?.abort()
    const c = new AbortController()
    ctl.current = c
    setProgress({ phase: 'tiles', done: 0, total: est.tiles, parcels: 0 })
    try {
      await saveArea(name.trim() || 'Saved area', bbox, layer, custom, setProgress, c.signal)
      toast('Area saved for offline')
      setProgress(null)
    } catch (e) {
      setProgress(null)
      if (!c.signal.aborted) setError(e instanceof Error ? e.message : 'Could not save the area')
    }
  }

  const pct = progress ? (progress.phase === 'tiles' ? Math.round((progress.done / Math.max(1, progress.total)) * 80) : progress.phase === 'parcels' ? 80 + Math.round((progress.done / Math.max(1, progress.total)) * 20) : 100) : 0

  return (
    <Sheet open={open} onClose={onClose} title="Offline areas" scrollKey={open ? 1 : 0}>
      <div className="space-y-6">
        <div>
          <SectionLabel>Save what's on screen</SectionLabel>
          <p className="mt-1 text-[12.5px] text-bone-400 leading-relaxed">
            The {LAYER_LABEL[layer]} map from zoom {zmin} to {zmax}, plus the property lines inside the box. Pan and zoom the map to the ground you hunt before you save.
          </p>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this area" className="mt-3 h-10 w-full px-3 rounded-xl bg-pine-950 border border-bone-50/10 text-bone-50 text-sm outline-none focus:border-ember-500/60" aria-label="Area name" />
          {est && (
            <div className={`mt-2 font-mono text-[12px] tnum ${est.tooBig ? 'text-ember-400' : 'text-bone-500'}`}>
              {est.tooBig ? `Too big: ${est.tiles.toLocaleString()} tiles. Zoom in a step.` : `${est.tiles.toLocaleString()} tiles · about ${est.mb} MB`}
            </div>
          )}
          {!ready && <p className="mt-2 text-[12px] text-bone-600 leading-relaxed">Tiles are kept by the installed app (home-screen or TestFlight). In a plain browser tab only the parcels are saved.</p>}
          {progress ? (
            <div className="mt-3">
              <div className="h-2 rounded-full bg-pine-800 overflow-hidden">
                <div className="h-full bg-ember-500 transition-[width]" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-1.5 flex items-center justify-between font-mono text-[12px] tnum text-bone-500">
                <span>{progress.phase === 'tiles' ? `${progress.done} of ${progress.total} tiles` : progress.phase === 'parcels' ? `parcels: ${progress.parcels}` : 'done'}</span>
                <button onClick={() => ctl.current?.abort()} className="push text-bone-400 hover:text-bone-50">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <Button variant="primary" className="mt-3" onClick={download} disabled={!bbox || !est || est.tooBig}>
              {pro ? <CloudArrowDown size={16} weight="bold" /> : <Lock size={16} />} Save this area
            </Button>
          )}
          {error && <p className="mt-2 text-[12.5px] text-ember-400">{error}</p>}
        </div>

        <div>
          <SectionLabel>Saved on this phone</SectionLabel>
          {!areas || areas.length === 0 ? (
            <p className="mt-1 text-[12.5px] text-bone-600">Nothing saved yet.</p>
          ) : (
            <AreaList areas={areas} onShow={(a) => { onShow(a); onClose() }} />
          )}
        </div>
        <p className="text-[11.5px] text-bone-600 leading-relaxed inline-flex items-start gap-2">
          <WifiSlash size={14} className="shrink-0 mt-0.5" />
          Weather and HuntCast keep their last pull. Terrain renders only where you have already looked. Pins and trails always work offline.
        </p>
      </div>
    </Sheet>
  )
}

export function AreaList({ areas, onShow }: { areas: OfflineArea[]; onShow?: (a: OfflineArea) => void }) {
  const { toast } = useApp()
  return (
    <ul className="mt-2 divide-y divide-bone-50/8 rounded-xl border border-bone-50/8 overflow-hidden">
      {areas.map((a) => (
        <li key={a.id} className="px-3 py-2.5 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm text-bone-50 truncate">{a.name}</div>
            <div className="text-[11.5px] text-bone-600 font-mono tnum">
              {LAYER_LABEL[a.layer]} · {a.tiles.toLocaleString()} tiles · {a.parcels.toLocaleString()} parcels · {a.mb} MB · {new Date(a.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </div>
          </div>
          {onShow && (
            <button onClick={() => onShow(a)} className="push w-9 h-9 grid place-items-center rounded-lg text-bone-400 hover:text-bone-50 hover:bg-pine-700/70" aria-label={`Show ${a.name} on the map`}>
              <Crosshair size={16} />
            </button>
          )}
          <button onClick={async () => { await deleteArea(a.id!); toast('Area removed') }} className="push w-9 h-9 grid place-items-center rounded-lg text-bone-500 hover:text-ember-400 hover:bg-pine-700/70" aria-label={`Delete ${a.name}`}>
            <Trash size={16} />
          </button>
        </li>
      ))}
    </ul>
  )
}
