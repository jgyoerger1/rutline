/**
 * Rough green score from a photo. The hunter sets a scale by tapping both
 * ends of something of known size (a dollar bill, a card, a tape; or a
 * deer's ears on a trail cam picture), then taps along each beam and tine.
 * Pixels become inches, inches drop into the score sheet. Circumferences are
 * estimated from the beam's width, since a photo cannot be wrapped.
 */
import { ArrowCounterClockwise, ArrowRight, Camera, Check, Images, TrashSimple, X } from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { fmtEighths, scoreSheet, type Sheet } from '../../lib/score'
import { Button } from '../ui'

interface Pt {
  x: number
  y: number
}

type RefKind = 'bill' | 'card-long' | 'card-short' | 'ruler' | 'custom' | 'ears' | 'ear'
const REFS: Array<{ id: RefKind; label: string; inches: number; hint: string; rough?: boolean; custom?: boolean }> = [
  { id: 'bill', label: 'Dollar bill, long edge', inches: 6.14, hint: 'Tap both ends of the bill' },
  { id: 'card-long', label: 'Credit card, long edge', inches: 3.37, hint: 'Tap both ends of the long edge' },
  { id: 'card-short', label: 'Credit card, short edge', inches: 2.125, hint: 'Tap both ends of the short edge' },
  { id: 'ruler', label: 'Tape or ruler at 12 inches', inches: 12, hint: 'Tap the zero mark and the 12 inch mark' },
  { id: 'custom', label: 'Something else', inches: 0, hint: 'Tap both ends of it', custom: true },
  { id: 'ears', label: 'Ear tips, alert (trail cam)', inches: 16, hint: 'Tap the tip of each ear. Mature buck, ears up.', rough: true },
  { id: 'ear', label: 'One ear, base to tip (trail cam)', inches: 7, hint: 'Tap where the ear meets the head, then its tip', rough: true },
]

interface Photo {
  id: string
  name: string
  bitmap: ImageBitmap
  w: number
  h: number
  ref: RefKind
  refInches: number
  scale: Pt[]
}

interface Trace {
  photo: string
  pts: Pt[]
}

type Kind = 'line' | 'path' | 'width'
interface MeasureDef {
  id: string
  side: 'R' | 'L' | null
  label: string
  short: string
  kind: Kind
  hint: string
}

const sideDefs = (s: 'R' | 'L'): MeasureDef[] => {
  const name = s === 'R' ? 'Right' : 'Left'
  return [
    { id: `${s}.F`, side: s, label: `${name} main beam`, short: 'Beam', kind: 'path', hint: 'Tap along the outside of the beam, from the burr to the tip. More taps on the curves.' },
    { id: `${s}.G1`, side: s, label: `${name} G1, brow tine`, short: 'G1', kind: 'path', hint: 'Tap where the tine leaves the top of the beam, then along it to the tip' },
    { id: `${s}.G2`, side: s, label: `${name} G2`, short: 'G2', kind: 'path', hint: 'Base on the beam first, then the tip' },
    { id: `${s}.G3`, side: s, label: `${name} G3`, short: 'G3', kind: 'path', hint: 'Base on the beam first, then the tip' },
    { id: `${s}.G4`, side: s, label: `${name} G4`, short: 'G4', kind: 'path', hint: 'Base on the beam first, then the tip. Skip if there is no G4.' },
    { id: `${s}.H1`, side: s, label: `${name} H1 width, burr to G1`, short: 'H1', kind: 'width', hint: 'Tap edge to edge across the beam at its narrowest between the burr and G1' },
    { id: `${s}.H2`, side: s, label: `${name} H2 width, G1 to G2`, short: 'H2', kind: 'width', hint: 'Edge to edge across the beam between G1 and G2' },
    { id: `${s}.H3`, side: s, label: `${name} H3 width, G2 to G3`, short: 'H3', kind: 'width', hint: 'Edge to edge across the beam between G2 and G3' },
    { id: `${s}.H4`, side: s, label: `${name} H4 width, G3 to G4`, short: 'H4', kind: 'width', hint: 'Edge to edge between G3 and G4, or halfway to the tip if there is no G4' },
  ]
}
const ORDER: MeasureDef[] = [{ id: 'spread', side: null, label: 'Inside spread', short: 'Spread', kind: 'line', hint: 'Tap the inside edge of each beam at the widest point' }, ...sideDefs('R'), ...sideDefs('L')]
const DEF = new Map(ORDER.map((d) => [d.id, d]))

