import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform, type Transition } from 'framer-motion'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

export const SPRING: Transition = { type: 'spring', stiffness: 100, damping: 20 }
export const SPRING_SNAPPY: Transition = { type: 'spring', stiffness: 220, damping: 26 }

/** Number that rolls to its value. Re-rolls (shorter) when the value changes. */
export function CountUp({ value, decimals = 0, prefix = '', suffix = '', className = '', duration = 1.1 }: { value: number; decimals?: number; prefix?: string; suffix?: string; className?: string; duration?: number }) {
  const reduced = useReducedMotion()
  const mv = useMotionValue(reduced ? value : 0)
  const text = useTransform(mv, (v) => `${prefix}${v.toFixed(decimals)}${suffix}`)
  const first = useRef(true)
  useEffect(() => {
    if (reduced) {
      mv.set(value)
      return
    }
    const controls = animate(mv, value, { duration: first.current ? duration : 0.55, ease: [0.16, 1, 0.3, 1] })
    first.current = false
    return () => controls.stop()
  }, [value, mv, duration, reduced])
  return <motion.span className={className}>{text}</motion.span>
}

/** Fade-and-rise wrapper for a whole view. Key it by the view id. */
export function PageTransition({ children, id }: { children: ReactNode; id: string }) {
  return (
    <motion.div key={id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 170, damping: 24 }} className="min-h-full">
      {children}
    </motion.div>
  )
}

/** Rise into place the first time a section scrolls into view. */
export function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '0px 0px -60px 0px' }} transition={{ type: 'spring', stiffness: 140, damping: 22, delay }}>
      {children}
    </motion.div>
  )
}

/** Words of a heading rising one after another. */
export function StaggerText({ text, className = '', delay = 0 }: { text: string; className?: string; delay?: number }) {
  const words = text.split(' ')
  return (
    <span className={className} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom">
          <motion.span className="inline-block" initial={{ y: '110%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 22, delay: delay + i * 0.07 }} aria-hidden>
            {w}
            {i < words.length - 1 ? ' ' : ''}
          </motion.span>
        </span>
      ))}
    </span>
  )
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`wordmark ${className}`} aria-label="Rutline">
      <span className="text-bone-50">Rut</span>
      <span className="text-ember-500">line</span>
    </span>
  )
}

/** Deterministic contour-like closed path around a centre. */
function contour(cx: number, cy: number, r: number, seed: number, wobble = 0.22): string {
  const pts: string[] = []
  const n = 28
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const m = 1 + wobble * (Math.sin(a * 3 + seed) * 0.6 + Math.sin(a * 5 + seed * 1.7) * 0.3 + Math.cos(a * 2 + seed * 0.4) * 0.5)
    pts.push(`${(cx + r * m * Math.cos(a)).toFixed(1)} ${(cy + r * m * 0.72 * Math.sin(a)).toFixed(1)}`)
  }
  return `M${pts.join(' L')} Z`
}

/** Faint drifting topo lines with one ember rut line, fixed behind page content. */
export function TopoBackdrop() {
  const paths = useMemo(() => {
    const out: Array<{ d: string; o: number }> = []
    const centres: Array<[number, number, number, number]> = [
      [220, 160, 170, 1.3],
      [1010, 300, 240, 2.9],
      [640, 760, 300, 4.1],
      [1240, 820, 180, 0.7],
    ]
    for (const [cx, cy, r, seed] of centres) {
      for (let k = 0; k < 4; k++) out.push({ d: contour(cx, cy, r * (0.45 + k * 0.2), seed + k * 0.35), o: 0.05 - k * 0.008 })
    }
    return out
  }, [])
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <svg className="absolute -inset-[6%] w-[112%] h-[112%] drift-a" viewBox="0 0 1440 960" preserveAspectRatio="xMidYMid slice">
        {paths.map((p, i) => (
          <path key={i} d={p.d} fill="none" stroke="#f2ede2" strokeOpacity={p.o} strokeWidth="1" />
        ))}
      </svg>
      <svg className="absolute -inset-[6%] w-[112%] h-[112%] drift-b" viewBox="0 0 1440 960" preserveAspectRatio="xMidYMid slice">
        <path d="M-40 700 C 160 640, 260 820, 460 700 S 760 420, 980 520 S 1300 380, 1500 160" fill="none" stroke="#e8702c" strokeOpacity="0.16" strokeWidth="1.5" className="rut-line" />
      </svg>
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,transparent_40%,rgba(15,17,16,0.75)_100%)]" />
    </div>
  )
}

/** Trail that draws itself across a hero. Coordinates in a 0-100 box, stretched to fit. */
export function TrailDraw({ className = '', delay = 0.2, d = 'M-4 86 C 18 78, 26 96, 44 66 S 70 36, 82 44 S 96 30, 106 12' }: { className?: string; delay?: number; d?: string }) {
  const reduced = useReducedMotion()
  return (
    <svg className={`absolute inset-0 w-full h-full pointer-events-none ${className}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <motion.path d={d} fill="none" stroke="#f08a3f" strokeWidth="0.32" strokeLinecap="round" vectorEffect="non-scaling-stroke" strokeDasharray="1.1 1.3" initial={reduced ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.85 }} transition={{ pathLength: { duration: 2.2, ease: 'easeInOut', delay }, opacity: { duration: 0.4, delay } }} />
    </svg>
  )
}

const SPLASH_KEY = 'rutline.splash.seen'

/** Launch frame: poster, slow push-in, the rut line draws, then the app fades up. Once per session. */
export function Splash() {
  const reduced = useReducedMotion()
  const [show, setShow] = useState<boolean>(() => {
    if (reduced) return false
    try {
      return !sessionStorage.getItem(SPLASH_KEY)
    } catch {
      return true
    }
  })
  useEffect(() => {
    if (!show) return
    try {
      sessionStorage.setItem(SPLASH_KEY, '1')
    } catch {
      /* private mode */
    }
    const t = window.setTimeout(() => setShow(false), 2300)
    return () => window.clearTimeout(t)
  }, [show])
  return (
    <AnimatePresence>
      {show && (
        <motion.div key="splash" className="fixed inset-0 z-[95] bg-pine-950 overflow-hidden" exit={{ opacity: 0, scale: 1.03 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} aria-hidden>
          <picture>
            <source media="(orientation: landscape)" srcSet="brand/lockup.jpg" />
            <motion.img src="brand/poster.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" initial={{ scale: 1.1, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ scale: { duration: 2.8, ease: [0.16, 1, 0.3, 1] }, opacity: { duration: 0.8 } }} />
          </picture>
          <TrailDraw delay={0.5} />
          <div className="absolute inset-x-0 bottom-0 pb-safe">
            <div className="flex items-center justify-center gap-2 pb-8 font-mono text-[11px] uppercase tracking-[0.22em] text-bone-200/80">
              <span className="w-1.5 h-1.5 rounded-full bg-ember-400 breathe" />
              Reading the wind
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
