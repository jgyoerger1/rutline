/**
 * The Field Guide engine. A sticky diagram stays put; the reader scrolls the
 * steps past a trigger line and the diagram phases into each one. Within a
 * step, scroll progress drives a 0-1 "draw" value the diagram animates with.
 */
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion'
import { CaretDown, CaretLeft, Warning } from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, SectionLabel } from '../ui'
import type { Diagram, GuideMeta, GuideStep } from './types'

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1]
const pad = (n: number) => String(n).padStart(2, '0')

interface Metric {
  scene: string
  top: number
  height: number
}

export interface OutroSpec {
  label: string
  title: string
  body: string
  children?: ReactNode
}

export default function ScrollGuide({ meta, steps, Diagram, outro, onBack }: { meta: GuideMeta; steps: GuideStep[]; Diagram: Diagram; outro: OutroSpec; onBack: () => void }) {
  const reduced = useReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLElement | null>(null)
  const sectionRefs = useRef(new Map<string, HTMLElement>())
  const metricsRef = useRef<Metric[]>([])
  const mq = useRef<MediaQueryList | null>(null)
  const [active, setActive] = useState('intro')
  const activeRef = useRef('intro')
  const order = useRef<string[]>(['intro', ...steps.map((s) => s.illustration), 'outro'])

  // The draw value is driven by hand (animate + jump) rather than useSpring: jumping a
  // followed value detaches it from its source, and each step must start from zero.
  const drawS = useMotionValue(0)
  const drawAnim = useRef<ReturnType<typeof animate> | null>(null)
  const overall = useMotionValue(0)
  const overallS = useSpring(overall, { stiffness: 120, damping: 26 })

  const setSection = useCallback((scene: string) => (el: HTMLElement | null) => {
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
      metricsRef.current = order.current.map((scene) => {
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
        drawAnim.current?.stop()
        drawS.jump(0)
        setActive(cur.scene)
      }
      if (reduced) drawS.set(p)
      else {
        drawAnim.current?.stop()
        drawAnim.current = animate(drawS, p, { type: 'spring', stiffness: 170, damping: 30, mass: 0.5 })
      }
      const n = order.current.length - 2
      overall.set(idx === 0 ? 0 : idx > n ? 1 : (idx - 1 + p) / n)
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
    (scene: string) => {
      const c = containerRef.current
      const m = metricsRef.current.find((x) => x.scene === scene)
      if (!c || !m) return
      c.scrollTo({ top: Math.max(0, m.top - c.clientHeight * 0.1), behavior: reduced ? 'auto' : 'smooth' })
    },
    [reduced],
  )

  const stepIndex = steps.findIndex((s) => s.illustration === active)
  const stepNo = stepIndex >= 0 ? stepIndex + 1 : active === 'outro' ? steps.length : 0

  return (
    <div ref={rootRef} className="fg-root max-w-[1500px] mx-auto md:grid md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* ---------- stage ---------- */}
      <div className="fg-stage sticky top-0 z-10 h-[40dvh] md:h-[100dvh] md:self-start bg-pine-950/95 md:bg-transparent backdrop-blur-sm md:backdrop-blur-none border-b border-bone-50/8 md:border-b-0 md:border-r md:border-bone-50/6">
        <Diagram scene={active} draw={drawS} className="absolute inset-0 w-full h-full p-3 md:p-5 lg:p-10" />
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(85%_80%_at_50%_50%,transparent_52%,rgba(15,17,16,0.85)_100%)]" aria-hidden />
        <div className="md:hidden absolute inset-x-0 -bottom-px h-8 pointer-events-none bg-gradient-to-b from-transparent to-pine-950" aria-hidden />

        <div className="absolute left-4 top-3 md:left-10 md:top-8 flex flex-col gap-2 pointer-events-none">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-bone-400 tnum">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={stepNo > 0 ? 'step' : active} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="inline-block">
                {active === 'intro' ? meta.title : active === 'outro' ? `Done · ${outro.label}` : <>Step {pad(stepNo)} <span className="text-bone-800">/ {pad(steps.length)}</span></>}
              </motion.span>
            </AnimatePresence>
          </div>
          <div className="w-28 h-[2px] bg-bone-50/10 overflow-hidden rounded-full">
            <motion.div className="h-full w-full bg-ember-500 origin-left" style={{ scaleX: overallS }} />
          </div>
        </div>

        <div className="hidden md:block absolute right-10 bottom-6 pointer-events-none select-none" aria-hidden>
          <AnimatePresence initial={false}>
            {stepIndex >= 0 && (
              <motion.div key={stepIndex} initial={{ opacity: 0, transform: 'translateY(14px)' }} animate={{ opacity: 1, transform: 'translateY(0px)' }} exit={{ opacity: 0, transform: 'translateY(-14px)' }} transition={{ duration: 0.55, ease: EASE_OUT }} className="absolute right-0 bottom-0 font-display font-bold text-[22vh] leading-none text-bone-50/[0.05] tnum">
                {pad(stepIndex + 1)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav className="hidden md:flex absolute right-5 top-1/2 -translate-y-1/2 flex-col items-center gap-3" aria-label="Steps">
          {steps.map((s, i) => {
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
          <SectionLabel className="mt-6">Installment {pad(meta.installment)}</SectionLabel>
          <h1 className="mt-2 text-[34px] md:text-[44px] font-semibold tracking-tight leading-[1.02]">{meta.title}</h1>
          <p className="mt-4 text-[16px] md:text-[17px] leading-relaxed text-bone-200">{meta.subtitle}</p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-[0.16em] text-bone-400">
            <span className="text-bone-50">{steps.length} steps</span>
            <span>About {meta.minutes} min</span>
            <span>Read it at camp</span>
          </div>
          <div className="mt-8">
            <div className="text-[12px] uppercase tracking-[0.16em] text-bone-600">Bring</div>
            <ul className="mt-3 grid gap-2 text-[14px] text-bone-200">
              {meta.gear.map((g) => (
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

        {steps.map((s) => (
          <Step key={s.id} step={s} total={steps.length} active={active === s.illustration} refCb={setSection(s.illustration)} />
        ))}

        <section ref={setSection('outro')} className="min-h-[70dvh] md:min-h-[90dvh] flex flex-col justify-center py-10 md:py-16 max-w-[560px]">
          <SectionLabel>{outro.label}</SectionLabel>
          <h2 className="mt-2 text-[27px] md:text-[34px] font-semibold tracking-tight leading-[1.08]">{outro.title}</h2>
          <p className="mt-4 text-[15px] md:text-[16px] leading-relaxed text-bone-200">{outro.body}</p>
          {outro.children && <div className="mt-7">{outro.children}</div>}
          <div className="mt-4">
            <Button variant="ghost" size="lg" onClick={onBack}>
              <CaretLeft size={16} weight="bold" /> Field Guide
            </Button>
          </div>
          {meta.footnote && <p className="mt-10 text-[12px] leading-relaxed text-bone-600">{meta.footnote}</p>}
        </section>
      </div>
    </div>
  )
}

function Step({ step, total, active, refCb }: { step: GuideStep; total: number; active: boolean; refCb: (el: HTMLElement | null) => void }) {
  return (
    <section ref={refCb} id={`fg-${step.id}`} data-active={active ? 1 : 0} className="fg-step min-h-[62dvh] md:min-h-[92dvh] flex flex-col justify-center py-10 md:py-16 max-w-[560px]">
      <div className="font-mono text-[12px] tracking-[0.18em] text-ember-400 tnum">
        {pad(step.number)} <span className="text-bone-800">/ {pad(total)}</span>
      </div>
      <div className="mt-3 text-[12px] uppercase tracking-[0.16em] text-bone-600">{step.kicker}</div>
      <h2 className="mt-2 text-[27px] md:text-[34px] font-semibold tracking-tight leading-[1.08]">{step.title}</h2>
      <div className="mt-5 space-y-4 text-[15px] md:text-[16px] leading-relaxed text-bone-200">
        {step.body.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      {step.facts && (
        <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-[13px] border-y border-bone-50/8 py-4">
          {step.facts.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-mono uppercase tracking-[0.12em] text-[11px] text-bone-400 pt-[2px]">{k}</dt>
              <dd className="text-bone-200">{v}</dd>
            </div>
          ))}
        </dl>
      )}
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
