import { CaretRight, Crosshair, ImageSquare, Minus, Plus, Ruler, Sparkle, Trash, Trophy as TrophyIcon, X } from '@phosphor-icons/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useAuth } from '../../lib/auth'
import { readBuck } from '../../lib/buckRead'
import { cloudConfigured } from '../../lib/cloud'
import { addTrophy, addTrophyPhoto, deleteTrophy, liveTrophies, liveWaypointsOfTypes, removeTrophyPhoto, setTrophyRead, updateTrophy } from '../../lib/db'
import { BEAM_OPTIONS, MASS_OPTIONS, SPREAD_OPTIONS, TINE_OPTIONS, fieldJudge, type FieldJudgeInput } from '../../lib/fieldJudge'
import { fmtEighths, scoreSheet } from '../../lib/score'
import { MAX_TROPHIES, MAX_TROPHY_PHOTOS, TROPHY_STATUS, type BuckRead, type Trophy, type TrophyStatus } from '../../lib/types'
import { useApp } from '../AppContext'
import RackMeasure from '../guide/RackMeasure'
import { Reveal } from '../motion'
import { Button, EmptyState, SectionLabel, Segmented, Sheet, Textarea } from '../ui'

// The AI read (photo -> server function -> Claude) is switched off: it needs an
// Anthropic key and the score-buck function deployed (supabase/README.md §7).
// Flip this to show the button again; readBuck() and the function are intact.
const SHOW_AI_READ = false

/**
 * Trophy Center: the bucks a hunter is after this season, with their trail
 * camera photos and a rough read of their score. Everything stays on the
 * phone; nothing is uploaded.
 */
export default function TrophyView() {
  const { toast } = useApp()
  const trophies = useLiveQuery(() => liveTrophies(), [])
  const [openId, setOpenId] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const count = trophies?.length ?? 0
  const full = count >= MAX_TROPHIES

  async function onAdd(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setAdding(true)
    try {
      const id = await addTrophy(f)
      setOpenId(id)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not add that photo')
    } finally {
      setAdding(false)
    }
  }

  const open = trophies?.find((t) => t.id === openId) ?? null

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-5 md:py-8 space-y-8 pb-12">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <SectionLabel>Trophy Center</SectionLabel>
          <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight">Bucks you're after</h1>
          <div className="mt-1 text-[12px] text-bone-600">
            {count} of {MAX_TROPHIES} · photos stay on this phone
          </div>
        </div>
        <label className={`push shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-xl text-[14px] font-medium border ${full || adding ? 'bg-pine-800 text-bone-600 border-bone-50/10 cursor-not-allowed' : 'bg-ember-500 text-ember-950 border-ember-300/30 cursor-pointer'}`}>
          <Plus size={16} weight="bold" />
          {adding ? 'Adding' : 'Add a buck'}
          <input type="file" accept="image/*" className="sr-only" onChange={onAdd} disabled={full || adding} />
        </label>
      </div>

      {trophies && trophies.length === 0 && (
        <EmptyState
          icon={<TrophyIcon size={26} weight="duotone" />}
          title="No bucks on the list yet"
          body="Add a trail camera photo of a buck you want to hunt. Rutline keeps up to twenty, each with a few photos and a rough read of his age and what he would score."
        />
      )}

      {trophies && trophies.length > 0 && (
        <ul className="divide-y divide-bone-50/8 border-y border-bone-50/8">
          {trophies.map((t, i) => (
            <li key={t.id}>
              <Reveal delay={Math.min(i, 8) * 0.03}>
                <TrophyRow trophy={t} onOpen={() => setOpenId(t.id!)} />
              </Reveal>
            </li>
          ))}
        </ul>
      )}

      {full && <p className="text-[12.5px] text-bone-600">Trophy Center is full. Mark a buck as tagged, passed or gone and delete him to make room.</p>}

      <TrophySheet trophy={open} onClose={() => setOpenId(null)} />
    </div>
  )
}

// ---------- helpers ----------

function useObjectUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

