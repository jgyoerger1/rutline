/**
 * Blood trail: a map. Stand, hit site, a trail of drops through the timber
 * toward water and thick cover, and the bed at the end of it.
 */
import { useReducedMotion, useTransform, type MotionValue } from 'framer-motion'
import { useRef } from 'react'
import { ArrowHead, At, BONE, BONE_200, BONE_400, BONE_600, BRASS, Cut, EMBER, EMBER_300, GlowDefs, Label, Phase, contour, useCamera, type Camera } from './diagram'
import type { DiagramProps } from './types'
import type { TrailScene } from './bloodTrail'

type Scene = TrailScene | 'intro' | 'outro'

const FULL: Camera = { cx: 520, cy: 320, w: 1000 }
const CAMERAS: Record<Scene, Camera> = {
  intro: FULL,
  shot: { cx: 300, cy: 200, w: 540 },
  hitsite: { cx: 325, cy: 245, w: 320 },
  blood: { cx: 475, cy: 250, w: 470 },
  mark: { cx: 480, cy: 320, w: 560 },
  grid: { cx: 650, cy: 400, w: 500 },
  approach: { cx: 800, cy: 465, w: 470 },
  outro: FULL,
}

const STAND: [number, number] = [150, 120]
const HIT: [number, number] = [300, 232]
const SEEN: [number, number] = [420, 262]
const LAST: [number, number] = [610, 380]
const BED: [number, number] = [815, 468]

const TRAIL = 'M300 232 C 340 238, 390 250, 420 262 C 455 276, 505 318, 540 340 C 568 358, 598 374, 610 380 C 650 398, 705 424, 745 442 C 775 455, 800 462, 815 468'
const TRAIL_TO_LAST = 'M300 232 C 340 238, 390 250, 420 262 C 455 276, 505 318, 540 340 C 568 358, 598 374, 610 380'
const WALK_BESIDE = 'M300 262 C 340 268, 390 280, 420 292 C 455 306, 505 348, 540 370 C 568 388, 598 404, 610 410'
const CREEK = 'M560 600 C 600 540, 680 540, 740 490 C 800 440, 860 400, 1000 330'
const FIELD_EDGE = 'M232 40 C 212 200, 202 380, 222 600'
const THICKET = 'M770 430 C 800 400, 870 405, 900 440 C 930 476, 920 530, 880 548 C 840 566, 780 552, 762 512 C 748 482, 750 452, 770 430 Z'
const DROPS: Array<[number, number]> = [
  [330, 236],
  [372, 249],
  [410, 259],
  [452, 286],
  [486, 310],
  [520, 330],
  [552, 347],
  [586, 366],
  [608, 380],
]
const FLAGS: Array<[number, number]> = [
  [372, 249],
  [452, 286],
  [520, 330],
  [586, 366],
]
const CONTOURS = [
  ...[0, 1, 2, 3].map((k) => contour(360, 180, 150 + k * 60, 2.1 + k * 0.3)),
  ...[0, 1, 2].map((k) => contour(760, 540, 120 + k * 70, 4.4 + k * 0.3)),
]

/** Side-view silhouettes, facing right, feet at y=0. */
const DEER_STAND = 'M6 -14 C 2 -22, 6 -30, 16 -32 C 26 -34, 38 -34, 46 -30 C 52 -34, 56 -42, 62 -44 C 68 -45, 72 -42, 70 -38 C 68 -34, 62 -34, 58 -32 C 54 -26, 50 -22, 46 -18 L 46 0 L 42 0 L 41 -16 L 36 -16 L 34 0 L 30 0 L 31 -15 L 18 -14 L 16 0 L 12 0 L 12 -14 C 9 -14, 7 -14, 6 -14 Z'
const DEER_BED = 'M4 -10 C 2 -20, 12 -26, 24 -26 C 36 -26, 44 -24, 48 -20 C 54 -24, 58 -32, 64 -36 C 68 -38, 72 -34, 70 -30 C 68 -26, 62 -26, 58 -22 C 56 -16, 52 -12, 48 -10 Z'
const ANTLER = 'M62 -44 l -3 -9 m 3 9 l 4 -9'
const DROP = 'M0 -14 C 6 -4, 12 2, 12 8 A 12 12 0 1 1 -12 8 C -12 2, -6 -4, 0 -14 Z'

