/**
 * Scoring: a typical 10-point rack seen from the front, with the Boone and
 * Crockett measurements laid over it one at a time. Right and left are the
 * deer's, so the deer's right antler is on the viewer's left.
 */
import { motion, useReducedMotion, useTransform, type MotionValue } from 'framer-motion'
import { useRef } from 'react'
import { At, BONE, BONE_200, BONE_400, BRASS, Cut, EMBER, EMBER_300, GlowDefs, Label, Phase, cubic, polyPath, quad, tube, useCamera, type Camera, type Pt } from './diagram'
import type { DiagramProps } from './types'
import type { RackScene } from './scoring'

type Scene = RackScene | 'intro' | 'outro'

const FULL: Camera = { cx: 500, cy: 345, w: 760 }
const CAMERAS: Record<Scene, Camera> = {
  intro: FULL,
  prep: FULL,
  points: FULL,
  beams: { cx: 370, cy: 330, w: 470 },
  tines: { cx: 330, cy: 290, w: 380 },
  circs: { cx: 372, cy: 372, w: 480 },
  spread: { cx: 500, cy: 300, w: 700 },
  total: FULL,
  outro: FULL,
}

// ---------- geometry (viewer's left = deer's right) ----------

const CENTER = 500
const mirror = (p: Pt): Pt => [2 * CENTER - p[0], p[1]]

function beamLine(): Pt[] {
  const a = cubic([452, 500], [380, 486], [300, 420], [292, 320], 24)
  const b = cubic([292, 320], [284, 232], [338, 160], [430, 150], 24)
  return [...a, ...b.slice(1)]
}

interface Side {
  line: Pt[]
  body: string
  cap: string
  /** Outer edge polyline (away from the skull) and inner edge */
  outer: Pt[]
  inner: Pt[]
  tines: Array<{ name: string; line: Pt[]; body: string; cap: string; outer: Pt[]; base: Pt; tip: Pt }>
  tip: Pt
}

function at(line: Pt[], f: number): { p: Pt; t: Pt } {
  const i = Math.min(line.length - 2, Math.max(0, Math.round(f * (line.length - 1))))
  const p = line[i]
  const q = line[i + 1]
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1
  return { p, t: [(q[0] - p[0]) / len, (q[1] - p[1]) / len] }
}

function buildSide(left: boolean, lens: number[]): Side {
  const raw = beamLine()
  const line = left ? raw : raw.map(mirror)
  const tb = tube(line, 24, 11)
  const avg = (pts: Pt[]) => pts.reduce((s, p) => s + p[0], 0) / pts.length
  const outer = left ? (avg(tb.left) < avg(tb.right) ? tb.left : tb.right) : avg(tb.left) > avg(tb.right) ? tb.left : tb.right
  const inner = outer === tb.left ? tb.right : tb.left
  const fr = [0.15, 0.4, 0.6, 0.78]
  const dirs: Pt[] = [
    [0.45, -1],
    [0.18, -1],
    [0.12, -1],
    [0.08, -1],
  ]
  const toward = left ? 1 : -1
  const tines = fr.map((f, i) => {
    const { p } = at(line, f)
    const d = dirs[i]
    const n = Math.hypot(d[0], d[1])
    const dir: Pt = [(d[0] * toward) / n, d[1] / n]
    const L = lens[i]
    const tip: Pt = [p[0] + dir[0] * L, p[1] + dir[1] * L]
    const bow: Pt = [p[0] + dir[0] * L * 0.5 - toward * 14, p[1] + dir[1] * L * 0.5]
    const tl = quad(p, bow, tip, 12)
    const tt = tube(tl, 15, 5)
    const tOuter = left ? (avg(tt.left) < avg(tt.right) ? tt.left : tt.right) : avg(tt.left) > avg(tt.right) ? tt.left : tt.right
    return { name: `G${i + 1}`, line: tl, body: tt.body, cap: tt.cap, outer: tOuter, base: p, tip }
  })
  return { line, body: tb.body, cap: tb.cap, outer, inner, tines, tip: line[line.length - 1] }
}