function ageLabel(age: string | null): string | null {
  if (!age) return null
  return age.replace('.5', '½') + (age.endsWith('+') ? '' : ' yrs')
}
function readLine(r: BuckRead): string {
  const age = ageLabel(r.ageClass)
  return `${age ? `${age} · ` : ''}${r.grossLow} to ${r.grossHigh} gross`
}
const SOURCE_LABEL: Record<BuckRead['source'], string> = { ai: 'AI read', field: 'Field judged', tape: 'Traced' }
const STATUS_TONE: Record<TrophyStatus, string> = {
  hunting: 'text-ember-300 border-ember-500/40',
  tagged: 'text-bone-50 border-bone-50/30',
  passed: 'text-bone-400 border-bone-50/15',
  gone: 'text-bone-600 border-bone-50/10',
}
function fmtDate(ts: number | null): string {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ---------- list row ----------

function TrophyRow({ trophy, onOpen }: { trophy: Trophy; onOpen: () => void }) {
  const thumb = useObjectUrl(trophy.photos[0]?.thumb)
  return (
    <button onClick={onOpen} className="push w-full text-left flex items-center gap-4 py-3.5">
      <div className="w-16 h-16 rounded-xl overflow-hidden bg-pine-900 border border-bone-50/8 shrink-0">
        {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" /> : <ImageSquare size={22} className="m-auto mt-5 text-bone-700" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[15px] font-semibold tracking-tight truncate">{trophy.name}</span>
          <span className={`shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] border rounded px-1.5 py-0.5 ${STATUS_TONE[trophy.status]}`}>{TROPHY_STATUS[trophy.status].label}</span>
        </div>
        <div className="mt-0.5 text-[13px] text-bone-300 truncate">{trophy.read ? readLine(trophy.read) : 'No read yet'}</div>
        <div className="mt-0.5 text-[12px] text-bone-600 truncate">
          {trophy.photos.length} photo{trophy.photos.length === 1 ? '' : 's'}
          {trophy.lastSeen ? ` · seen ${fmtDate(trophy.lastSeen)}` : ''}
        </div>
      </div>
      <CaretRight size={16} className="text-bone-600 shrink-0" />
    </button>
  )
}

// ---------- detail sheet ----------

function TrophySheet({ trophy, onClose }: { trophy: Trophy | null; onClose: () => void }) {
  const { toast, settings } = useApp()
  const auth = useAuth()
  const [activePhoto, setActivePhoto] = useState(0)
  const [judging, setJudging] = useState(false)
  const [tracing, setTracing] = useState(false)
  const [reading, setReading] = useState(false)
  const [readError, setReadError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const pins = useLiveQuery(() => liveWaypointsOfTypes(['camera', 'stand', 'blind']), [])

  useEffect(() => {
    setActivePhoto(0)
    setJudging(false)
    setReadError(null)
    setConfirmDelete(false)
  }, [trophy?.id])

  const photo = trophy?.photos[Math.min(activePhoto, Math.max(0, (trophy?.photos.length ?? 1) - 1))] ?? null
  const big = useObjectUrl(photo?.blob)

  if (!trophy)
    return (
      <Sheet open={false} onClose={onClose}>
        {null}
      </Sheet>
    )
  const t = trophy
  const id = t.id!

  async function onAddPhoto(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      await addTrophyPhoto(id, f)
      setActivePhoto(t.photos.length)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not add that photo')
    }
  }

  async function aiRead() {
    if (!photo) return
    setReading(true)
    setReadError(null)
    try {
      const month = new Date(t.lastSeen ?? Date.now()).getMonth() + 1
      const read = await readBuck(photo.blob, photo.id, { region: settings.home?.label, month, trailCam: true })
      await setTrophyRead(id, read)
      toast(`Read: ${readLine(read)}`)
    } catch (err) {
      setReadError(err instanceof Error ? err.message : 'The read failed')
    } finally {
      setReading(false)
    }
  }

  async function applyTrace(values: Record<string, string>) {
    const r = scoreSheet(values)
    if (!r.any) {
      setTracing(false)
      return
    }
    const read: BuckRead = {
      source: 'tape',
      at: Date.now(),
      ageClass: t.read?.ageClass ?? null,
      points: t.read?.points ?? null,
      grossLow: Math.round(r.gross - 4),
      grossHigh: Math.round(r.gross + 4),
      confidence: 'medium',
      why: `Traced on the photo: left ${fmtEighths(r.L)}, right ${fmtEighths(r.R)}, spread ${fmtEighths(r.spread)}, gross ${fmtEighths(r.gross)}.`,
      limit: 'A traced score depends on the scale object and the camera angle. Only a tape on the rack is a real number.',
      photoId: photo?.id ?? null,
    }
    await setTrophyRead(id, read)
    setTracing(false)
    toast(`Traced: ${fmtEighths(r.gross)} gross`)
  }

  const signedIn = !!auth.user
  const aiNote = !cloudConfigured ? 'AI reads need the account service, which this build does not have.' : !signedIn ? 'Sign in under Settings to get AI reads. Field judging works without an account.' : null
  const cell = 'h-10 w-full px-3 rounded-xl bg-pine-950 border border-bone-50/10 text-bone-50 text-sm outline-none focus:border-ember-500/60'

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={t.name}
        scrollKey={id}
        footer={
          <div className="flex items-center justify-between gap-3">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="primary" onClick={async () => { await deleteTrophy(id); onClose(); toast('Removed from Trophy Center') }}>
                  Delete him
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Keep
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)} className="text-ember-400">
                <Trash size={15} /> Delete
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={onClose}>
              Done
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Photos */}
          <div>
            <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-pine-950 border border-bone-50/8 grid place-items-center">
              {big ? <img src={big} alt={t.name} className="w-full h-full object-contain" /> : <ImageSquare size={28} className="text-bone-700" />}
            </div>
            <div className="mt-2 flex items-center gap-2 overflow-x-auto no-bar">
              {t.photos.map((p, i) => (
                <PhotoThumb key={p.id} blob={p.thumb} active={i === activePhoto} onClick={() => setActivePhoto(i)} />
              ))}
              {t.photos.length < MAX_TROPHY_PHOTOS && (
                <label className="push shrink-0 w-14 h-14 rounded-lg border border-dashed border-bone-50/20 grid place-items-center text-bone-500 cursor-pointer hover:text-bone-200">
                  <Plus size={16} />
                  <input type="file" accept="image/*" className="sr-only" onChange={onAddPhoto} />
                </label>
              )}
              {t.photos.length > 1 && photo && (
                <button onClick={() => { void removeTrophyPhoto(id, photo.id); setActivePhoto(0) }} className="push ml-auto shrink-0 inline-flex items-center gap-1 text-[12px] text-bone-500 hover:text-bone-50">
                  <X size={12} /> Remove this photo
                </button>
              )}
            </div>
          </div>

          {/* Estimate */}
          <div className="rounded-2xl border border-bone-50/8 bg-pine-900/60 p-4">
            {t.read ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <SectionLabel>{SOURCE_LABEL[t.read.source]} · {t.read.confidence} confidence</SectionLabel>
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono tnum">
                      {ageLabel(t.read.ageClass) && <span className="text-[17px] text-bone-300 whitespace-nowrap">{ageLabel(t.read.ageClass)}</span>}
                      <span className="text-[24px] leading-none text-bone-50 whitespace-nowrap">
                        {t.read.grossLow}
                        <span className="text-bone-600"> to </span>
                        {t.read.grossHigh}
                        <span className="text-[13px] text-bone-500 ml-2">gross</span>
                      </span>
                    </div>
                    {t.read.points != null && <div className="mt-1 text-[12px] text-bone-500">{t.read.points} points</div>}
                  </div>
                </div>
                <p className="mt-3 text-[13px] text-bone-300 leading-relaxed">
                  <span className="text-bone-50">Why:</span> {t.read.why}
                </p>
                <p className="mt-1.5 text-[13px] text-bone-400 leading-relaxed">
                  <span className="text-bone-50">Limit:</span> {t.read.limit}
                </p>
              </>
            ) : (
              <>
                <SectionLabel>No read yet</SectionLabel>
                <p className="mt-1 text-[13px] text-bone-400 leading-relaxed">Get a rough gross score from this photo: judge him against his own head, or trace the rack. Every read is an estimate from a picture, never a tape measure.</p>
              </>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {SHOW_AI_READ && (
                <Button size="sm" variant="primary" onClick={aiRead} disabled={reading || !photo || !!aiNote}>
                  <Sparkle size={15} weight="fill" className={reading ? 'animate-pulse' : ''} /> {reading ? 'Reading the photo' : t.read?.source === 'ai' ? 'Read again' : 'AI read'}
                </Button>
              )}
              <Button size="sm" variant={SHOW_AI_READ ? 'secondary' : 'primary'} onClick={() => setJudging((v) => !v)}>
                <Crosshair size={15} /> Field judge
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setTracing(true)} disabled={!photo}>
                <Ruler size={15} /> Trace it
              </Button>
            </div>
            {SHOW_AI_READ && aiNote && <p className="mt-2 text-[12px] text-bone-600">{aiNote}</p>}
            {readError && <p className="mt-2 text-[12.5px] text-ember-400">{readError}</p>}
            {judging && (
              <FieldJudgeForm
                initialPoints={t.read?.points ?? 8}
                onCancel={() => setJudging(false)}
                onSave={async (read) => {
                  await setTrophyRead(id, { ...read, ageClass: t.read?.ageClass ?? null, photoId: photo?.id ?? null })
                  setJudging(false)
                  toast(`Field judged: ${read.grossLow} to ${read.grossHigh}`)
                }}
              />
            )}
            <p className="mt-3 text-[11px] text-bone-600">Estimates, not a tape-verified score.</p>
          </div>

          {/* Details */}
          <div className="grid gap-4">
            <label className="block">
              <SectionLabel>Name</SectionLabel>
              <input className={`mt-1.5 ${cell}`} value={t.name} onChange={(e) => void updateTrophy(id, { name: e.target.value })} placeholder="Split brow, Big 10, the ridge buck" />
            </label>
            <div>
              <SectionLabel>Status</SectionLabel>
              <div className="mt-1.5">
                <Segmented id={`trophy-status-${id}`} value={t.status} onChange={(status) => void updateTrophy(id, { status })} options={(Object.keys(TROPHY_STATUS) as TrophyStatus[]).map((s) => ({ value: s, label: TROPHY_STATUS[s].label }))} />
              </div>
              <div className="mt-1 text-[12px] text-bone-600">{TROPHY_STATUS[t.status].hint}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block min-w-0">
                <SectionLabel>Last seen</SectionLabel>
                <input type="date" className={`mt-1.5 ${cell} font-mono text-[13px]`} value={t.lastSeen ? new Date(t.lastSeen).toISOString().slice(0, 10) : ''} onChange={(e) => void updateTrophy(id, { lastSeen: e.target.value ? new Date(e.target.value + 'T12:00:00').getTime() : null })} />
              </label>
              <label className="block min-w-0">
                <SectionLabel>Shows up at</SectionLabel>
                <select className={`mt-1.5 ${cell}`} value={t.waypointId ?? ''} onChange={(e) => void updateTrophy(id, { waypointId: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">No pin</option>
                  {(pins ?? []).map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              <SectionLabel>Notes</SectionLabel>
              <Textarea className="mt-1.5" rows={3} value={t.notes} onChange={(e) => void updateTrophy(id, { notes: e.target.value })} placeholder="Where he beds, what wind he moves on, when he showed up" />
            </label>
          </div>
        </div>
      </Sheet>

      {tracing && photo && <RackMeasure initial={{ blob: photo.blob, name: t.name }} onClose={() => setTracing(false)} onApply={(values) => void applyTrace(values)} />}
    </>
  )
}

function PhotoThumb({ blob, active, onClick }: { blob: Blob; active: boolean; onClick: () => void }) {
  const url = useObjectUrl(blob)
  return (
    <button onClick={onClick} className={`push shrink-0 w-14 h-14 rounded-lg overflow-hidden border ${active ? 'border-ember-500' : 'border-bone-50/10'}`} aria-pressed={active}>
      {url && <img src={url} alt="" className="w-full h-full object-cover" />}
    </button>
  )
}

// ---------- field judging ----------

function FieldJudgeForm({ initialPoints, onSave, onCancel }: { initialPoints: number; onSave: (read: Omit<BuckRead, 'ageClass' | 'photoId'>) => void; onCancel: () => void }) {
  const [input, setInput] = useState<FieldJudgeInput>({ points: Math.max(6, Math.min(14, initialPoints || 8)), spread: 'ears', beam: 'nose', tines: 'average', mass: 'average' })
  const result = useMemo(() => fieldJudge(input), [input])

  const group = <K extends keyof FieldJudgeInput>(key: K, label: string, options: ReadonlyArray<{ value: FieldJudgeInput[K]; label: string; hint: string }>) => (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-1.5 grid gap-1.5">
        {options.map((o) => {
          const on = input[key] === o.value
          return (
            <button key={String(o.value)} onClick={() => setInput((s) => ({ ...s, [key]: o.value }))} className={`push w-full text-left px-3 py-2 rounded-xl border ${on ? 'border-ember-500/60 bg-ember-500/10' : 'border-bone-50/10 bg-pine-950/60'}`} aria-pressed={on}>
              <span className="block text-[13px] text-bone-50">{o.label}</span>
              <span className="block text-[11.5px] text-bone-600">{o.hint}</span>
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="mt-4 pt-4 border-t border-bone-50/8 space-y-4">
      <p className="text-[12.5px] text-bone-400 leading-relaxed">Judge him against his own head. Alert ears span about 16 inches tip to tip, an ear is about 7 inches long, and eye to nose is about 8 inches.</p>
      <div>
        <SectionLabel>Typical points, whole rack</SectionLabel>
        <div className="mt-1.5 inline-flex items-center rounded-xl border border-bone-50/10 bg-pine-950/60">
          <button onClick={() => setInput((s) => ({ ...s, points: Math.max(6, s.points - 1) }))} className="push w-10 h-10 grid place-items-center text-bone-300" aria-label="Fewer points">
            <Minus size={14} />
          </button>
          <span className="w-12 text-center font-mono text-base tnum">{input.points}</span>
          <button onClick={() => setInput((s) => ({ ...s, points: Math.min(14, s.points + 1) }))} className="push w-10 h-10 grid place-items-center text-bone-300" aria-label="More points">
            <Plus size={14} />
          </button>
        </div>
      </div>
      {group('spread', 'Inside spread, against the ears', SPREAD_OPTIONS)}
      {group('beam', 'Main beams, in profile', BEAM_OPTIONS)}
      {group('tines', 'Tine length, against an ear', TINE_OPTIONS)}
      {group('mass', 'Mass, against the eye', MASS_OPTIONS)}
      <div className="rounded-xl border border-bone-50/8 bg-pine-950/60 p-3">
        <SectionLabel>Rough gross</SectionLabel>
        <div className="mt-1 font-mono text-[22px] leading-none tnum text-bone-50">
          {result.low}<span className="text-bone-600"> to </span>{result.high}
        </div>
        <div className="mt-1.5 text-[12px] text-bone-500 font-mono tnum">
          spread {result.parts.spread} · per side: beam {result.parts.beam}, tines {result.parts.tines}, mass {result.parts.mass}
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="primary"
          onClick={() =>
            onSave({
              source: 'field',
              at: Date.now(),
              points: input.points,
              grossLow: result.low,
              grossHigh: result.high,
              confidence: 'low',
              why: `Field judged: ${input.points} points, spread ${SPREAD_OPTIONS.find((o) => o.value === input.spread)?.label.toLowerCase()}, beams ${BEAM_OPTIONS.find((o) => o.value === input.beam)?.label.toLowerCase()}, ${input.tines} tines, ${input.mass} mass.`,
              limit: 'Judged by eye against the ears, nose and eye. Good to about ten inches either way on a clear broadside photo.',
            })
          }
        >
          Save this estimate
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