export default function TrailDiagram({ scene: sceneIn, draw, className = '' }: DiagramProps) {
  const scene = (sceneIn in CAMERAS ? sceneIn : 'intro') as Scene
  const reduced = !!useReducedMotion()
  const svgRef = useRef<SVGSVGElement>(null)
  const mapRef = useRef<SVGGElement>(null)
  const overlayRef = useRef<SVGGElement>(null)
  const labelsRef = useRef<SVGGElement>(null)
  const captionsRef = useRef<SVGGElement>(null)

  useCamera(svgRef, CAMERAS[scene], reduced, [
    { ref: mapRef, stroke: 1.2 },
    { ref: overlayRef, stroke: 2.2 },
    { ref: labelsRef, stroke: 1, font: 11.5 },
    { ref: captionsRef, font: 10 },
  ])

  return (
    <svg ref={svgRef} className={className} viewBox="20 20 1000 600" preserveAspectRatio="xMidYMid meet" aria-hidden>
      <defs>
        <GlowDefs />
        <pattern id="fg-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0 L 0 9" stroke={BONE} strokeOpacity="0.14" strokeWidth="1.2" />
        </pattern>
      </defs>

      {/* ---- the map ---- */}
      <g ref={mapRef} fill="none" stroke={BONE} strokeLinecap="round" strokeLinejoin="round">
        {CONTOURS.map((d, i) => (
          <path key={i} d={d} strokeOpacity={0.07 - (i % 4) * 0.01} />
        ))}
        <path d={FIELD_EDGE} strokeOpacity="0.3" strokeDasharray="6 8" />
        <path d={CREEK} stroke={BONE_400} strokeOpacity="0.16" strokeWidth="14" />
        <path d={CREEK} stroke={BONE_400} strokeOpacity="0.5" />
        <path d={THICKET} fill="url(#fg-hatch)" strokeOpacity="0.35" />
        {/* stand */}
        <g transform={`translate(${STAND[0]} ${STAND[1]})`} stroke={BONE_200} strokeOpacity="0.8">
          <path d="M-8 10 L 0 -12 L 8 10 Z" />
          <path d="M-5 2 L 5 2" />
        </g>
        {/* the trail, faint, with its drops */}
        <path d={TRAIL} strokeOpacity="0.14" strokeDasharray="3 6" />
        {DROPS.map(([x, y], i) => (
          <ellipse key={i} cx={x} cy={y} rx={3.2 - i * 0.18} ry={2.4 - i * 0.14} fill="#8c2b2b" stroke="none" opacity="0.9" />
        ))}
        {/* hit site mark */}
        <circle cx={HIT[0]} cy={HIT[1]} r="4" stroke={BONE_200} strokeOpacity="0.7" />
        {/* bed */}
        <ellipse cx={BED[0] + 30} cy={BED[1] + 2} rx="42" ry="16" strokeOpacity="0.25" strokeDasharray="2 4" />
      </g>

      <g ref={captionsRef} fill={BONE_600} fontFamily="var(--font-mono)" letterSpacing="0.12em" style={{ textTransform: 'uppercase' }}>
        <text x={130} y={150}>Stand</text>
        <text x={100} y={330}>Field</text>
        <text x={880} y={392}>Creek</text>
        <text x={790} y={590}>Thicket</text>
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

function Overlay({ scene, draw }: { scene: Scene; draw: MotionValue<number> }) {
  switch (scene) {
    case 'shot':
      return <Shot p={draw} />
    case 'hitsite':
      return <HitSite p={draw} />
    case 'blood':
      return <Blood p={draw} />
    case 'mark':
      return <Mark p={draw} />
    case 'grid':
      return <Grid p={draw} />
    case 'approach':
      return <Approach p={draw} />
    case 'outro':
      return <Outro p={draw} />
    default:
      return null
  }
}

function Deer({ at, bedded, flip }: { at: [number, number]; bedded?: boolean; flip?: boolean }) {
  return (
    <g transform={`translate(${at[0]} ${at[1]}) ${flip ? 'scale(-1 1)' : ''}`} fill="#2a302c" stroke={BONE_200}>
      <path d={bedded ? DEER_BED : DEER_STAND} />
      <path d={bedded ? 'M64 -36 l -3 -9 m 3 9 l 4 -9' : ANTLER} fill="none" />
    </g>
  )
}

function Shot({ p }: { p: MotionValue<number> }) {
  return (
    <>
      <Cut d={`M${STAND[0] + 6} ${STAND[1] + 8} L ${HIT[0] - 6} ${HIT[1] - 4}`} dash p={p} glow={false} color={BONE_400} />
      <At p={p} from={0.3}>
        <Deer at={[HIT[0] - 34, HIT[1] + 10]} />
      </At>
      <Cut d="M308 226 C 340 196, 380 222, 418 254" p={p} />
      <At p={p} from={0.8}>
        <g stroke={EMBER_300}>
          <ellipse cx={SEEN[0]} cy={SEEN[1]} rx="12" ry="7" />
          <circle cx={SEEN[0]} cy={SEEN[1]} r="2.5" fill={EMBER_300} />
        </g>
      </At>
    </>
  )
}

function HitSite({ p }: { p: MotionValue<number> }) {
  return (
    <>
      <At p={p} from={0.05}>
        <g stroke={BONE} strokeOpacity="0.85">
          <path d="M286 244 l -5 10" />
          <path d="M293 248 l -2 11" />
          <path d="M300 246 l 3 10" />
          <path d="M307 250 l -1 9" />
        </g>
      </At>
      <At p={p} from={0.35}>
        <g transform="translate(326 262) rotate(18)">
          <path d="M0 0 L 56 0" stroke={BONE_200} />
          <path d="M56 0 L 50 -4 L 50 4 Z" fill={BONE_200} stroke="none" />
          <g stroke={EMBER_300}>
            <path d="M2 0 L -4 -6" />
            <path d="M6 0 L 0 -6" />
            <path d="M2 0 L -4 6" />
            <path d="M6 0 L 0 6" />
          </g>
          <ellipse cx="40" cy="4" rx="9" ry="3.5" fill="#8c2b2b" stroke="none" opacity="0.9" />
        </g>
      </At>
    </>
  )
}

const SWATCHES: Array<{ x: number; fill: string; scale: number; kind: 'lung' | 'heart' | 'liver' | 'paunch' }> = [
  { x: 380, fill: '#e2402f', scale: 1, kind: 'lung' },
  { x: 445, fill: '#c9241f', scale: 1.25, kind: 'heart' },
  { x: 510, fill: '#6e1b22', scale: 1, kind: 'liver' },
  { x: 575, fill: '#6c5a2a', scale: 1, kind: 'paunch' },
]

function Blood({ p }: { p: MotionValue<number> }) {
  return (
    <>
      {SWATCHES.map((s, i) => (
        <At key={s.kind} p={p} from={0.08 + i * 0.2}>
          <g transform={`translate(${s.x} 178) scale(${s.scale})`} stroke="none">
            <path d={DROP} fill={s.fill} filter="url(#fg-glow)" />
            {s.kind === 'lung' && (
              <g fill="#fff" opacity="0.6">
                <circle cx="-4" cy="4" r="1.8" />
                <circle cx="3" cy="0" r="1.3" />
                <circle cx="2" cy="9" r="2.2" />
                <circle cx="-5" cy="12" r="1.2" />
              </g>
            )}
            {s.kind === 'heart' && (
              <g fill={s.fill}>
                <circle cx="16" cy="12" r="2.2" />
                <circle cx="-17" cy="8" r="1.6" />
                <circle cx="13" cy="-4" r="1.3" />
              </g>
            )}
            {s.kind === 'paunch' && (
              <g fill="#9a9a3c" opacity="0.9">
                <rect x="-5" y="3" width="3" height="2" />
                <rect x="2" y="8" width="3.5" height="2" />
                <rect x="-1" y="13" width="2.5" height="2" />
              </g>
            )}
          </g>
        </At>
      ))}
    </>
  )
}

function Mark({ p }: { p: MotionValue<number> }) {
  return (
    <>
      <Cut d={TRAIL_TO_LAST} p={p} />
      <Cut d={WALK_BESIDE} dash p={p} glow={false} color={BONE_400} />
      {FLAGS.map(([x, y], i) => (
        <At key={i} p={p} from={0.2 + i * 0.23}>
          <g transform={`translate(${x} ${y - 2})`}>
            <path d="M0 0 L 0 -20" stroke={BONE_200} />
            <path d="M0 -20 L 11 -16 L 0 -12 Z" fill={EMBER} stroke="none" />
          </g>
        </At>
      ))}
    </>
  )
}

function Grid({ p }: { p: MotionValue<number> }) {
  const r1 = useTransform(p, [0.05, 0.3], [0, 1])
  const r2 = useTransform(p, [0.3, 0.55], [0, 1])
  const r3 = useTransform(p, [0.55, 0.8], [0, 1])
  const ring = (r: number) => `M${LAST[0]} ${LAST[1] - r} a ${r} ${r} 0 1 0 0.01 0`
  return (
    <>
      <circle cx={LAST[0]} cy={LAST[1]} r="5" fill={EMBER} stroke="none" />
      <Cut d={ring(38)} dash p={r1} glow={false} color={EMBER_300} />
      <Cut d={ring(76)} dash p={r2} glow={false} color={EMBER_300} />
      <Cut d={ring(114)} dash p={r3} glow={false} color={EMBER_300} />
      <At p={p} from={0.8}>
        <path d="M632 396 L 726 446" />
        <path d="M712 446 L 728 447 L 722 432" />
      </At>
    </>
  )
}

function Approach({ p }: { p: MotionValue<number> }) {
  return (
    <>
      <Deer at={[BED[0] - 20, BED[1] + 10]} bedded flip />
      <Cut d="M940 548 C 905 532, 876 516, 846 494" p={p} />
      <ArrowHead x={844} y={492} p={p} angle={212} />
      <At p={p} from={0.85}>
        <circle cx={BED[0] - 60} cy={BED[1] - 24} r="3" fill={EMBER} stroke="none" filter="url(#fg-glow)" />
      </At>
    </>
  )
}

function Outro({ p }: { p: MotionValue<number> }) {
  return (
    <>
      <Cut d={TRAIL} p={p} />
      {[HIT, LAST, BED].map(([x, y], i) => (
        <At key={i} p={p} from={i * 0.4}>
          <g transform={`translate(${x} ${y})`}>
            <circle r="6" fill={EMBER} stroke="none" />
            <circle r="11" stroke={EMBER} strokeOpacity="0.5" />
          </g>
        </At>
      ))}
    </>
  )
}

function Labels({ scene }: { scene: Scene }) {
  switch (scene) {
    case 'shot':
      return (
        <>
          <Label x={236} y={300} lead={[296, 240]}>
            Hit site
          </Label>
          <Label x={436} y={226} lead={[424, 254]}>
            Last seen
          </Label>
        </>
      )
    case 'hitsite':
      return (
        <>
          <Label x={222} y={206} lead={[288, 242]}>
            Hair · white low, dark high
          </Label>
          <Label x={352} y={310} lead={[352, 276]}>
            Arrow · smell it
          </Label>
        </>
      )
    case 'blood':
      return (
        <>
          <Label x={380} y={226} anchor="middle">
            Lungs
          </Label>
          <Label x={445} y={226} anchor="middle">
            Heart
          </Label>
          <Label x={510} y={226} anchor="middle">
            Liver
          </Label>
          <Label x={575} y={226} anchor="middle">
            Paunch
          </Label>
        </>
      )
    case 'mark':
      return (
        <>
          <Label x={330} y={192} lead={[372, 226]}>
            Flag every drop you confirm
          </Label>
          <Label x={470} y={442} lead={[470, 326]}>
            Walk beside the line
          </Label>
        </>
      )
    case 'grid':
      return (
        <>
          <Label x={548} y={262} lead={[600, 346]}>
            Last blood
          </Label>
          <Label x={700} y={520} lead={[726, 452]}>
            Downhill · water · cover
          </Label>
        </>
      )
    case 'approach':
      return (
        <>
          <Label x={880} y={372} lead={[757, 440]}>
            Watch the eye
          </Label>
          <Label x={870} y={580} lead={[920, 548]}>
            From behind, downwind
          </Label>
        </>
      )
    case 'outro':
      return (
        <Label x={620} y={300} lead={[650, 392]}>
          Hit · last blood · recovery
        </Label>
      )
    default:
      return null
  }
}

/** Static cover for the Field Guide card. */
export function TrailFigure({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="120 90 860 520" preserveAspectRatio="xMidYMid meet" aria-hidden>
      <g fill="none" stroke={BONE} strokeWidth="1.4" strokeLinecap="round">
        {CONTOURS.map((d, i) => (
          <path key={i} d={d} strokeOpacity="0.08" />
        ))}
        <path d={CREEK} stroke={BONE_400} strokeOpacity="0.4" strokeWidth="2" />
        <path d={THICKET} fill="url(#fg-hatch)" strokeOpacity="0.35" />
        <path d={TRAIL} stroke={EMBER} strokeWidth="2.5" className="rut-line" />
        {DROPS.map(([x, y], i) => (
          <ellipse key={i} cx={x} cy={y} rx={4 - i * 0.2} ry={3 - i * 0.15} fill="#9a2f2f" stroke="none" />
        ))}
        <g stroke={BONE_200}>
          <circle cx={HIT[0]} cy={HIT[1]} r="7" />
          <circle cx={BED[0]} cy={BED[1]} r="7" fill={BRASS} stroke="none" />
        </g>
      </g>
    </svg>
  )
}
