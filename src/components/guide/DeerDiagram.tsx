/**
 * Field dressing: a whitetail on its back, head to the left, seen from below.
 * One ember overlay per step whose cut line draws with scroll progress.
 */
import { motion, useReducedMotion, useTransform, type MotionValue } from 'framer-motion'
import { memo, useRef } from 'react'
import { ArrowHead, BONE, BONE_400, BONE_600, BRASS, Cut, EASE_OUT, EMBER, EMBER_300, GlowDefs, HIDE, HIDE_EDGE, Label, Phase, flipY, quad, tube, useCamera, type Camera } from './diagram'
import type { DiagramProps } from './types'
import type { IllustrationKey } from './fieldDressing'

type Scene = IllustrationKey | 'intro' | 'outro'

const FULL: Camera = { cx: 430, cy: 300, w: 860 }

const CAMERAS: Record<Scene, Camera> = {
  intro: FULL,
  position: FULL,
  anus: { cx: 715, cy: 300, w: 400 },
  belly: { cx: 560, cy: 300, w: 600 },
  chest: { cx: 395, cy: 300, w: 520 },
  windpipe: { cx: 225, cy: 300, w: 480 },
  diaphragm: { cx: 470, cy: 300, w: 520 },
  pull: { cx: 540, cy: 300, w: 820 },
  organs: { cx: 450, cy: 305, w: 400 },
  cool: FULL,
  outro: FULL,
}

// ---------- geometry ----------

const LEGS = [
  tube(quad([352, 232], [292, 122], [346, 42]), 36, 17),
  tube(quad([352, 368], [292, 478], [346, 558]), 36, 17),
  tube(quad([648, 230], [716, 118], [668, 42]), 38, 17),
  tube(quad([648, 370], [716, 482], [668, 558]), 38, 17),
]

const BODY = 'M300 214 C 332 190, 418 192, 470 206 C 522 219, 600 212, 660 214 C 712 216, 742 252, 742 300 C 742 348, 712 384, 660 386 C 600 388, 522 381, 470 394 C 418 408, 332 410, 300 386 C 284 372, 278 332, 280 300 C 278 268, 284 228, 300 214 Z'
const NECK = 'M302 256 C 254 250, 212 258, 176 270 L 176 330 C 212 342, 254 350, 302 344 Z'
const HEAD = 'M184 262 C 148 248, 96 266, 72 300 C 96 334, 148 352, 184 338 Z'
const EAR_T = 'M172 262 C 164 236, 182 212, 200 220 C 206 240, 194 258, 182 268 Z'
const EAR_B = 'M172 338 C 164 364, 182 388, 200 380 C 206 360, 194 342, 182 332 Z'
const ANTLER_T = ['M196 250 C 202 214, 186 182, 214 150 C 238 124, 276 128, 292 148', 'M206 206 C 216 190, 236 184, 252 190', 'M223 170 C 240 160, 256 162, 270 174', 'M199 236 C 212 226, 226 228, 234 238']
const ANTLER_B = ANTLER_T.map(flipY)
const TAIL = 'M740 288 C 762 282, 778 292, 782 300 C 778 308, 762 318, 740 312 Z'

const RIBS_T = [0, 1, 2, 3, 4, 5, 6].map((i) => {
  const x = 318 + i * 23
  return `M${x} 300 C ${x - 8} 272, ${x - 2} 236, ${x + 20} 214`
})
const RIBS_B = RIBS_T.map(flipY)
const STERNUM = 'M302 300 L 472 300'
const DIAPHRAGM = 'M480 216 C 446 258, 446 342, 480 384'
const PAUNCH = 'M504 240 C 560 220, 640 232, 668 270 C 688 300, 680 350, 640 372 C 592 392, 522 382, 502 350 C 486 320, 486 270, 504 240 Z'
const GUT_SQUIGGLE = ['M530 262 c 14 -8, 26 6, 40 -2 s 26 8, 40 0', 'M524 300 c 16 -10, 30 8, 46 -2 s 30 10, 48 0', 'M532 338 c 14 -8, 26 6, 40 -2 s 26 8, 40 0']
const PELVIS = 'M690 260 C 716 266, 716 334, 690 340'
const HEART = 'M405 322 C 378 302, 376 274, 392 270 C 400 268, 405 278, 405 284 C 405 278, 410 268, 418 270 C 434 274, 432 302, 405 322 Z'
const LIVER = 'M486 298 C 512 294, 538 310, 534 338 C 530 362, 500 374, 482 358 C 466 342, 468 318, 486 298 Z'
const WINDPIPE = ['M296 292 L 100 292', 'M296 308 L 100 308']
const GULLET = 'M296 318 C 240 322, 170 320, 104 318'
const TRACHEA_RINGS = Array.from({ length: 15 }, (_, i) => 112 + i * 12.5)
const MASS = 'M322 262 C 360 236, 430 226, 476 240 C 520 226, 610 228, 664 268 C 686 300, 680 348, 640 370 C 590 392, 520 384, 476 362 C 430 376, 360 364, 322 338 C 306 320, 306 280, 322 262 Z'

