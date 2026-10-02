import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowUp } from '@phosphor-icons/react'
import { liveWaypointsOfTypes } from '../../lib/db'
import { degToCompass, windFit, type WindFit } from '../../lib/geo'
import { useApp } from '../AppContext'
import { TYPE_ICON } from '../icons'
import { Button, SectionLabel } from '../ui'

const FIT: Record<WindFit, { label: string; cls: string; order: number }> = {
  good: { label: 'Huntable', cls: 'bg-ember-500 text-ember-950', order: 0 },
  marginal: { label: 'Marginal', cls: 'bg-bone-800 text-bone-50', order: 1 },
  bad: { label: 'Wrong wind', cls: 'bg-pine-700 text-bone-400', order: 2 },
  unset: { label: 'No winds set', cls: 'bg-transparent border border-bone-50/10 text-bone-600', order: 3 },
}

export default function StandPicks({ windDir, windMph }: { windDir: number; windMph: number }) {
  const { setView, focusWaypoint, settings } = useApp()
  const stands = useLiveQuery(() => liveWaypointsOfTypes(['stand', 'blind']), [])
  if (!stands) return null
  const unit = settings.units === 'metric' ? `${Math.round(windMph * 1.60934)} km/h` : `${Math.round(windMph)} mph`
  if (!stands.length) {
    return (
      <div className="rounded-2xl border border-dashed border-bone-50/12 px-5 py-5 text-sm text-bone-400">
        <div className="text-bone-50 font-medium">No stands pinned yet</div>
        <p className="mt-1 leading-relaxed">Drop your stands and blinds on the map and set which winds each one hunts. This list will then tell you where to sit for the hour you pick.</p>
        <Button size="sm" className="mt-3" onClick={() => setView('map')}>
          Open the map
        </Button>
      </div>
    )
  }
  const rows = stands.map((s) => ({ s, fit: windFit(windDir, s.goodWinds) })).sort((a, b) => FIT[a.fit].order - FIT[b.fit].order || a.s.name.localeCompare(b.s.name))
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <SectionLabel>Where to sit</SectionLabel>
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-bone-400 tnum">
          <ArrowUp size={12} weight="bold" className="text-ember-400" style={{ transform: `rotate(${windDir + 180}deg)` }} />
          {degToCompass(windDir)} {unit}
        </span>
      </div>
      <ul className="divide-y divide-bone-50/8 border-t border-b border-bone-50/8">
        {rows.map(({ s, fit }) => {
          const I = TYPE_ICON[s.type]
          return (
            <li key={s.id}>
              <button onClick={() => focusWaypoint(s.id!)} className="push w-full flex items-center gap-3 py-2.5 text-left hover:bg-pine-800/40 px-1 -mx-1 rounded-lg transition-colors">
                <I size={18} weight="duotone" className="text-bone-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{s.name}</div>
                  <div className="text-[11.5px] text-bone-600 font-mono truncate">{s.goodWinds.length ? s.goodWinds.join(' ') : 'set winds on the map'}</div>
                </div>
                <span className={`shrink-0 text-[11px] font-medium px-2 py-1 rounded-md ${FIT[fit].cls}`}>{FIT[fit].label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
