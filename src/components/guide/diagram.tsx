/**
 * Shared pieces for the Field Guide diagrams: a spring camera that writes the
 * SVG viewBox straight to the DOM (vector stays crisp at every zoom, strokes
 * and labels re-derived so they hold a constant size on screen), scene
 * crossfades, scroll-drawn cut lines, labels and tube geometry.
 */
import { AnimatePresence, motion, useMotionValueEvent, useSpring, useTransform, type MotionValue } from 'framer-motion'
import { useCallback, useId, useLayoutEffect, useEffect, useRef, type ReactNode, type RefObject } from 'react'

export interface Camera {
  cx: number
  cy: number
  w: number
}

export const BONE = '#f2ede2'
export const BONE_200 = '#d6d0c3'
export const BONE_400 = '#a9ad9f'
export const BONE_600 = '#767d74'
export const EMBER = '#e8702c'
export const EMBER_300 = '#f5a86b'
export const BRASS = '#c4ab74'
export const HIDE = '#1d221f'
export const HIDE_EDGE = '#d6d0c3'

export const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1]

export interface ScaledGroup {
  ref: RefObject<SVGGElement | null>
  /** Screen pixels of stroke to hold */
  stroke?: number
  /** Screen pixels of font size to hold */
  font?: number
}

/** Drive an SVG's viewBox from three slow springs. Returns nothing; it writes the DOM. */
export function useCamera(svgRef: RefObject<SVGSVGElement | null>, cam: Camera, reduced: boolean, scaled: ScaledGroup[]) {
  const spring = { stiffness: 58, damping: 19, mass: 1 }
  const cx = useSpring(cam.cx, spring)
  const cy = useSpring(cam.cy, spring)
  const w = useSpring(cam.w, spring)
  const scaledRef = useRef(scaled)
  scaledRef.current = scaled
  const viewBox = useTransform([cx, cy, w], ([x, y, ww]) => {
    const h = (ww as number) * 0.6
    return `${(x as number) - (ww as number) / 2} ${(y as number) - h / 2} ${ww} ${h}`
  })

  const apply = useCallback(
    (vb: string) => {
      const svg = svgRef.current
      if (!svg) return
      svg.setAttribute('viewBox', vb)
      const ww = w.get()
      const h = ww * 0.6
      const unit = Math.min(svg.clientWidth / ww, svg.clientHeight / h) || 1
      for (const g of scaledRef.current) {
        const el = g.ref.current
        if (!el) continue
        if (g.stroke) el.setAttribute('stroke-width', (g.stroke / unit).toFixed(3))
        if (g.font) el.setAttribute('font-size', (g.font / unit).toFixed(2))
      }
    },
    [svgRef, w],
  )
  useMotionValueEvent(viewBox, 'change', apply)
  useLayoutEffect(() => {
    apply(viewBox.get())
    const svg = svgRef.current
    if (!svg) return
    const ro = new ResizeObserver(() => apply(viewBox.get()))
    ro.observe(svg)
    return () => ro.disconnect()
  }, [apply, viewBox, svgRef])

  useEffect(() => {
    if (reduced) {
      cx.jump(cam.cx)
      cy.jump(cam.cy)
      w.jump(cam.w)
    } else {
      cx.set(cam.cx)
      cy.set(cam.cy)
      w.set(cam.w)
    }
  }, [cam.cx, cam.cy, cam.w, reduced, cx, cy, w])
}

/** Crossfade a scene's overlay group when the key changes. */
export function Phase({ id, reduced, delay = 0, children }: { id: string; reduced: boolean; delay?: number; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      <motion.g key={id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0.2 : 0.45, ease: EASE_OUT, delay: reduced ? 0 : delay }}>
        {children}
      </motion.g>
    </AnimatePresence>
  )
}

export function GlowDefs() {
  return (
    <filter id="fg-glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="5" result="b" />
      <feMerge>
        <feMergeNode in="b" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  )
}

/** A path that draws with scroll progress. Dashed variant reveals a static dashed line through a drawing mask. */
export function Cut({ d, dash, glow = true, color = EMBER, p, width }: { d: string; dash?: boolean; glow?: boolean; color?: string; p: MotionValue<number>; width?: number }) {
  const id = useId().replace(/:/g, '')
  if (!dash) return <motion.path d={d} stroke={color} strokeWidth={width} style={{ pathLength: p }} filter={glow ? 'url(#fg-glow)' : undefined} />
  return (
    <g>
      <mask id={`cut-${id}`} maskUnits="userSpaceOnUse" x="-200" y="-200" width="1400" height="1000">
        <motion.path d={d} stroke="#fff" strokeWidth="24" style={{ pathLength: p }} />
      </mask>
      <path d={d} stroke={color} strokeWidth={width} strokeDasharray="7 7" mask={`url(#cut-${id})`} filter={glow ? 'url(#fg-glow)' : undefined} />
    </g>
  )
}

