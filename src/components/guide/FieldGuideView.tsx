/**
 * Field Guide: short, visual walkthroughs. `#/guide` lists them,
 * `#/guide/<slug>` opens one.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight } from '@phosphor-icons/react'
import { useEffect, useRef, useState, type ComponentType } from 'react'
import { SectionLabel } from '../ui'
import { DeerFigure } from './DeerDiagram'
import { RackFigure } from './RackDiagram'
import { TrailFigure } from './TrailDiagram'
import BloodTrailGuide from './BloodTrailGuide'
import FieldDressingGuide from './FieldDressingGuide'
import ScoringGuide from './ScoringGuide'
import { BLOOD_TRAIL, BLOOD_TRAIL_STEPS } from './bloodTrail'
import { FIELD_DRESSING, FIELD_DRESSING_STEPS } from './fieldDressing'
import { SCORING, SCORING_STEPS } from './scoring'
import type { GuideMeta } from './types'

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1]

interface Installment {
  meta: GuideMeta
  steps: number
  Figure: ComponentType<{ className?: string }>
  Guide: ComponentType<{ onBack: () => void }>
  /** Where the cover figure sits in the card */
  figureClass: string
}

const GUIDES: Installment[] = [
  { meta: FIELD_DRESSING, steps: FIELD_DRESSING_STEPS.length, Figure: DeerFigure, Guide: FieldDressingGuide, figureClass: 'absolute -right-4 top-0 md:right-2 md:-top-1 w-[90%] md:w-[82%]' },
  { meta: BLOOD_TRAIL, steps: BLOOD_TRAIL_STEPS.length, Figure: TrailFigure, Guide: BloodTrailGuide, figureClass: 'absolute -right-2 top-1 w-[92%] md:w-[88%]' },
  { meta: SCORING, steps: SCORING_STEPS.length, Figure: RackFigure, Guide: ScoringGuide, figureClass: 'absolute right-2 top-2 w-[78%] md:w-[74%]' },
]

function readSlug(): string {
  const parts = location.hash.replace(/^#\/?/, '').split('/')
  return parts[0] === 'guide' && parts[1] ? parts[1] : ''
}

export default function FieldGuideView() {
  const [slug, setSlug] = useState(readSlug)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const on = () => setSlug(readSlug())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  const go = (s: string) => {
    location.hash = s ? `/guide/${s}` : '/guide'
    setSlug(s)
    const c = ref.current?.closest<HTMLElement>('[data-view-scroll]')
    if (c) c.scrollTop = 0
  }

  const open = GUIDES.find((g) => g.meta.slug === slug)

  return (
    <div ref={ref}>
      <AnimatePresence mode="wait" initial={false}>
        {open ? (
          <motion.div key={open.meta.slug} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: EASE_OUT }}>
            <open.Guide onBack={() => go('')} />
          </motion.div>
        ) : (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: EASE_OUT }}>
            <GuideList onOpen={go} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function GuideList({ onOpen }: { onOpen: (slug: string) => void }) {
  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-5 md:py-8 pb-16">
      <SectionLabel>Field Guide</SectionLabel>
      <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight">Know it cold before you need it</h1>
      <p className="mt-2 max-w-[560px] text-[15px] leading-relaxed text-bone-400">Short, visual walkthroughs for the moments that are not the time to be guessing. Read them at camp, not over the deer.</p>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3 cascade">
        {GUIDES.map((g, i) => (
          <button key={g.meta.slug} style={{ ['--i' as string]: i }} onClick={() => onOpen(g.meta.slug)} className="fg-card push group relative text-left overflow-hidden rounded-3xl border border-bone-50/10 bg-pine-900/70 p-6 md:p-7 min-h-[300px] md:min-h-[360px] flex flex-col justify-end">
            <g.Figure className={`${g.figureClass} h-auto pointer-events-none`} />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_28%,rgba(21,24,22,0.94)_72%)] pointer-events-none" aria-hidden />
            <div className="relative">
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ember-400">Installment {String(g.meta.installment).padStart(2, '0')}</div>
              <div className="mt-2 text-[24px] md:text-[28px] font-semibold tracking-tight leading-[1.05]">{g.meta.title}</div>
              <p className="mt-2 text-[14px] leading-relaxed text-bone-200">{g.meta.subtitle}</p>
              <div className="mt-5 flex items-center gap-5 font-mono text-[11px] uppercase tracking-[0.16em] text-bone-400">
                <span>{g.steps} steps</span>
                <span>About {g.meta.minutes} min</span>
                <span className="ml-auto inline-flex items-center gap-1.5 text-bone-50">
                  Open <ArrowRight size={14} weight="bold" className="fg-arrow" />
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