// ---------- component ----------

export default function DeerDiagram({ scene: sceneIn, draw, className = '' }: DiagramProps) {
  const scene = (sceneIn in CAMERAS ? sceneIn : 'intro') as Scene
  const reduced = !!useReducedMotion()
  const svgRef = useRef<SVGSVGElement>(null)
  const bodyRef = useRef<SVGGElement>(null)
  const anatomyRef = useRef<SVGGElement>(null)
  const overlayRef = useRef<SVGGElement>(null)
  const labelsRef = useRef<SVGGElement>(null)

  useCamera(svgRef, CAMERAS[scene], reduced, [
    { ref: bodyRef, stroke: 1.5 },
    { ref: anatomyRef, stroke: 1.1 },
    { ref: overlayRef, stroke: 2.4 },
    { ref: labelsRef, stroke: 1, font: 11.5 },
  ])

  const tilt = scene === 'pull'
  const spread = ['chest', 'windpipe', 'diaphragm', 'pull', 'organs', 'cool', 'outro'].includes(scene)
  const opened = scene !== 'intro' && scene !== 'position' && scene !== 'anus'

  return (
    <svg ref={svgRef} className={className} viewBox="0 0 860 516" preserveAspectRatio="xMidYMid meet" aria-hidden data-tilt={tilt ? 1 : 0} data-spread={spread ? 1 : 0} data-open={opened ? 1 : 0}>
      <defs>
        <GlowDefs />
        <radialGradient id="fg-hide" cx="42%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#262c28" />
          <stop offset="100%" stopColor={HIDE} />
        </radialGradient>
      </defs>

      <g className="fg-scene">
        <g ref={bodyRef} stroke={HIDE_EDGE} strokeOpacity="0.85" strokeLinejoin="round" strokeLinecap="round" fill="url(#fg-hide)">
          <Figure reduced={reduced} />
        </g>

        <g ref={anatomyRef} className="fg-anatomy" fill="none" stroke={BONE} strokeLinecap="round" strokeLinejoin="round">
          <path d={STERNUM} strokeOpacity="0.32" />
          <g className="fg-ribs fg-ribs-top" strokeOpacity="0.2">
            {RIBS_T.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
          <g className="fg-ribs fg-ribs-bot" strokeOpacity="0.2">
            {RIBS_B.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
          <path d={DIAPHRAGM} strokeOpacity="0.28" />
          <path d={PAUNCH} strokeOpacity="0.16" />
          {GUT_SQUIGGLE.map((d) => (
            <path key={d} d={d} strokeOpacity="0.12" />
          ))}
          <path d={PELVIS} strokeOpacity="0.3" />
          <path d={HEART} strokeOpacity="0.22" />
          <path d={LIVER} strokeOpacity="0.2" />
          <g strokeOpacity="0.22">
            {WINDPIPE.map((d) => (
              <path key={d} d={d} />
            ))}
            {TRACHEA_RINGS.map((x) => (
              <path key={x} d={`M${x} 293 L ${x} 307`} />
            ))}
          </g>
          <path d={GULLET} strokeOpacity="0.16" />
          <circle cx="722" cy="300" r="5" strokeOpacity="0.35" />
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
      </g>
    </svg>
  )
}

/** The silhouette. Draws itself in on first mount, then stays. */
const Figure = memo(function Figure({ reduced }: { reduced: boolean }) {
  const line = (delay: number) => (reduced ? {} : { initial: { pathLength: 0, fillOpacity: 0 }, animate: { pathLength: 1, fillOpacity: 1 }, transition: { pathLength: { duration: 1.5, ease: EASE_OUT, delay }, fillOpacity: { duration: 0.9, delay: delay + 0.7 } } })
  const stroke = (delay: number) => (reduced ? {} : { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration: 1.2, ease: EASE_OUT, delay } })
  return (
    <>
      {LEGS.map((l, i) => (
        <g key={i}>
          <motion.path d={l.body} {...line(0.25 + i * 0.08)} />
          <motion.path d={l.cap} fill="#3a403b" stroke="none" {...line(0.9 + i * 0.08)} />
        </g>
      ))}
      <motion.path d={TAIL} {...line(0.6)} />
      <motion.path d={NECK} {...line(0.15)} />
      <motion.path d={EAR_T} {...line(0.5)} />
      <motion.path d={EAR_B} {...line(0.5)} />
      <motion.path d={HEAD} {...line(0.2)} />
      <motion.path d={BODY} {...line(0)} />
      <g fill="none" stroke={BONE_400} strokeOpacity="0.9">
        {ANTLER_T.map((d, i) => (
          <motion.path key={d} d={d} {...stroke(0.7 + i * 0.1)} />
        ))}
        {ANTLER_B.map((d, i) => (
          <motion.path key={d} d={d} {...stroke(0.7 + i * 0.1)} />
        ))}
      </g>
    </>
  )
})

function Overlay({ scene, draw }: { scene: Scene; draw: MotionValue<number> }) {
  const knifeX = useTransform(draw, [0, 1], [470, 690])
  const massX = useTransform(draw, [0, 1], [0, 250])
  const massO = useTransform(draw, [0, 1], [0.95, 0.35])
  const liftY = useTransform(draw, [0, 1], [0, -16])
  const tieO = useTransform(draw, [0.7, 1], [0, 1])
  const late = useTransform(draw, [0.55, 1], [0, 1])

  switch (scene) {
    case 'position':
      return (
        <>
          <Cut d="M268 172 C 262 150, 246 142, 234 124" dash p={draw} glow={false} color={BRASS} />
          <motion.g style={{ opacity: late }} stroke={BRASS} transform="rotate(-22 222 108)">
            <rect x="196" y="94" width="52" height="30" rx="5" />
            <circle cx="238" cy="109" r="3.5" />
          </motion.g>
          <Cut d="M160 440 L 50 440" p={draw} />
          <ArrowHead x={48} y={440} dir={-1} p={draw} />
        </>
      )
    case 'anus':
      return (
        <>
          <Cut d="M722 266 a 34 34 0 1 0 0.01 0" dash p={draw} />
          <motion.g style={{ opacity: tieO }} stroke={EMBER_300}>
            <circle cx="722" cy="300" r="11" />
            <path d="M733 300 L 752 292" />
          </motion.g>
        </>
      )
    case 'belly':
      return (
        <>
          <Cut d="M470 300 L 690 300" p={draw} />
          <Knife x={knifeX} y={300} />
        </>
      )
    case 'chest':
      return (
        <>
          <Cut d="M470 300 L 300 300" p={draw} />
          <motion.g style={{ opacity: late }} stroke={EMBER_300} strokeOpacity="0.7">
            <path d="M372 262 L 372 232" />
            <path d="M366 238 L 372 230 L 378 238" />
            <path d="M372 338 L 372 368" />
            <path d="M366 362 L 372 370 L 378 362" />
          </motion.g>
        </>
      )
    case 'windpipe':
      return (
        <>
          <g stroke={EMBER_300} strokeOpacity="0.6">
            {WINDPIPE.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
          <Cut d="M158 280 L 158 322" p={draw} />
          <motion.g style={{ opacity: late }}>
            <path d="M168 300 L 250 300" />
            <path d="M238 292 L 252 300 L 238 308" />
          </motion.g>
        </>
      )
    case 'diaphragm':
      return (
        <>
          <Cut d="M484 212 C 446 256, 446 344, 484 388" p={draw} />
          <motion.g style={{ opacity: late }} stroke={EMBER_300} strokeOpacity="0.55">
            <path d="M470 236 L 456 246" />
            <path d="M462 300 L 446 300" />
            <path d="M470 364 L 456 354" />
          </motion.g>
        </>
      )
    case 'pull':
      return (
        <>
          <motion.path d={MASS} fill={EMBER} fillOpacity="0.12" stroke={EMBER_300} strokeOpacity="0.75" style={{ x: massX, opacity: massO }} />
          <Cut d="M330 300 L 780 300" p={draw} />
          <ArrowHead x={784} y={300} p={draw} size={14} />
        </>
      )
    case 'organs':
      return (
        <motion.g style={{ y: liftY }}>
          <Cut d={HEART} p={draw} />
          <Cut d={LIVER} p={draw} />
        </motion.g>
      )
    case 'cool':
    case 'outro':
      return (
        <>
          <Cut d="M420 186 L 468 414" p={draw} glow={false} color={BRASS} />
          <g strokeOpacity="0.55" stroke={EMBER_300}>
            <Cut d="M330 262 c 24 -10, 44 10, 68 0 s 44 10, 68 0 s 44 10, 68 0 s 44 10, 68 0" p={draw} glow={false} color={EMBER_300} />
            <Cut d="M322 300 c 24 -10, 44 10, 68 0 s 44 10, 68 0 s 44 10, 68 0 s 44 10, 68 0 s 44 10, 68 0" p={draw} glow={false} color={EMBER_300} />
            <Cut d="M330 338 c 24 -10, 44 10, 68 0 s 44 10, 68 0 s 44 10, 68 0 s 44 10, 68 0" p={draw} glow={false} color={EMBER_300} />
          </g>
        </>
      )
    default:
      return null
  }
}

/** Drop-point knife, tip leading, with two fingers in a V ahead of it. */
function Knife({ x, y }: { x: MotionValue<number>; y: number }) {
  return (
    <motion.g style={{ x, y }} filter="url(#fg-glow)">
      <path d="M0 0 C -12 -7, -28 -9, -44 -9 L -44 9 C -28 8, -12 5, 0 0 Z" fill="#2a302c" stroke={BONE} />
      <path d="M-2 -1 C -14 -6, -28 -8, -42 -8" stroke={EMBER_300} />
      <rect x="-76" y="-7" width="32" height="14" rx="4" fill="#3a403b" stroke={BONE_600} />
      <g stroke={BONE} strokeOpacity="0.9">
        <path d="M8 -5 L 30 -17" />
        <path d="M8 5 L 30 17" />
      </g>
    </motion.g>
  )
}

function Labels({ scene }: { scene: Scene }) {
  switch (scene) {
    case 'position':
      return (
        <>
          <Label x={262} y={100}>
            Tag first
          </Label>
          <Label x={58} y={472}>
            Head uphill
          </Label>
        </>
      )
    case 'anus':
      return (
        <>
          <Label x={540} y={212} lead={[700, 270]}>
            Circle · 4–6 in deep
          </Label>
          <Label x={762} y={398} lead={[736, 314]}>
            Tie it off
          </Label>
        </>
      )
    case 'belly':
      return (
        <>
          <Label x={360} y={172} lead={[472, 292]}>
            Nick at the breastbone
          </Label>
          <Label x={560} y={452} lead={[600, 320]}>
            Edge up · fingers in a V
          </Label>
        </>
      )
    case 'chest':
      return (
        <>
          <Label x={236} y={182} lead={[380, 292]}>
            Split the breastbone
          </Label>
          <Label x={400} y={424} lead={[376, 372]}>
            Spread the ribs
          </Label>
        </>
      )
    case 'windpipe':
      return (
        <>
          <Label x={36} y={198} lead={[156, 282]}>
            Cut as high as you can reach
          </Label>
          <Label x={330} y={402} anchor="end" lead={[240, 314]}>
            Pull it down toward you
          </Label>
        </>
      )
    case 'diaphragm':
      return (
        <>
          <Label x={326} y={184} lead={[466, 236]}>
            Follow the ribs
          </Label>
          <Label x={380} y={432} lead={[462, 378]}>
            Both sides
          </Label>
        </>
      )
    case 'pull':
      return (
        <Label x={520} y={140} lead={[640, 296]}>
          Steady pull toward the tail
        </Label>
      )
    case 'organs':
      return (
        <>
          <Label x={328} y={232} lead={[396, 278]}>
            Heart
          </Label>
          <Label x={560} y={394} lead={[528, 352]}>
            Liver
          </Label>
        </>
      )
    case 'cool':
    case 'outro':
      return (
        <>
          <Label x={470} y={150} lead={[436, 212]}>
            Prop it open
          </Label>
          <Label x={740} y={454} anchor="end" lead={[640, 352]}>
            Air through · under 50°F
          </Label>
        </>
      )
    default:
      return null
  }
}

/** Static figure for cards and covers. */
export function DeerFigure({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="40 20 920 560" preserveAspectRatio="xMidYMid meet" aria-hidden>
      <g stroke={HIDE_EDGE} strokeOpacity="0.7" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" fill="#1b201d">
        {LEGS.map((l, i) => (
          <g key={i}>
            <path d={l.body} />
            <path d={l.cap} fill="#3a403b" stroke="none" />
          </g>
        ))}
        <path d={TAIL} />
        <path d={NECK} />
        <path d={EAR_T} />
        <path d={EAR_B} />
        <path d={HEAD} />
        <path d={BODY} />
        <g fill="none" stroke={BONE_400} strokeOpacity="0.9">
          {ANTLER_T.map((d) => (
            <path key={d} d={d} />
          ))}
          {ANTLER_B.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </g>
      <path d="M470 300 L 690 300" stroke={EMBER} strokeWidth="3" strokeLinecap="round" fill="none" className="rut-line" />
    </svg>
  )
}
