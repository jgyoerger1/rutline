import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowSquareOut, CopySimple, CrosshairSimple, EnvelopeSimple, MapPin, Plus } from '@phosphor-icons/react'
import { useState } from 'react'
import { addWaypoint, liveWaypointsOfTypes, updateWaypoint } from '../../lib/db'
import type { Parcel } from '../../lib/parcels'
import { WAYPOINT_TYPES, type OwnerInfo } from '../../lib/types'
import { useApp } from '../AppContext'
import { TYPE_ICON } from '../icons'
import { Button, SectionLabel, Sheet } from '../ui'
import type { LetterTarget } from './LetterSheet'

export default function ParcelSheet({ parcel, onClose, onCenter, onLetter, onSaved }: { parcel: Parcel | null; onClose: () => void; onCenter: (p: Parcel) => void; onLetter: (t: LetterTarget) => void; onSaved: (waypointId: number) => void }) {
  const { toast } = useApp()
  const [picking, setPicking] = useState(false)
  const pins = useLiveQuery(() => liveWaypointsOfTypes(['stand', 'blind', 'access', 'food', 'other']), [])
  const p = parcel

  const ownerInfo = (): OwnerInfo | null =>
    p
      ? {
          name: p.owner ?? p.mailName ?? '',
          mailAddress: p.mailAddress ?? '',
          parcelId: p.parcelId,
          county: p.county,
          situs: p.situs ?? '',
          acres: p.acres,
          source: p.sourceLabel,
          savedAt: Date.now(),
        }
      : null

  async function saveTo(id: number) {
    const info = ownerInfo()
    if (!info) return
    await updateWaypoint(id, { owner: info })
    toast('Landowner saved to pin')
    setPicking(false)
    onSaved(id)
  }

  async function saveNew() {
    const info = ownerInfo()
    if (!p || !info) return
    const name = info.name ? `${info.name.split(' & ')[0]} parcel` : p.situs ? p.situs.split(',')[0] : `Parcel ${p.parcelId || ''}`.trim()
    const id = await addWaypoint({ type: 'access', name, lat: p.centroid[0], lon: p.centroid[1], note: [p.situs, info.mailAddress ? `Mail: ${info.mailAddress}` : '', p.acres ? `${p.acres} ac` : ''].filter(Boolean).join('\n') })
    await updateWaypoint(id, { owner: info })
    toast('Pinned with landowner')
    setPicking(false)
    onSaved(id)
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast(`${what} copied`)
    } catch {
      toast(text)
    }
  }

  return (
    <Sheet
      open={!!p}
      onClose={() => {
        setPicking(false)
        onClose()
      }}
      scrollKey={p?.key ?? null}
      title={p ? (p.owner ? p.owner : p.situs ? p.situs.split(',')[0] : 'Parcel') : ''}
      footer={
        p ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={() => onLetter({ name: p.owner ?? p.mailName ?? '', mailAddress: p.mailAddress ?? '', parcelId: p.parcelId, county: p.county, situs: p.situs ?? '' })}>
              <EnvelopeSimple size={15} /> Permission letter
            </Button>
            <Button size="sm" onClick={() => setPicking((v) => !v)}>
              <MapPin size={15} /> Save to pin
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onCenter(p)} aria-label="Center on parcel">
              <CrosshairSimple size={16} />
            </Button>
          </div>
        ) : null
      }
    >
      {p && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <div className="col-span-2">
              <SectionLabel>Owner of record</SectionLabel>
              {p.owner ? (
                <div className="mt-1 text-base font-semibold tracking-tight">{p.owner}</div>
              ) : (
                <div className="mt-1 text-sm text-bone-400 leading-relaxed">
                  Owner names for {p.county ? p.county + ' County' : 'this county'} are withheld from the statewide layer.
                  {p.recordsUrl && (
                    <>
                      {' '}
                      <a href={p.recordsUrl} target="_blank" rel="noreferrer" className="text-bone-50 underline underline-offset-4 decoration-bone-50/30 inline-flex items-center gap-1">
                        Look it up at the county auditor <ArrowSquareOut size={12} />
                      </a>
                    </>
                  )}
                </div>
              )}
              {p.mailName && p.mailName !== p.owner && <div className="text-[12.5px] text-bone-400 mt-0.5">Tax bill to {p.mailName}</div>}
              {p.units > 1 && <div className="text-[12.5px] text-bone-400 mt-0.5">{p.units} unit records share this footprint (condo or association). The name shown is the first on file.</div>}
            </div>

            <div className="col-span-2">
              <SectionLabel>Mailing address</SectionLabel>
              {p.mailAddress ? (
                <button onClick={() => copy(p.mailAddress!, 'Address')} className="push mt-1 text-left text-sm text-bone-50 inline-flex items-start gap-2">
                  <span>{p.mailAddress}</span>
                  <CopySimple size={14} className="text-bone-600 mt-1 shrink-0" />
                </button>
              ) : (
                <div className="mt-1 text-sm text-bone-600">Not published</div>
              )}
            </div>

            <div>
              <SectionLabel>Site address</SectionLabel>
              <div className="mt-1 text-sm">{p.situs ?? <span className="text-bone-600">None recorded</span>}</div>
            </div>
            <div>
              <SectionLabel>Acres</SectionLabel>
              <div className="mt-1 font-mono text-sm tnum">{p.acres != null ? p.acres.toFixed(2) : '–'}</div>
            </div>
            <div>
              <SectionLabel>Parcel</SectionLabel>
              <button onClick={() => copy(p.parcelId, 'Parcel ID')} className="push mt-1 font-mono text-[12.5px] text-bone-200 inline-flex items-center gap-1.5 tnum">
                {p.parcelId || '–'} {p.parcelId && <CopySimple size={12} className="text-bone-600" />}
              </button>
              <div className="text-[11.5px] text-bone-600">{p.county ? `${p.county} County` : ''}</div>
            </div>
            <div>
              <SectionLabel>Land use</SectionLabel>
              <div className="mt-1 text-sm">{p.landUse ?? <span className="text-bone-600">–</span>}</div>
            </div>
          </div>

          {picking && (
            <div className="rounded-2xl border border-bone-50/10 bg-pine-900/70 p-3">
              <SectionLabel className="mb-2">Attach this landowner to</SectionLabel>
              <button onClick={saveNew} className="push w-full flex items-center gap-3 py-2.5 px-2 rounded-lg text-left hover:bg-pine-800/70">
                <Plus size={18} className="text-ember-400" />
                <span className="text-sm font-medium">New access pin on this parcel</span>
              </button>
              {(pins ?? []).length > 0 && <div className="border-t border-bone-50/8 my-1" />}
              <ul className="max-h-56 overflow-y-auto">
                {(pins ?? []).map((w) => {
                  const I = TYPE_ICON[w.type]
                  return (
                    <li key={w.id}>
                      <button onClick={() => saveTo(w.id!)} className="push w-full flex items-center gap-3 py-2 px-2 rounded-lg text-left hover:bg-pine-800/70">
                        <I size={16} weight="duotone" className="text-bone-400" />
                        <span className="text-sm flex-1 truncate">{w.name}</span>
                        <span className="text-[11px] text-bone-600">{WAYPOINT_TYPES[w.type].label}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <div className="text-[11.5px] text-bone-600 leading-relaxed border-t border-bone-50/8 pt-3">
            Source: {p.sourceLabel}. County records can lag deeds by months; confirm before you knock.
            {p.link && (
              <>
                {' '}
                <a href={p.link} target="_blank" rel="noreferrer" className="text-bone-400 underline underline-offset-4 decoration-bone-50/20">
                  County record
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </Sheet>
  )
}
