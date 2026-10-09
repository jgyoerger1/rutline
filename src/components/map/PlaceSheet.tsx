import { ArrowSquareOut, Signpost, TreeEvergreen, Footprints } from '@phosphor-icons/react'
import { unitLabel, unitSource } from '../../lib/huntUnits'
import type { OverlayFeature } from '../../lib/overlays'
import { STATE_NAMES } from '../../lib/parcels'
import { describeAccess, describePublic, type Access } from '../../lib/publicLand'
import { Sheet } from '../ui'

export interface Place {
  lat: number
  lon: number
  public: OverlayFeature[]
  access: OverlayFeature[]
  units: OverlayFeature[]
}

const ACCESS_TEXT: Record<Access, { label: string; tone: string; note: string }> = {
  open: { label: 'Open to the public', tone: 'text-[#a9c79a] border-[#8fa882]/50 bg-[#8fa882]/10', note: 'Hunting still follows the managing agency’s rules.' },
  restricted: { label: 'Restricted access', tone: 'text-ember-300 border-ember-500/40 bg-ember-950/50', note: 'Permit, season or area limits apply. Check before you go.' },
  closed: { label: 'No public access', tone: 'text-bone-400 border-bone-50/15 bg-pine-800/60', note: 'Protected land, but not open to the public.' },
  unknown: { label: 'Access not recorded', tone: 'text-bone-400 border-bone-50/15 bg-pine-800/60', note: 'Ask the managing agency.' },
}

const google = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`

/** What a tap landed on: public land, a walk-in access tract, a hunt unit. */
export default function PlaceSheet({ place, onClose }: { place: Place | null; onClose: () => void }) {
  const pub = dedupe((place?.public ?? []).map(describePublic), (p) => `${p.name}|${p.manager}`).sort((a, b) => (b.easement ? 0 : 1) - (a.easement ? 0 : 1))
  const acc = dedupe((place?.access ?? []).map(describeAccess), (a) => `${a.program}|${a.name}`)
  const units = dedupe(
    (place?.units ?? []).map((f) => ({ label: unitLabel(f), src: unitSource(f.sourceId), props: f.props })).filter((u) => u.label && u.src),
    (u) => u.label!,
  )
  const title = pub[0]?.name ?? acc[0]?.program ?? units[0]?.label ?? 'Here'

  return (
    <Sheet open={!!place} onClose={onClose} title={title}>
      {place && (
        <div className="space-y-5">
          {pub.map((p) => {
            const a = ACCESS_TEXT[p.access]
            return (
              <section key={`${p.name}|${p.manager}`} className="space-y-2">
                <div className="flex items-start gap-3">
                  <TreeEvergreen size={20} weight="duotone" className="text-[#a9c79a] mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-base font-semibold tracking-tight">{p.name}</div>
                    <div className="text-sm text-bone-400">{[p.designation, p.manager].filter(Boolean).join(' · ')}</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pl-8">
                  <span className={`inline-flex items-center h-7 px-2.5 rounded-full border text-[12.5px] font-medium ${a.tone}`}>{a.label}</span>
                  {p.easement && <span className="inline-flex items-center h-7 px-2.5 rounded-full border border-bone-50/15 text-[12.5px] text-bone-400">Easement on private land</span>}
                  {p.acres != null && <span className="font-mono text-[12.5px] text-bone-400 tnum">{Math.round(p.acres).toLocaleString()} ac</span>}
                </div>
                <p className="pl-8 text-[12.5px] text-bone-600 leading-relaxed">{a.note}</p>
                <a href={google(`"${p.name}" ${p.manager} hunting regulations`)} target="_blank" rel="noreferrer" className="ml-8 inline-flex items-center gap-1.5 text-[13px] text-bone-50 underline underline-offset-4 decoration-bone-50/30">
                  Hunting rules for this area <ArrowSquareOut size={12} />
                </a>
              </section>
            )
          })}

          {acc.map((a) => (
            <section key={`${a.program}|${a.name}`} className="flex items-start gap-3">
              <Footprints size={20} weight="duotone" className="text-ember-300 mt-0.5 shrink-0" />
              <div className="min-w-0 space-y-1">
                <div className="text-base font-semibold tracking-tight">{a.program}</div>
                {a.name && <div className="text-sm text-bone-400">{a.name}</div>}
                {a.details.length > 0 && (
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
                    {a.details.map((d) => (
                      <div key={d.label} className="contents">
                        <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-bone-600 pt-[2px]">{d.label}</dt>
                        <dd className="text-bone-200 leading-snug min-w-0 break-words">
                          {d.link ? (
                            <a href={d.value} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4 decoration-bone-50/30">
                              Open <ArrowSquareOut size={12} />
                            </a>
                          ) : (
                            d.value
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                <p className="text-[12.5px] text-bone-600 leading-relaxed">Private land opened to hunting by a state program. Seasons, sign-in and method rules are the program’s.</p>
                {a.infoUrl && (
                  <a href={a.infoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] text-bone-50 underline underline-offset-4 decoration-bone-50/30">
                    Program rules <ArrowSquareOut size={12} />
                  </a>
                )}
              </div>
            </section>
          ))}

          {units.map((u) => {
            const st = STATE_NAMES[u.src!.state] ?? u.src!.state
            return (
              <section key={u.label!} className="flex items-start gap-3">
                <Signpost size={20} weight="duotone" className="text-bone-200 mt-0.5 shrink-0" />
                <div className="min-w-0 space-y-1">
                  <div className="text-base font-semibold tracking-tight">{u.label}</div>
                  <div className="text-sm text-bone-400">{u.src!.term === 'County' ? `${st} sets deer rules by county` : `${st} ${u.src!.term}`}</div>
                  {u.src!.details && (
                    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
                      {u.src!.details
                        .map(([k, field]) => [k, String(u.props[field] ?? '').trim()] as const)
                        .filter(([, v]) => v && v !== 'Null' && v !== 'null')
                        .map(([k, v]) => (
                          <div key={k} className="contents">
                            <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-bone-600 pt-[2px]">{k}</dt>
                            <dd className="text-bone-200 leading-snug">{v}</dd>
                          </div>
                        ))}
                    </dl>
                  )}
                  <a href={u.src!.infoUrl ?? google(`${st} ${u.src!.term} ${u.label} deer season dates`)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] text-bone-50 underline underline-offset-4 decoration-bone-50/30">
                    Seasons and limits for this unit <ArrowSquareOut size={12} />
                  </a>
                </div>
              </section>
            )
          })}

          <p className="text-[11.5px] text-bone-600 leading-relaxed border-t border-bone-50/8 pt-3">
            Public land from PAD-US (USGS). Hunt units and access programs from each state’s wildlife agency. Boundaries are approximate and rules change by season; the agency has the final word.
          </p>
        </div>
      )}
    </Sheet>
  )
}

function dedupe<T>(list: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>()
  return list.filter((t) => {
    const k = key(t)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