/** Antler sections are a little oval; a plain π × width runs high. */
const ROUNDNESS = 0.95
const MAX_PX = 2200

interface View {
  z: number
  ox: number
  oy: number
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
const pathLength = (pts: Pt[]) => pts.reduce((s, p, i) => (i ? s + dist(pts[i - 1], p) : 0), 0)

export default function RackMeasure({ onClose, onApply }: { onClose: () => void; onApply: (values: Sheet) => void }) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [active, setActive] = useState(0)
  const [traces, setTraces] = useState<Record<string, Trace>>({})
  const [tool, setTool] = useState<string>('scale')
  const [customIn, setCustomIn] = useState('')
  const [hint, setHint] = useState<string | null>(null)
  const [loupe, setLoupe] = useState<{ sx: number; sy: number; ix: number; iy: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const loupeRef = useRef<HTMLCanvasElement>(null)
  const views = useRef(new Map<string, View>())
  const photo = photos[active] ?? null

  // Latest state for pointer handlers, which are bound once
  const st = useRef({ photo, traces, tool })
  st.current = { photo, traces, tool }

  // ---------- photos ----------

  const addFile = useCallback(async (file: File | Blob, name?: string) => {
    let bitmap: ImageBitmap
    try {
      const probe = await createImageBitmap(file, { imageOrientation: 'from-image' })
      const k = Math.min(1, MAX_PX / Math.max(probe.width, probe.height))
      if (k < 1) {
        bitmap = await createImageBitmap(probe, { resizeWidth: Math.round(probe.width * k), resizeHeight: Math.round(probe.height * k), resizeQuality: 'high' })
        probe.close()
      } else bitmap = probe
    } catch {
      setHint('Could not read that photo. Try a JPEG or PNG.')
      return
    }
    const id = `p${Date.now()}`
    setPhotos((ps) => {
      const next = [...ps, { id, name: name ?? (ps.length === 0 ? 'Front' : ps.length === 1 ? 'Side' : `Photo ${ps.length + 1}`), bitmap, w: bitmap.width, h: bitmap.height, ref: 'bill' as RefKind, refInches: 6.14, scale: [] }]
      setActive(next.length - 1)
      return next
    })
    setTool('scale')
    setHint(null)
  }, [])

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) void addFile(f)
    e.target.value = ''
  }

  useEffect(() => () => photos.forEach((p) => p.bitmap.close()), []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Dev hook so the tool can be driven without a camera
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as { __rackMeasure?: unknown }
    w.__rackMeasure = { addFromUrl: async (url: string) => addFile(await (await fetch(url)).blob()), addBlob: addFile }
    return () => {
      delete w.__rackMeasure
    }
  }, [addFile])

  // ---------- geometry ----------

  const viewOf = useCallback(
    (p: Photo): View => {
      let v = views.current.get(p.id)
      if (!v) {
        const box = boxRef.current
        const cw = box?.clientWidth ?? 0
        const ch = box?.clientHeight ?? 0
        if (!cw || !ch) return { z: 1, ox: 0, oy: 0 } // not laid out yet: fit on the next draw
        const z = Math.min(cw / p.w, ch / p.h) * 0.96
        v = { z, ox: (cw - p.w * z) / 2, oy: (ch - p.h * z) / 2 }
        views.current.set(p.id, v)
      }
      return v
    },
    [],
  )

  const toImg = (p: Photo, sx: number, sy: number): Pt => {
    const v = viewOf(p)
    return { x: (sx - v.ox) / v.z, y: (sy - v.oy) / v.z }
  }
  const toScreen = (p: Photo, pt: Pt): Pt => {
    const v = viewOf(p)
    return { x: pt.x * v.z + v.ox, y: pt.y * v.z + v.oy }
  }

  const ppi = (p: Photo): number | null => (p.scale.length === 2 && p.refInches > 0 ? dist(p.scale[0], p.scale[1]) / p.refInches : null)

  const inchesOf = useCallback(
    (id: string): number | null => {
      const t = traces[id]
      const d = DEF.get(id)
      if (!t || !d) return null
      const p = photos.find((x) => x.id === t.photo)
      if (!p) return null
      const k = ppi(p)
      if (!k || t.pts.length < 2) return null
      if (d.kind === 'width') return (dist(t.pts[0], t.pts[1]) / k) * Math.PI * ROUNDNESS
      return pathLength(t.pts) / k
    },
    [traces, photos],
  )

  const values = useMemo(() => {
    const out: Sheet = {}
    for (const d of ORDER) {
      const v = inchesOf(d.id)
      if (v != null && v > 0) out[d.id] = fmtEighths(v)
    }
    return out
  }, [inchesOf])
  const score = useMemo(() => scoreSheet(values), [values])
  const measured = Object.keys(values).length
  const rough = photos.some((p) => p.scale.length === 2 && REFS.find((r) => r.id === p.ref)?.rough)
  const band = Math.round(score.gross * (rough ? 0.15 : 0.06))

  // ---------- drawing ----------

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const box = boxRef.current
    const p = st.current.photo
    if (!canvas || !box) return
    const dpr = window.devicePixelRatio || 1
    const cw = box.clientWidth
    const ch = box.clientHeight
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
      canvas.width = Math.round(cw * dpr)
      canvas.height = Math.round(ch * dpr)
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cw, ch)
    if (!p) return
    const v = viewOf(p)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(p.bitmap, v.ox, v.oy, p.w * v.z, p.h * v.z)

    const S = (pt: Pt) => ({ x: pt.x * v.z + v.ox, y: pt.y * v.z + v.oy })
    const handle = (pt: Pt, color: string, big: boolean) => {
      const s = S(pt)
      ctx.beginPath()
      ctx.arc(s.x, s.y, big ? 7 : 4.5, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.lineWidth = 1.5
      ctx.strokeStyle = 'rgba(15,17,16,0.9)'
      ctx.stroke()
    }
    const line = (pts: Pt[], color: string, width: number, dash?: number[]) => {
      if (pts.length < 2) return
      ctx.beginPath()
      pts.forEach((pt, i) => {
        const s = S(pt)
        if (i) ctx.lineTo(s.x, s.y)
        else ctx.moveTo(s.x, s.y)
      })
      ctx.setLineDash(dash ?? [])
      ctx.lineWidth = width
      ctx.strokeStyle = color
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.stroke()
      ctx.setLineDash([])
    }
    const label = (pt: Pt, text: string, color: string) => {
      const s = S(pt)
      ctx.font = '600 11px ui-monospace, Menlo, monospace'
      const w = ctx.measureText(text).width + 10
      ctx.fillStyle = 'rgba(15,17,16,0.78)'
      ctx.beginPath()
      ctx.roundRect(s.x + 9, s.y - 19, w, 16, 4)
      ctx.fill()
      ctx.fillStyle = color
      ctx.fillText(text, s.x + 14, s.y - 7)
    }

    const { traces: tr, tool: tl } = st.current
    // Other measures on this photo, quiet
    for (const [id, t] of Object.entries(tr)) {
      if (t.photo !== p.id || id === tl) continue
      const d = DEF.get(id)
      if (!d) continue
      line(t.pts, 'rgba(242,237,226,0.55)', 1.5)
      t.pts.forEach((pt) => handle(pt, 'rgba(242,237,226,0.6)', false))
      const inches = (() => {
        const k = ppi(p)
        if (!k || t.pts.length < 2) return null
        return d.kind === 'width' ? (dist(t.pts[0], t.pts[1]) / k) * Math.PI * ROUNDNESS : pathLength(t.pts) / k
      })()
      if (t.pts.length) label(t.pts[0], inches != null ? `${d.short} ${fmtEighths(inches)}` : d.short, '#d6d0c3')
    }
    // Scale
    if (p.scale.length) {
      line(p.scale, '#c9b07a', 2, [6, 4])
      p.scale.forEach((pt) => handle(pt, '#c9b07a', tl === 'scale'))
      if (p.scale.length === 2) label(p.scale[1], `${p.refInches} in`, '#c9b07a')
    }
    // Active measure, loud
    const at = tl !== 'scale' ? tr[tl] : null
    if (at && at.photo === p.id) {
      const d = DEF.get(tl)!
      line(at.pts, '#e8702c', 3)
      at.pts.forEach((pt) => handle(pt, '#e8702c', true))
      const k = ppi(p)
      const inches = k && at.pts.length >= 2 ? (d.kind === 'width' ? (dist(at.pts[0], at.pts[1]) / k) * Math.PI * ROUNDNESS : pathLength(at.pts) / k) : null
      if (at.pts.length) label(at.pts[at.pts.length - 1], inches != null ? `${d.short} ${fmtEighths(inches)}` : d.short, '#f5a86b')
    }
  }, [viewOf])

  useEffect(() => {
    draw()
  }, [draw, photos, active, traces, tool])

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const ro = new ResizeObserver(() => draw())
    ro.observe(box)
    return () => ro.disconnect()
  }, [draw])

  // Loupe: a zoomed crop of the image around the dragged point
  useEffect(() => {
    const c = loupeRef.current
    const p = photo
    if (!c || !loupe || !p) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const size = 128
    const dpr = window.devicePixelRatio || 1
    c.width = size * dpr
    c.height = size * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const half = 22
    ctx.fillStyle = '#0f1110'
    ctx.fillRect(0, 0, size, size)
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(p.bitmap, loupe.ix - half, loupe.iy - half, half * 2, half * 2, 0, 0, size, size)
    ctx.strokeStyle = 'rgba(232,112,44,0.95)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(size / 2, 0)
    ctx.lineTo(size / 2, size)
    ctx.moveTo(0, size / 2)
    ctx.lineTo(size, size / 2)
    ctx.stroke()
  }, [loupe, photo])

  // ---------- pointer handling ----------

  type Gesture = { kind: 'tap'; sx: number; sy: number; moved: boolean } | { kind: 'pan'; sx: number; sy: number; ox: number; oy: number } | { kind: 'drag'; target: 'scale' | 'measure'; index: number } | { kind: 'pinch'; d0: number; z0: number; cx: number; cy: number; ox: number; oy: number }
  const pointers = useRef(new Map<number, Pt>())
  const gesture = useRef<Gesture | null>(null)

  const local = (e: { clientX: number; clientY: number }): Pt => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const hitHandle = (p: Photo, s: Pt): { target: 'scale' | 'measure'; index: number } | null => {
    const { tool: tl, traces: tr } = st.current
    const near = (pts: Pt[]) => {
      let best = -1
      let bd = 18
      pts.forEach((pt, i) => {
        const d = dist(toScreen(p, pt), s)
        if (d < bd) {
          bd = d
          best = i
        }
      })
      return best
    }
    if (tl === 'scale') {
      if (p.scale.length < 2) return null // still placing: taps add, never drag
      const i = near(p.scale)
      return i >= 0 ? { target: 'scale', index: i } : null
    }
    const t = tr[tl]
    const d = DEF.get(tl)
    if (t && t.photo === p.id) {
      // The second end of a thin beam can sit inside the first handle's hit
      // area, so an unfinished two-point measure always adds its point.
      if (d && d.kind !== 'path' && t.pts.length < 2) return null
      const i = near(t.pts)
      if (i >= 0) return { target: 'measure', index: i }
    }
    const i = near(p.scale)
    return i >= 0 ? { target: 'scale', index: i } : null
  }

  const movePoint = (p: Photo, target: 'scale' | 'measure', index: number, pt: Pt) => {
    const clamp = { x: Math.max(0, Math.min(p.w, pt.x)), y: Math.max(0, Math.min(p.h, pt.y)) }
    if (target === 'scale') setPhotos((ps) => ps.map((x) => (x.id === p.id ? { ...x, scale: x.scale.map((q, i) => (i === index ? clamp : q)) } : x)))
    else setTraces((tr) => ({ ...tr, [st.current.tool]: { ...tr[st.current.tool], pts: tr[st.current.tool].pts.map((q, i) => (i === index ? clamp : q)) } }))
  }

  const addPoint = (p: Photo, pt: Pt) => {
    const { tool: tl, traces: tr } = st.current
    if (pt.x < 0 || pt.y < 0 || pt.x > p.w || pt.y > p.h) return
    if (tl === 'scale') {
      if (p.scale.length >= 2) {
        setHint('Drag the brass handles to adjust the scale, or pick a measure below.')
        return
      }
      const next = [...p.scale, pt]
      setPhotos((ps) => ps.map((x) => (x.id === p.id ? { ...x, scale: next } : x)))
      if (next.length === 2) {
        setHint('Scale set. Now trace the rack.')
        setTool(photos.length > 1 && traces.spread ? 'R.F' : 'spread')
      }
      return
    }
    const d = DEF.get(tl)
    if (!d) return
    const t = tr[tl]
    if (t && t.photo !== p.id && t.pts.length) {
      setHint(`${d.label} is traced on the ${photos.find((x) => x.id === t.photo)?.name ?? 'other'} photo. Clear it to trace it here.`)
      return
    }
    if (d.kind !== 'path' && (t?.pts.length ?? 0) >= 2) {
      setHint('Two points is all this one takes. Drag an end to adjust it.')
      return
    }
    setTraces((cur) => ({ ...cur, [tl]: { photo: p.id, pts: [...(cur[tl]?.pts ?? []), pt] } }))
    setHint(null)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = st.current.photo
    if (!p) return
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* synthetic events have no capture */
    }
    const s = local(e)
    pointers.current.set(e.pointerId, s)
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values())
      const v = viewOf(p)
      gesture.current = { kind: 'pinch', d0: dist(a, b) || 1, z0: v.z, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, ox: v.ox, oy: v.oy }
      setLoupe(null)
      return
    }
    const hit = hitHandle(p, s)
    if (hit) {
      gesture.current = { kind: 'drag', ...hit }
      const ip = toImg(p, s.x, s.y)
      setLoupe({ sx: s.x, sy: s.y, ix: ip.x, iy: ip.y })
    } else gesture.current = { kind: 'tap', sx: s.x, sy: s.y, moved: false }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = st.current.photo
    const g = gesture.current
    if (!p || !g || !pointers.current.has(e.pointerId)) return
    const s = local(e)
    pointers.current.set(e.pointerId, s)
    if (g.kind === 'pinch') {
      if (pointers.current.size < 2) return
      const [a, b] = Array.from(pointers.current.values())
      const z = Math.max(0.05, Math.min(40, (g.z0 * dist(a, b)) / g.d0))
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      // Keep the image point under the pinch centre fixed, then follow the fingers
      const ix = (g.cx - g.ox) / g.z0
      const iy = (g.cy - g.oy) / g.z0
      views.current.set(p.id, { z, ox: mx - ix * z, oy: my - iy * z })
      draw()
      return
    }
    if (g.kind === 'drag') {
      const ip = toImg(p, s.x, s.y)
      movePoint(p, g.target, g.index, ip)
      setLoupe({ sx: s.x, sy: s.y, ix: Math.max(0, Math.min(p.w, ip.x)), iy: Math.max(0, Math.min(p.h, ip.y)) })
      return
    }
    if (g.kind === 'tap') {
      if (Math.hypot(s.x - g.sx, s.y - g.sy) > 8) {
        const v = viewOf(p)
        gesture.current = { kind: 'pan', sx: g.sx, sy: g.sy, ox: v.ox, oy: v.oy }
      } else return
    }
    const pg = gesture.current
    if (pg && pg.kind === 'pan') {
      const v = viewOf(p)
      views.current.set(p.id, { z: v.z, ox: pg.ox + (s.x - pg.sx), oy: pg.oy + (s.y - pg.sy) })
      draw()
    }
  }

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = st.current.photo
    const g = gesture.current
    pointers.current.delete(e.pointerId)
    if (p && g?.kind === 'tap') {
      const s = local(e)
      addPoint(p, toImg(p, s.x, s.y))
    }
    if (pointers.current.size === 0) {
      gesture.current = null
      setLoupe(null)
    } else if (g?.kind === 'pinch') {
      // One finger left: continue as a pan from here
      const [rest] = Array.from(pointers.current.values())
      const v = p ? viewOf(p) : { z: 1, ox: 0, oy: 0 }
      gesture.current = { kind: 'pan', sx: rest.x, sy: rest.y, ox: v.ox, oy: v.oy }
    }
  }

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const p = st.current.photo
    if (!p) return
    e.preventDefault()
    const s = local(e)
    const v = viewOf(p)
    const z = Math.max(0.05, Math.min(40, v.z * Math.exp(-e.deltaY * 0.0015)))
    const ix = (s.x - v.ox) / v.z
    const iy = (s.y - v.oy) / v.z
    views.current.set(p.id, { z, ox: s.x - ix * z, oy: s.y - iy * z })
    draw()
  }

  // ---------- toolbar actions ----------

  const activeDef = DEF.get(tool) ?? null
  const activeTrace = tool !== 'scale' ? traces[tool] : undefined
  const canUndo = tool === 'scale' ? (photo?.scale.length ?? 0) > 0 : (activeTrace?.pts.length ?? 0) > 0

  function undo() {
    if (!photo) return
    if (tool === 'scale') setPhotos((ps) => ps.map((x) => (x.id === photo.id ? { ...x, scale: x.scale.slice(0, -1) } : x)))
    else if (activeTrace) setTraces((tr) => ({ ...tr, [tool]: { ...activeTrace, pts: activeTrace.pts.slice(0, -1) } }))
  }
  function clear() {
    if (!photo) return
    if (tool === 'scale') setPhotos((ps) => ps.map((x) => (x.id === photo.id ? { ...x, scale: [] } : x)))
    else
      setTraces((tr) => {
        const next = { ...tr }
        delete next[tool]
        return next
      })
  }
  function next() {
    const i = ORDER.findIndex((d) => d.id === tool)
    const n = ORDER[(i + 1) % ORDER.length]
    setTool(n.id)
    setHint(null)
  }
  function pickRef(id: RefKind) {
    if (!photo) return
    const r = REFS.find((x) => x.id === id)!
    const inches = r.custom ? Number(customIn) || 0 : r.inches
    setPhotos((ps) => ps.map((x) => (x.id === photo.id ? { ...x, ref: id, refInches: inches } : x)))
  }
  useEffect(() => {
    if (!photo || photo.ref !== 'custom') return
    const inches = Number(customIn) || 0
    setPhotos((ps) => ps.map((x) => (x.id === photo.id ? { ...x, refInches: inches } : x)))
  }, [customIn]) // eslint-disable-line react-hooks/exhaustive-deps

  const refDef = photo ? REFS.find((r) => r.id === photo.ref)! : REFS[0]
  const scaleReady = !!photo && ppi(photo) != null
  const chipValue = (id: string) => values[id]
  const side: 'R' | 'L' = activeDef?.side ?? 'R'

  // Portal: the view behind is inside a transformed page wrapper, which would pin a fixed panel to it
  return createPortal(
    <div className="fixed inset-0 z-[80] bg-pine-950 text-bone-50 flex flex-col" role="dialog" aria-label="Measure a rack from a photo">
      <header className="shrink-0 pt-safe border-b border-bone-50/8 bg-pine-900/80 backdrop-blur">
        <div className="h-12 px-3 flex items-center gap-2">
          <div className="font-display font-bold tracking-[0.08em] uppercase text-[13px]">Measure a rack</div>
          <div className="hidden sm:block text-[11px] font-mono uppercase tracking-[0.16em] text-bone-600">Rough green score</div>
          <div className="ml-auto flex items-center gap-1 overflow-x-auto no-bar">
            {photos.map((p, i) => (
              <button key={p.id} onClick={() => { setActive(i); setTool(p.scale.length === 2 ? tool === 'scale' ? 'spread' : tool : 'scale') }} className={`push h-8 px-3 rounded-lg text-[12px] font-medium whitespace-nowrap ${i === active ? 'bg-pine-700 text-bone-50' : 'text-bone-400'}`}>
                {p.name}
                {p.scale.length === 2 ? '' : ' · scale?'}
              </button>
            ))}
            {photos.length > 0 && photos.length < 3 && (
              <button onClick={() => fileRef.current?.click()} className="push h-8 px-2.5 rounded-lg text-[12px] text-bone-400 hover:text-bone-50 whitespace-nowrap" title="Add a side photo">
                + Side
              </button>
            )}
          </div>
          <button onClick={onClose} className="push w-9 h-9 grid place-items-center rounded-lg text-bone-400 hover:text-bone-50" aria-label="Close">
            <X size={18} />
          </button>
        </div>
      </header>

      <div ref={boxRef} className="relative flex-1 min-h-0 bg-pine-950 overflow-hidden">
        {photo ? (
          <>
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ touchAction: 'none' }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel} />
            {loupe && (
              <canvas ref={loupeRef} className="absolute w-32 h-32 rounded-full border-2 border-ember-400 shadow-pine pointer-events-none" style={{ left: loupe.sx > (boxRef.current?.clientWidth ?? 0) / 2 ? 12 : undefined, right: loupe.sx > (boxRef.current?.clientWidth ?? 0) / 2 ? undefined : 12, top: 12 }} />
            )}
            {hint && <div className="absolute left-1/2 -translate-x-1/2 bottom-3 max-w-[92%] glass rounded-full px-4 py-2 text-[13px] text-bone-50 text-center pointer-events-none">{hint}</div>}
          </>
        ) : (
          <div className="absolute inset-0 overflow-y-auto">
            <div className="max-w-[520px] mx-auto px-5 py-10 md:py-16">
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-bone-600">How it works</div>
              <h2 className="mt-2 text-[26px] md:text-[32px] font-semibold tracking-tight leading-tight">Photograph the rack with a ruler in the shot</h2>
              <ol className="mt-5 space-y-3 text-[15px] text-bone-200 leading-relaxed list-decimal pl-5">
                <li>Lay a dollar bill, a credit card or a tape pulled to 12 inches flat beside the antlers, at the same distance from the camera.</li>
                <li>Shoot straight on with the normal lens, not the wide one, and fill the frame. A second photo from the side makes the beams more honest.</li>
                <li>Tap both ends of the ruler to set the scale, then tap along each beam and tine. Circumferences come from the beam’s width.</li>
              </ol>
              <p className="mt-4 text-[13px] text-bone-600 leading-relaxed">Expect a total within 5 to 10 inches of a tape measure. Trail cam pictures work too, using the deer’s ears as the ruler, with about twice the error.</p>
              <div className="mt-7 flex flex-wrap gap-2">
                <Button variant="primary" size="lg" onClick={() => fileRef.current?.click()}>
                  <Camera size={18} weight="bold" /> Take or choose a photo
                </Button>
              </div>
            </div>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      </div>

      {photo && (
        <footer className="shrink-0 border-t border-bone-50/8 bg-pine-900/90 backdrop-blur pb-safe">
          {tool === 'scale' ? (
            <div className="px-3 py-3 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-[12px] text-bone-400 shrink-0" htmlFor="rack-ref">
                  Scale from
                </label>
                <select id="rack-ref" value={photo.ref} onChange={(e) => pickRef(e.target.value as RefKind)} className="h-9 px-2.5 rounded-lg bg-pine-950 border border-bone-50/10 text-[13px] text-bone-50 outline-none focus:border-ember-500/60 max-w-[62%]">
                  {REFS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
                {photo.ref === 'custom' && <input value={customIn} onChange={(e) => setCustomIn(e.target.value)} inputMode="decimal" placeholder="inches" aria-label="Reference length in inches" className="h-9 w-24 px-2.5 rounded-lg bg-pine-950 border border-bone-50/10 text-[13px] font-mono text-bone-50 outline-none focus:border-ember-500/60" />}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 text-[13px] text-bone-200">
                  {photo.scale.length < 2 ? refDef.hint : `Scale set: ${photo.refInches} in across the brass line.`}
                  {refDef.rough && <span className="block text-[12px] text-ember-300">Ears vary by region and age. Treat this as a wide estimate.</span>}
                </div>
                <Button size="sm" variant="ghost" disabled={!canUndo} onClick={undo} aria-label="Undo last point">
                  <ArrowCounterClockwise size={15} />
                </Button>
                <Button size="sm" variant="primary" disabled={!scaleReady} onClick={() => setTool(traces.spread ? 'R.F' : 'spread')}>
                  Trace <ArrowRight size={14} />
                </Button>
              </div>
            </div>
          ) : (
            <div className="px-3 py-2.5 space-y-2">
              <div className="flex items-center gap-2 overflow-x-auto no-bar">
                <Chip on={tool === 'spread'} value={chipValue('spread')} onClick={() => setTool('spread')}>
                  Spread
                </Chip>
                <span className="w-px h-6 bg-bone-50/10 shrink-0" />
                {(['R', 'L'] as const).map((s) => (
                  <button key={s} onClick={() => setTool(`${s}.F`)} className={`push shrink-0 h-8 px-2.5 rounded-lg text-[12px] font-semibold ${side === s ? 'bg-ember-500 text-ember-950' : 'bg-pine-800 text-bone-400'}`}>
                    {s === 'R' ? 'Right' : 'Left'}
                  </button>
                ))}
                {sideDefs(side).map((d) => (
                  <Chip key={d.id} on={tool === d.id} value={chipValue(d.id)} onClick={() => setTool(d.id)}>
                    {d.short}
                  </Chip>
                ))}
                <button onClick={() => setTool('scale')} className="push shrink-0 h-8 px-2.5 rounded-lg text-[12px] text-bone-400">
                  Scale
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-bone-50 truncate">
                    {activeDef?.label}
                    {values[tool] && <span className="ml-2 font-mono text-ember-300 tnum">{values[tool]}</span>}
                  </div>
                  <div className="text-[12px] text-bone-400 truncate">{activeDef?.hint}</div>
                </div>
                <Button size="sm" variant="ghost" disabled={!canUndo} onClick={undo} aria-label="Undo last point">
                  <ArrowCounterClockwise size={15} />
                </Button>
                <Button size="sm" variant="ghost" disabled={!activeTrace} onClick={clear} aria-label="Clear this measure">
                  <TrashSimple size={15} />
                </Button>
                <Button size="sm" variant="secondary" onClick={next}>
                  Next <ArrowRight size={14} />
                </Button>
              </div>
              <div className="flex items-center gap-3 border-t border-bone-50/8 pt-2">
                <div className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-1.5 font-mono text-[12px] tnum text-bone-400 leading-tight">
                  {measured ? (
                    <>
                      <span className="text-bone-50 whitespace-nowrap">Gross {fmtEighths(score.gross)}</span>
                      <span>·</span>
                      <span className="text-bone-50 whitespace-nowrap">Net {fmtEighths(score.net)}</span>
                      <span>·</span>
                      <span className="whitespace-nowrap">±{band}</span>
                      <span>·</span>
                      <span className="whitespace-nowrap">
                        {measured}/{ORDER.length}
                      </span>
                    </>
                  ) : (
                    <span>Nothing traced yet</span>
                  )}
                </div>
                <Button size="sm" variant="primary" disabled={!measured} onClick={() => onApply(values)}>
                  <Check size={15} weight="bold" /> Add to sheet
                </Button>
              </div>
            </div>
          )}
        </footer>
      )}
      {!photo && photos.length === 0 && (
        <footer className="shrink-0 border-t border-bone-50/8 bg-pine-900/90 pb-safe px-3 py-2 flex items-center gap-2 text-[12px] text-bone-600">
          <Images size={14} /> Photos stay on this device. Nothing is uploaded.
        </footer>
      )}
    </div>,
    document.body,
  )
}

function Chip({ on, value, onClick, children }: { on: boolean; value?: string; onClick: () => void; children: string }) {
  return (
    <button onClick={onClick} className={`push shrink-0 h-8 px-2.5 rounded-lg text-[12px] inline-flex items-center gap-1.5 border ${on ? 'border-ember-500/60 bg-ember-950/60 text-bone-50' : value ? 'border-bone-50/15 text-bone-200' : 'border-bone-50/8 text-bone-500'}`}>
      <span className="font-medium">{children}</span>
      {value && <span className="font-mono text-[11px] tnum text-bone-400">{value}</span>}
    </button>
  )
}