// Deer's right = viewer's left. Lengths in user units (about 18.7 per inch).
const RIGHT = buildSide(true, [89, 168, 164, 80])
const LEFT = buildSide(false, [98, 178, 154, 89])

// Abnormal sticker off the (deer's) right G2, pointing outward
const STICKER = (() => {
  const t = RIGHT.tines[1]
  const i = Math.round(t.line.length * 0.55)
  const base = t.line[i]
  const tip: Pt = [base[0] - 24, base[1] - 14]
  const l = quad(base, [base[0] - 10, base[1] - 10], tip, 6)
  return { ...tube(l, 8, 3), base, tip }
})()

// Circumference loops: fraction along the beam, between tines
const LOOP_F = [0.07, 0.27, 0.5, 0.69]

// Inside spread: widest gap between inner edges
const SPREAD = (() => {
  let best = RIGHT.inner[0]
  for (const p of RIGHT.inner) if (p[0] < best[0]) best = p
  return { y: best[1], x1: best[0], x2: 2 * CENTER - best[0] }
})()

const FACE = 'M440 505 C 470 522, 530 522, 560 505 C 574 540, 568 582, 548 606 L 452 606 C 432 582, 426 540, 440 505 Z'
const EAR_R = 'M436 522 C 402 500, 358 506, 348 532 C 370 550, 410 550, 438 538 Z'
const EAR_L = 'M564 522 C 598 500, 642 506, 652 532 C 630 550, 590 550, 562 538 Z'

export default function RackDiagram({ scene: sceneIn, draw, className = '' }: DiagramProps) {
  const scene = (sceneIn in CAMERAS ? sceneIn : 'intro') as Scene
  const reduced = !!useReducedMotion()
  const svgRef = useRef<SVGSVGElement>(null)
  const rackRef = useRef<SVGGElement>(null)
  const overlayRef = useRef<SVGGElement>(null)
  const labelsRef = useRef<SVGGElement>(null)

  useCamera(svgRef, CAMERAS[scene], reduced, [
    { ref: rackRef, stroke: 1.4 },
    { ref: overlayRef, stroke: 2.2 },
    { ref: labelsRef, stroke: 1, font: 11.5 },
  ])

  return (
    <svg ref={svgRef} className={className} viewBox="120 117 760 456" preserveAspectRatio="xMidYMid meet" aria-hidden>
      <defs>
        <GlowDefs />
        <linearGradient id="fg-antler" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a3f3a" />
          <stop offset="100%" stopColor="#262b28" />
        </linearGradient>
      </defs>

      <g ref={rackRef} stroke={BONE_200} strokeOpacity="0.85" strokeLinejoin="round" strokeLinecap="round" fill="url(#fg-antler)">
        <Rack reduced={reduced} />
      </g>

      <g ref={overlayRef} fill="none" stroke={EMBER} strokeLinecap="round" strokeLinejoin="round">
        <Phase id={scene} reduced={reduced}>
          <Overlay scene={scene} draw={draw} />
        </Phase>
      </g>

      <g ref={labelsRef} fill={BONE_400} stroke="none" fontFamily="var(--font-mono)" letterSpacing="0.08em" style={{ textTransform: 'uppercase' }}>
        <Phase id={scene} reduced={reduced} delay={0.35}>
          <Labels scene={scene} />
        </Phase>
      </g>
    </svg>
  )
}

