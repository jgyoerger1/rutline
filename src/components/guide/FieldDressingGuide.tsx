/**
 * Scroll-driven walkthrough. The diagram stays put; the reader scrolls the
 * steps past a trigger line and the diagram phases into each one. Within a
 * step, scroll progress draws the cut.
 */
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion'
import { CaretDown, CaretLeft, Crosshair, Warning } from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { addWaypoint } from '../../lib/db'
import { locate } from '../../lib/geo'
import { useApp } from '../AppContext'
import { Button, SectionLabel } from '../ui'
import DeerDiagram, { type Scene } from './DeerDiagram'
import { FIELD_DRESSING, FIELD_DRESSING_STEPS, type GuideStep } from './fieldDressing'

const ORDER: Scene[] = ['intro', ...FIELD_DRESSING_STEPS.map((s) => s.illustration), 'outro']
const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1]
const pad = (n: number) => String(n).padStart(2, '0')

interface Metric {
  scene: Scene
  top: number
  height: number
}

export default function FieldDressingGuide({ onBack }: { onBack: () => void }) {
  const reduced = useReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLElement | null>(null)
  const sectionRefs = useRef(new Map<Scene, HTMLElement>())
  const metricsRef = useRef<Metric[]>([])
  const mq = useRef<MediaQueryList | null>(null)
  const [active, setActive] = useState<Scene>('intro')
  const activeRef = useRef<Scene>('intro')

  // Scroll-linked values. A light spring takes the jitter out without lagging the hand.
  // The draw value is driven by hand (animate + jump) rather than useSpring: jumping a
  // followed value detaches it from its source, and each step must start from zero.
  const drawS = useMotionValue(0)
  const drawAnim = useRef<ReturnType<typeof animate> | null>(null)
  const overall = useMotionValue(0)
  const overallS = useSpring(overall, { stiffness: 120, damping: 26 })

  const setSection = useCallback((scene: Scene) => (el: HTMLElement | null) => {
    if (el) sectionRefs.current.set(scene, el)
    else sectionRefs.current.delete(scene)
  }, [])

  useEffect(() => {
    const root = rootRef.current
    const c = root?.closest<HTMLElement>('[data-view-scroll]') ?? null
    if (!root || !c) return
    containerRef.current = c
    mq.current = window.matchMedia('(min-width: 768px)')

    const measure = () => {
      const cTop = c.getBoundingClientRect().top
      metricsRef.current = ORDER.map((scene) => {
        const el = sectionRefs.current.get(scene)
        const r = el?.getBoundingClientRect()
        return { scene, top: r ? r.top - cTop + c.scrollTop : 0, height: r?.height ?? 1 }
      })
    }

    const tick = () => {
      const m = metricsRef.current
      if (!m.length) return
      const desktop = mq.current?.matches ?? true
      const line = c.scrollTop + c.clientHeight * (desktop ? 0.5 : 0.64)
      let idx = 0
      for (let i = 0; i < m.length; i++) if (m[i].top <= line) idx = i
      const cur = m[idx]
      const p = Math.min(1, Math.max(0, (line - cur.top) / (cur.height * 0.6)))
      if (cur.scene !== activeRef.current) {
        activeRef.current = cur.scene
        // New step: the new cut starts from nothing, no un-drawing of the old one
        drawAnim.current?.stop()
        drawS.jump(0)
        setActive(cur.scene)
      }
      if (reduced) drawS.set(p)
      else {
        drawAnim.current?.stop()
        drawAnim.current = animate(drawS, p, { type: 'spring', stiffness: 170, damping: 30, mass: 0.5 })
      }
      const steps = ORDER.length - 2
      overall.set(idx === 0 ? 0 : idx > steps ? 1 : (idx - 1 + p) / steps)
    }

    measure()
    tick()
    c.addEventListener('scroll', tick, { passive: true })
    const ro = new ResizeObserver(() => {
      measure()
      tick()
    })
    ro.observe(root)
    ro.observe(c)
    return () => {
      c.removeEventListener('scroll', tick)
      ro.disconnect()
      drawAnim.current?.stop()
    }
  }, [drawS, overall, reduced])

  const scrollTo = useCallback(
    (scene: Scene) => {
      const c = containerRef.current
      const m = metricsRef.current.find((x) => x.scene === scene)
      if (!c || !m) return
      c.scrollTo({ top: Math.max(0, m.top - c.clientHeight * 0.1), behavior: reduced ? 'auto' : 'smooth' })
    },
    [reduced],
  )

  const stepIndex = FIELD_DRESSING_STEPS.findIndex((s) => s.illustration === active)
  const stepNo = stepIndex >= 0 ? stepIndex + 1 : active === 'outro' ? FIELD_DRESSING_STEPS.length : 0

  return (
    <div ref={rootRef} className="fg-root max-w-[1500px] mx-auto md:grid md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* ---------- stage ---------- */}
      <div className="fg-stage sticky top-0 z-10 h-[40dvh] md:h-[100dvh] md:self-start bg-pine-950/95 md:bg-transparent backdrop-blur-sm md:backdrop-blur-none border-b border-bone-50/8 md:border-b-0 md:border-r md:border-bone-50/6">
        <DeerDiagram scene={active} draw={drawS} className="absolute inset-0 w-full h-full p-3 md:p-5 lg:p-10" />
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(85%_80%_at_50%_50%,transparent_52%,rgba(15,17,16,0.85)_100%)]" aria-hidden />
        <div className="md:hidden absolute inset-x-0 -bottom-px h-8 pointer-events-none bg-gradient-to-b from-transparent to-pine-950" aria-hidden />

        {/* step chip + progress */}
        <div className="absolute left-4 top-3 md:left-10 md:top-8 flex flex-col gap-2 pointer-events-none">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-bone-400 tnum">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={stepNo > 0 ? 'step' : active} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="inline-block">
                {active === 'intro' ? 'Field dressing' : active === 'outro' ? 'Done · mark the spot' : <>Step {pad(stepNo)} <span className="text-bone-800">/ {pad(FIELD_DRESSING_STEPS.length)}</span></>}
              </motion.span>
            </AnimatePresence>
          </div>
          <div className="w-28 h-[2px] bg-bone-50/10 overflow-hidden rounded-full">
            <motion.div className="h-full w-full bg-ember-500 origin-left" style={{ scaleX: overallS }} />
          </div>
        </div>

        {/* ghost number */}
        <div className="hidden md:block absolute right-10 bottom-6 pointer-events-none select-none" aria-hidden>
          <AnimatePresence initial={false}>
            {stepIndex >= 0 && (
              <motion.div key={stepIndex} initial={{ opacity: 0, transform: 'translateY(14px)' }} animate={{ opacity: 1, transform: 'translateY(0px)' }} exit={{ opacity: 0, transform: 'translateY(-14px)' }} transition={{ duration: 0.55, ease: EASE_OUT }} className="absolute right-0 bottom-0 font-display font-bold text-[22vh] leading-none text-bone-50/[0.05] tnum">
                {pad(stepIndex + 1)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* rail */}
        <nav className="hidden md:flex absolute right-5 top-1/2 -translate-y-1/2 flex-col items-center gap-3" aria-label="Steps">
          {FIELD_DRESSING_STEPS.map((s, i) => {
            const on = s.illustration === active
            const done = stepIndex > i || active === 'outro'
            return (
              <button key={s.id} onClick={() => scrollTo(s.illustration)} aria-label={`Step ${i + 1}: ${s.title}`} aria-current={on ? 'step' : undefined} title={s.title} className="group relative grid place-items-center w-5 h-5">
                <span className={`fg-dot block w-1.5 h-1.5 rounded-full ${on ? 'bg-ember-500 scale-[1.9] shadow-[0_0_12px_rgba(232,112,44,0.7)]' : done ? 'bg-bone-400' : 'bg-bone-800'}`} />
              </button>
            )
          })}
        </nav>
      </div>

      {/* ---------- copy ---------- */}
      <div className="relative px-5 md:px-14 lg:px-20">
        <section ref={setSection('intro')} className="min-h-[60dvh] md:min-h-[100dvh] flex flex-col justify-center py-10 md:py-16 max-w-[560px]">
          <button onClick={onBack} className="push self-start -ml-2 inline-flex items-center gap-1 px-2 h-9 rounded-lg text-[13px] text-bone-400 hover:text-bone-50 transition-colors">
            <CaretLeft size={14} weight="bold" /> Field Guide
          </button>
          <SectionLabel className="mt-6">Installment 01</SectionLabel>
          <h1 className="mt-2 text-[34px] md:text-[44px] font-semibold tracking-tight leading-[1.02]">{FIELD_DRESSING.title}</h1>
          <p className="mt-4 text-[16px] md:text-[17px] leading-relaxed text-bone-200">{FIELD_DRESSING.subtitle}</p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-[0.16em] text-bone-400">
            <span className="text-bone-50">{FIELD_DRESSING_STEPS.length} steps</span>
            <span>About {FIELD_DRESSING.minutes} min</span>
            <span>Read it at camp</span>
          </div>
          <div className="mt-8">
            <div className="text-[12px] uppercase tracking-[0.16em] text-bone-600">Bring</div>
            <ul className="mt-3 grid gap-2 text-[14px] text-bone-200">
              {FIELD_DRESSING.gear.map((g) => (
                <li key={g} className="flex gap-3">
                  <span className="mt-[8px] w-1.5 h-1.5 rounded-full bg-brass-400 shrink-0" />
                  {g}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-10 flex items-center gap-2 text-bone-600 text-[12px] uppercase tracking-[0.16em]">
            <CaretDown size={14} className="fg-bounce" /> Scroll
          </div>
        </section>

        {FIELD_DRESSING_STEPS.map((s) => (
          <Step key={s.id} step={s} active={active === s.illustration} refCb={setSection(s.illustration)} />
        ))}

        <Outro refCb={setSection('outro')} onBack={onBack} />
      </div>
    </div>
  )
}

function Step({ step, active, refCb }: { step: GuideStep; active: boolean; refCb: (el: HTMLElement | null) => void }) {
  return (
    <section ref={refCb} id={`fd-${step.id}`} data-active={active ? 1 : 0} className="fg-step min-h-[62dvh] md:min-h-[92dvh] flex flex-col justify-center py-10 md:py-16 max-w-[560px]">
      <div className="font-mono text-[12px] tracking-[0.18em] text-ember-400 tnum">
        {pad(step.number)} <span className="text-bone-800">/ {pad(FIELD_DRESSING_STEPS.length)}</span>
      </div>
      <div className="mt-3 text-[12px] uppercase tracking-[0.16em] text-bone-600">{step.kicker}</div>
      <h2 className="mt-2 text-[27px] md:text-[34px] font-semibold tracking-tight leading-[1.08]">{step.title}</h2>
      <div className="mt-5 space-y-4 text-[15px] md:text-[16px] leading-relaxed text-bone-200">
        {step.body.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      {step.caution && (
        <div className="mt-6 flex gap-3 rounded-2xl border border-ember-600/30 bg-ember-950/40 px-4 py-3.5 text-[14px] leading-relaxed text-ember-300">
          <Warning size={18} weight="fill" className="shrink-0 mt-[2px] text-ember-400" />
          <span>{step.caution}</span>
        </div>
      )}
      {step.tips && (
        <ul className="mt-6 space-y-2.5">
          {step.tips.map((t) => (
            <li key={t} className="flex gap-3 text-[14px] leading-relaxed text-bone-400">
              <span className="mt-[9px] w-1.5 h-1.5 rounded-full bg-brass-400 shrink-0" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Outro({ refCb, onBack }: { refCb: (el: HTMLElement | null) => void; onBack: () => void }) {
  const { toast, focusWaypoint } = useApp()
  const [busy, setBusy] = useState(false)

  async function dropPin() {
    setBusy(true)
    try {
      const pos = await locate()
      const when = new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })
      const id = await addWaypoint({ type: 'other', name: `Kill site · ${when}`, lat: pos.coords.latitude, lon: pos.coords.longitude, note: 'Dropped from the Field Guide after field dressing.' })
      toast('Kill-site pin dropped')
      focusWaypoint(id)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not get a fix')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section ref={refCb} className="min-h-[70dvh] md:min-h-[90dvh] flex flex-col justify-center py-10 md:py-16 max-w-[560px]">
      <SectionLabel>Before you drag</SectionLabel>
      <h2 className="mt-2 text-[27px] md:text-[34px] font-semibold tracking-tight leading-[1.08]">Mark the spot</h2>
      <p className="mt-4 text-[15px] md:text-[16px] leading-relaxed text-bone-200">One pin at the kill site ties tonight together: the stand that produced it, the line it ran, where it fell. Next season that is the pattern you hunt.</p>
      <div className="mt-7 flex flex-wrap gap-2">
        <Button variant="primary" size="lg" onClick={dropPin} disabled={busy}>
          <Crosshair size={18} weight="bold" className={busy ? 'breathe' : ''} />
          {busy ? 'Getting a fix…' : 'Drop a kill-site pin'}
        </Button>
        <Button variant="ghost" size="lg" onClick={onBack}>
          <CaretLeft size={16} weight="bold" /> Field Guide
        </Button>
      </div>
      <p className="mt-10 text-[12px] leading-relaxed text-bone-600">Written for Rutline from the hunter-education standard sequence. Regulations on tagging and evidence of sex vary by state; your agency's rules win.</p>
    </section>
  )
}