export function ArrowHead({ x, y, dir = 1, p, size = 12, angle = 0 }: { x: number; y: number; dir?: 1 | -1; p: MotionValue<number>; size?: number; angle?: number }) {
  const o = useTransform(p, [0.86, 1], [0, 1])
  return <motion.path d={`M${x - dir * size} ${y - size * 0.55} L ${x} ${y} L ${x - dir * size} ${y + size * 0.55}`} style={{ opacity: o }} transform={angle ? `rotate(${angle} ${x} ${y})` : undefined} />
}

/** Something that appears once progress passes a threshold. */
export function At({ p, from, to, children }: { p: MotionValue<number>; from: number; to?: number; children: ReactNode }) {
  const o = useTransform(p, [from, to ?? Math.min(1, from + 0.12)], [0, 1])
  return <motion.g style={{ opacity: o }}>{children}</motion.g>
}

export function Label({ x, y, lead, anchor = 'start', dim, children }: { x: number; y: number; lead?: [number, number]; anchor?: 'start' | 'end' | 'middle'; dim?: boolean; children: string }) {
  return (
    <g>
      {lead && <path d={`M${x} ${y + 4} L ${lead[0]} ${lead[1]}`} stroke={BONE_600} strokeDasharray="2 3" fill="none" />}
      <text x={x} y={y} textAnchor={anchor} fill={dim ? BONE_600 : undefined}>
        {children}
      </text>
    </g>
  )
}

// ---------- geometry ----------

export type Pt = [number, number]

/** Sample a cubic Bézier into points. */
export function cubic(p0: Pt, c1: Pt, c2: Pt, p1: Pt, n = 24): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const mt = 1 - t
    out.push([mt * mt * mt * p0[0] + 3 * mt * mt * t * c1[0] + 3 * mt * t * t * c2[0] + t * t * t * p1[0], mt * mt * mt * p0[1] + 3 * mt * mt * t * c1[1] + 3 * mt * t * t * c2[1] + t * t * t * p1[1]])
  }
  return out
}

/** Sample a quadratic Bézier into points. */
export function quad(p0: Pt, c: Pt, p1: Pt, n = 14): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const mt = 1 - t
    out.push([mt * mt * p0[0] + 2 * mt * t * c[0] + t * t * p1[0], mt * mt * p0[1] + 2 * mt * t * c[1] + t * t * p1[1]])
  }
  return out
}

function normals(pts: Pt[]): Pt[] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(pts.length - 1, i + 1)]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len = Math.hypot(dx, dy) || 1
    return [-dy / len, dx / len]
  })
}

const f = (n: number) => n.toFixed(1)

/** Offset a sampled centreline into a closed, tapering tube (plus the last 9% as a cap). */
export function tube(pts: Pt[], w0: number, w1: number): { body: string; cap: string; left: Pt[]; right: Pt[] } {
  const n = pts.length - 1
  const nrm = normals(pts)
  const left: Pt[] = []
  const right: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const hw = (w0 + (w1 - w0) * (i / n)) / 2
    const [x, y] = pts[i]
    const [nx, ny] = nrm[i]
    left.push([x + nx * hw, y + ny * hw])
    right.push([x - nx * hw, y - ny * hw])
  }
  const body = `M${left.map((p) => `${f(p[0])} ${f(p[1])}`).join(' L')} L${[...right].reverse().map((p) => `${f(p[0])} ${f(p[1])}`).join(' L')} Z`
  const k = Math.max(1, Math.round(n * 0.09))
  const cl = left.slice(n - k).map((p, i) => {
    const [nx, ny] = nrm[n - k + i]
    return `${f(p[0] + nx * 1.5)} ${f(p[1] + ny * 1.5)}`
  })
  const cr = right.slice(n - k).map((p, i) => {
    const [nx, ny] = nrm[n - k + i]
    return `${f(p[0] - nx * 1.5)} ${f(p[1] - ny * 1.5)}`
  })
  const cap = `M${cl.join(' L')} L${cr.reverse().join(' L')} Z`
  return { body, cap, left, right }
}

export function polyPath(pts: Pt[]): string {
  return `M${pts.map((p) => `${f(p[0])} ${f(p[1])}`).join(' L')}`
}

/** Deterministic contour-like closed path around a centre (topo backdrop). */
export function contour(cx: number, cy: number, r: number, seed: number, wobble = 0.22): string {
  const pts: string[] = []
  const n = 28
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const m = 1 + wobble * (Math.sin(a * 3 + seed) * 0.6 + Math.sin(a * 5 + seed * 1.7) * 0.3 + Math.cos(a * 2 + seed * 0.4) * 0.5)
    pts.push(`${(cx + r * m * Math.cos(a)).toFixed(1)} ${(cy + r * m * 0.72 * Math.sin(a)).toFixed(1)}`)
  }
  return `M${pts.join(' L')} Z`
}

/** Mirror a path's coordinate pairs in y about 600 (viewBox height). */
export const flipY = (d: string) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_m, x, y) => `${x} ${(600 - Number(y)).toFixed(0)}`)