function Rack({ reduced }: { reduced: boolean }) {
  const grow = (delay: number) => (reduced ? {} : { initial: { pathLength: 0, fillOpacity: 0 }, animate: { pathLength: 1, fillOpacity: 1 }, transition: { pathLength: { duration: 1.4, ease: [0.23, 1, 0.32, 1] as [number, number, number, number], delay }, fillOpacity: { duration: 0.8, delay: delay + 0.6 } } })
  return (
    <>
      <motion.path d={EAR_R} fill="#202622" {...grow(0.1)} />
      <motion.path d={EAR_L} fill="#202622" {...grow(0.1)} />
      <motion.path d={FACE} fill="#1d221f" {...grow(0)} />
      <g fill="#0f1110" stroke="none">
        <ellipse cx="474" cy="556" rx="7" ry="5" />
        <ellipse cx="526" cy="556" rx="7" ry="5" />
        <circle cx="476" cy="555" r="1.6" fill={BONE} />
        <circle cx="528" cy="555" r="1.6" fill={BONE} />
      </g>
      {[RIGHT, LEFT].map((s, si) => (
        <g key={si}>
          {s.tines.map((t, i) => (
            <g key={t.name}>
              <motion.path d={t.body} {...grow(0.5 + i * 0.12)} />
              <motion.path d={t.cap} fill="#4a4f49" stroke="none" {...grow(0.9 + i * 0.12)} />
            </g>
          ))}
          <motion.path d={s.body} {...grow(0.2)} />
          <motion.path d={s.cap} fill="#4a4f49" stroke="none" {...grow(0.9)} />
          <ellipse cx={s.line[0][0]} cy={s.line[0][1]} rx="16" ry="8" fill="#2d322e" />
        </g>
      ))}
      <motion.path d={STICKER.body} {...grow(1.0)} />
    </>
  )
}

function Overlay({ scene, draw }: { scene: Scene; draw: MotionValue<number> }) {
  switch (scene) {
    case 'prep':
      return <Prep p={draw} />
    case 'points':
      return <Points p={draw} />
    case 'beams':
      return <Beams p={draw} />
    case 'tines':
      return <Tines p={draw} />
    case 'circs':
      return <Circs p={draw} />
    case 'spread':
      return <Spread p={draw} />
    case 'total':
    case 'outro':
      return <Total p={draw} />
    default:
      return null
  }
}

function Prep({ p }: { p: MotionValue<number> }) {
  const ticks = Array.from({ length: 25 }, (_, i) => 350 + i * 12.5)
  return (
    <>
      <Cut d="M350 150 L 650 150" p={p} glow={false} color={BONE_200} />
      {ticks.map((x, i) => (
        <At key={x} p={p} from={i / 26}>
          <path d={`M${x} 150 L ${x} ${i % 8 === 0 ? 136 : i % 4 === 0 ? 141 : 145}`} stroke={i % 8 === 0 ? EMBER : BONE_400} />
        </At>
      ))}
    </>
  )
}

function Points({ p }: { p: MotionValue<number> }) {
  const tips: Array<{ at: Pt; i: number; abnormal?: boolean }> = [
    ...RIGHT.tines.map((t, i) => ({ at: t.tip, i })),
    { at: RIGHT.tip, i: 4 },
    ...LEFT.tines.map((t, i) => ({ at: t.tip, i: i + 5 })),
    { at: LEFT.tip, i: 9 },
    { at: STICKER.tip, i: 10, abnormal: true },
  ]
  return (
    <>
      {tips.map((t) => (
        <At key={t.i} p={p} from={0.04 + t.i * 0.085}>
          <circle cx={t.at[0]} cy={t.at[1]} r="6" fill={t.abnormal ? 'none' : EMBER} stroke={t.abnormal ? EMBER_300 : 'none'} strokeDasharray={t.abnormal ? '3 3' : undefined} filter="url(#fg-glow)" />
        </At>
      ))}
    </>
  )
}

function Beams({ p }: { p: MotionValue<number> }) {
  return (
    <>
      <At p={p} from={0.02}>
        <ellipse cx={RIGHT.line[0][0]} cy={RIGHT.line[0][1]} rx="19" ry="10" stroke={EMBER_300} />
      </At>
      <Cut d={polyPath(RIGHT.outer)} p={p} />
    </>
  )
}

