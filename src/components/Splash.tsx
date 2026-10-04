import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { TopoBackdrop } from './motion'

/**
 * Launch sequence, once per session, about three seconds:
 *   0.0s  dark field, contours drifting, an ember glow wakes at the centre
 *   0.2s  the rut line draws itself up through the frame
 *   0.6s  the antler mark pulls into focus out of a blur
 *   1.2s  RUTLINE rises letter by letter and tightens into place
 *   1.9s  the tagline settles, a hairline underscores it, a light sweeps the mark
 *   3.1s  the whole scene pushes through into the app
 */
const SPLASH_KEY = 'rutline.splash.seen'
const EXPO = [0.16, 1, 0.3, 1] as const
const LETTERS = ['R', 'U', 'T', 'L', 'I', 'N', 'E']

export default function Splash() {
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
    const t = window.setTimeout(() => setShow(false), 3100)
    return () => window.clearTimeout(t)
  }, [show])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="splash"
          className="fixed inset-0 z-[95] bg-pine-950 overflow-hidden select-none"
          exit={{ opacity: 0, scale: 1.05, filter: 'blur(8px)' }}
          transition={{ duration: 0.75, ease: EXPO }}
          aria-hidden
          onClick={() => setShow(false)}
        >
          <TopoBackdrop />

          {/* Ember glow waking behind the mark */}
          <motion.div
            className="absolute left-1/2 top-[40%] w-[90vmin] h-[90vmin] -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(232,112,44,0.30) 0%, rgba(232,112,44,0.08) 35%, transparent 62%)', filter: 'blur(20px)' }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: [0, 1, 0.6], scale: [0.5, 1.15, 1] }}
            transition={{ duration: 2.4, times: [0, 0.45, 1], ease: 'easeOut' }}
          />

          {/* The rut line drawing itself up the frame */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <filter id="splash-glow" x="-50%" y="-20%" width="200%" height="140%">
                <feGaussianBlur stdDeviation="1.1" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <motion.path
              d="M 50 108 C 44 92, 58 82, 51 68 S 44 50, 52 38 S 47 22, 51 10 S 48 2, 50 -6"
              fill="none"
              stroke="#f08a3f"
              strokeWidth="3"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              filter="url(#splash-glow)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: [0, 1, 1, 0.25] }}
              transition={{ pathLength: { duration: 1.5, delay: 0.2, ease: [0.65, 0, 0.35, 1] }, opacity: { duration: 2.6, delay: 0.2, times: [0, 0.15, 0.6, 1] } }}
            />
          </svg>

          {/* Antler mark: blur to focus, feathered into the field */}
          <motion.div
            className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 w-[min(84vw,62vh)] aspect-[700/520] pointer-events-none"
            initial={{ opacity: 0, scale: 1.14, filter: 'blur(22px)', y: 18 }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', y: 0 }}
            transition={{ duration: 1.4, delay: 0.55, ease: EXPO }}
            style={{ willChange: 'transform, filter, opacity' }}
          >
            <img
              src="brand/mark.jpg"
              alt=""
              className="w-full h-full object-cover"
              style={{ WebkitMaskImage: 'radial-gradient(ellipse 58% 60% at 50% 55%, #000 48%, transparent 90%)', maskImage: 'radial-gradient(ellipse 58% 60% at 50% 55%, #000 48%, transparent 90%)' }}
              draggable={false}
            />
            {/* Light sweep across the mark once it has landed */}
            <motion.div
              className="absolute inset-y-0 w-[18%] pointer-events-none"
              style={{ background: 'linear-gradient(100deg, transparent, rgba(242,237,226,0.22), transparent)', mixBlendMode: 'screen', skewX: -14 }}
              initial={{ left: '-30%', opacity: 0 }}
              animate={{ left: ['-30%', '115%'], opacity: [0, 1, 0] }}
              transition={{ delay: 2.0, duration: 0.9, ease: 'easeInOut', times: [0, 0.4, 1] }}
            />
          </motion.div>

          {/* Wordmark rising letter by letter */}
          <div className="absolute left-1/2 top-[68%] -translate-x-1/2 text-center w-full px-6">
            <div className="wordmark flex justify-center overflow-hidden pb-[0.08em] text-[clamp(44px,10vmin,104px)] leading-none">
              {LETTERS.map((ch, i) => (
                <motion.span
                  key={i}
                  className={i < 3 ? 'text-bone-50' : 'text-ember-500'}
                  style={{ display: 'inline-block' }}
                  initial={{ y: '115%', opacity: 0, marginRight: '0.34em' }}
                  animate={{ y: 0, opacity: 1, marginRight: '0.05em' }}
                  transition={{ delay: 1.15 + i * 0.065, type: 'spring', stiffness: 150, damping: 20, mass: 0.9 }}
                >
                  {ch}
                </motion.span>
              ))}
            </div>
            <motion.div
              className="mt-3 font-mono uppercase text-bone-200 text-[clamp(11px,2vmin,16px)]"
              initial={{ opacity: 0, letterSpacing: '0.7em', y: 6 }}
              animate={{ opacity: 1, letterSpacing: '0.34em', y: 0 }}
              transition={{ delay: 1.85, duration: 1.0, ease: EXPO }}
            >
              Map. Predict. Track.
            </motion.div>
            <motion.div className="mx-auto mt-5 h-px w-[26vmin] max-w-[220px] bg-gradient-to-r from-transparent via-ember-400 to-transparent" initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} transition={{ delay: 2.05, duration: 0.8, ease: EXPO }} />
          </div>

          {/* Vignette and film grain */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(120% 95% at 50% 45%, transparent 48%, rgba(15,17,16,0.92) 100%)' }} />
          <div className="grain" style={{ position: 'absolute', zIndex: 1 }} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