function Tines({ p }: { p: MotionValue<number> }) {
  const t = RIGHT.tines[1]
  const b = t.base
  // Baseline across the tine's base, along the beam's outer edge
  const { t: tan } = at(RIGHT.line, 0.4)
  const base = `M${b[0] - tan[0] * 26 + 4} ${b[1] - tan[1] * 26 - 9} L ${b[0] + tan[0] * 26 + 4} ${b[1] + tan[1] * 26 - 9}`
  return (
    <>
      <At p={p} from={0.02}>
        <path d={base} stroke={BRASS} strokeDasharray="4 4" />
      </At>
      <Cut d={polyPath(t.outer)} p={p} />
      <At p={p} from={0.9}>
        <circle cx={t.tip[0]} cy={t.tip[1]} r="5" fill={EMBER} stroke="none" />
      </At>
    </>
  )
}

function Circs({ p }: { p: MotionValue<number> }) {
  const segs = [useTransform(p, [0.02, 0.26], [0, 1]), useTransform(p, [0.26, 0.5], [0, 1]), useTransform(p, [0.5, 0.74], [0, 1]), useTransform(p, [0.74, 0.98], [0, 1])]
  return (
    <>
      {LOOP_F.map((f, i) => {
        const { p: c, t } = at(RIGHT.line, f)
        const ang = (Math.atan2(t[1], t[0]) * 180) / Math.PI
        const rx = 8 + (1 - f) * 6
        const ry = 15 - f * 5
        const d = `M${c[0]} ${c[1] - ry} a ${rx} ${ry} 0 1 0 0.01 0`
        return (
          <g key={f} transform={`rotate(${ang} ${c[0]} ${c[1]})`}>
            <Cut d={d} p={segs[i]} />
          </g>
        )
      })}
    </>
  )
}

function Spread({ p }: { p: MotionValue<number> }) {
  return (
    <>
      <path d={`M${CENTER} 150 L ${CENTER} 520`} stroke={BONE_400} strokeOpacity="0.5" strokeDasharray="4 6" />
      <Cut d={`M${SPREAD.x1} ${SPREAD.y} L ${SPREAD.x2} ${SPREAD.y}`} p={p} />
      <At p={p} from={0.9}>
        <path d={`M${SPREAD.x1} ${SPREAD.y - 10} L ${SPREAD.x1} ${SPREAD.y + 10}`} />
        <path d={`M${SPREAD.x2} ${SPREAD.y - 10} L ${SPREAD.x2} ${SPREAD.y + 10}`} />
      </At>
    </>
  )
}

function Total({ p }: { p: MotionValue<number> }) {
  const o = useTransform(p, [0, 0.6], [0, 0.55])
  return (
    <motion.g style={{ opacity: o }} stroke={EMBER_300}>
      {[RIGHT, LEFT].map((s, si) => (
        <g key={si}>
          <path d={polyPath(s.outer)} />
          {s.tines.map((t) => (
            <path key={t.name} d={polyPath(t.outer)} />
          ))}
        </g>
      ))}
      <path d={`M${SPREAD.x1} ${SPREAD.y} L ${SPREAD.x2} ${SPREAD.y}`} strokeDasharray="4 6" />
    </motion.g>
  )
}

function Labels({ scene }: { scene: Scene }) {
  switch (scene) {
    case 'prep':
      return (
        <Label x={500} y={186} anchor="middle">
          Nearest 1/8 inch · flexible steel tape
        </Label>
      )
    case 'points': {
      const r = RIGHT.tines
      return (
        <>
          <Label x={r[0].tip[0] - 70} y={r[0].tip[1] + 2}>
            G1 brow
          </Label>
          <Label x={r[1].tip[0] - 40} y={r[1].tip[1] - 12}>
            G2
          </Label>
          <Label x={r[2].tip[0] - 40} y={r[2].tip[1] - 12}>
            G3
          </Label>
          <Label x={r[3].tip[0] - 40} y={r[3].tip[1] - 12}>
            G4
          </Label>
          <Label x={500} y={136} anchor="middle">
            Beam tip · a point, not a tine
          </Label>
          <Label x={STICKER.tip[0] - 150} y={STICKER.tip[1] + 30} lead={[STICKER.tip[0] - 6, STICKER.tip[1] + 4]}>
            Abnormal · deducted
          </Label>
        </>
      )
    }
    case 'beams':
      return (
        <>
          <Label x={160} y={420} lead={[RIGHT.outer[8][0] - 4, RIGHT.outer[8][1]]}>
            F · burr to tip, outside curve
          </Label>
          <Label x={440} y={150} anchor="start">
            Right beam · 23 6/8
          </Label>
        </>
      )
    case 'tines':
      return (
        <>
          <Label x={200} y={200} lead={[RIGHT.tines[1].tip[0] - 8, RIGHT.tines[1].tip[1] + 6]}>
            Right G2 · 9 0/8
          </Label>
          <Label x={360} y={400} lead={[RIGHT.tines[1].base[0] + 20, RIGHT.tines[1].base[1] - 2]}>
            Baseline on the beam's top edge
          </Label>
        </>
      )
    case 'circs': {
      const pts = LOOP_F.map((f) => at(RIGHT.line, f).p)
      return (
        <>
          <Label x={pts[0][0] + 30} y={pts[0][1] + 36} lead={[pts[0][0] + 12, pts[0][1] + 8]}>
            H1 · 4 4/8
          </Label>
          <Label x={pts[1][0] - 110} y={pts[1][1] + 40} lead={[pts[1][0] - 12, pts[1][1] + 6]}>
            H2 · 4 4/8
          </Label>
          <Label x={pts[2][0] - 120} y={pts[2][1] - 10} lead={[pts[2][0] - 14, pts[2][1]]}>
            H3 · 4 2/8
          </Label>
          <Label x={pts[3][0] - 120} y={pts[3][1] - 40} lead={[pts[3][0] - 12, pts[3][1] - 4]}>
            H4 · 3 4/8
          </Label>
        </>
      )
    }
    case 'spread':
      return (
        <>
          <Label x={500} y={SPREAD.y - 18} anchor="middle">
            Inside spread · 17 4/8
          </Label>
          <Label x={500} y={540} anchor="middle" dim>
            Right angles to the skull
          </Label>
        </>
      )
    case 'total':
    case 'outro':
      return (
        <g fontSize="0.82em">
          <Label x={500} y={126} anchor="middle">
            L 68 4/8 · R 67 2/8 · spread 17 4/8 · abnormal 1 4/8
          </Label>
          <Label x={500} y={141} anchor="middle">
            Gross 154 6/8 · net 150 0/8
          </Label>
        </g>
      )
    default:
      return null
  }
}

/** Static cover for the Field Guide card. */
export function RackFigure({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="200 120 600 420" preserveAspectRatio="xMidYMid meet" aria-hidden>
      <g stroke={BONE_200} strokeOpacity="0.8" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" fill="#2a2f2b">
        <path d={EAR_R} fill="#202622" />
        <path d={EAR_L} fill="#202622" />
        <path d={FACE} fill="#1d221f" />
        {[RIGHT, LEFT].map((s, si) => (
          <g key={si}>
            {s.tines.map((t) => (
              <path key={t.name} d={t.body} />
            ))}
            <path d={s.body} />
          </g>
        ))}
        <path d={STICKER.body} />
      </g>
      <path d={`M${SPREAD.x1} ${SPREAD.y} L ${SPREAD.x2} ${SPREAD.y}`} stroke={EMBER} strokeWidth="3" strokeLinecap="round" fill="none" className="rut-line" />
    </svg>
  )
}
