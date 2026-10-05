/**
 * Field Guide: short, visual walkthroughs. `#/guide` lists them,
 * `#/guide/<slug>` opens one.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { SectionLabel } from '../ui'
import { DeerFigure } from './DeerDiagram'
import FieldDressingGuide from './FieldDressingGuide'
import { FIELD_DRESSING, FIELD_DRESSING_STEPS } from './fieldDressing'

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1]

const COMING = [
  { title: 'Reading a blood trail', blurb: 'Bright, dark, frothy, and what each one tells you about how long to wait.' },
  { title: 'Aging a buck on the hoof', blurb: 'Body before antlers: neck, brisket, belly line and the way he walks.' },
  { title: 'Hanging, skinning and quartering', blurb: 'From the gambrel to the cooler without a saw.' },
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

  return (
    <div ref={ref}>
      <AnimatePresence mode="wait" initial={false}>
        {slug === FIELD_DRESSING.slug ? (
          <motion.div key="fd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: EASE_OUT }}>
            <FieldDressingGuide onBack={() => go('')} />
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

      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <button onClick={() => onOpen(FIELD_DRESSING.slug)} className="fg-card push group relative text-left overflow-hidden rounded-3xl border border-bone-50/10 bg-pine-900/70 p-6 md:p-8 min-h-[280px] md:min-h-[340px] flex flex-col justify-end">
          <DeerFigure className="absolute -right-4 top-0 md:right-4 md:-top-2 w-[92%] md:w-[72%] h-auto pointer-events-none" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_30%,rgba(21,24,22,0.92)_75%)] pointer-events-none" aria-hidden />
          <div className="relative">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ember-400">Installment 01</div>
            <div className="mt-2 text-[26px] md:text-[32px] font-semibold tracking-tight leading-[1.05]">{FIELD_DRESSING.title}</div>
            <p className="mt-2 max-w-[520px] text-[14px] md:text-[15px] leading-relaxed text-bone-200">{FIELD_DRESSING.subtitle}</p>
            <div className="mt-5 flex items-center gap-5 font-mono text-[11px] uppercase tracking-[0.16em] text-bone-400">
              <span>{FIELD_DRESSING_STEPS.length} steps</span>
              <span>About {FIELD_DRESSING.minutes} min</span>
              <span className="ml-auto inline-flex items-center gap-1.5 text-bone-50">
                Open <ArrowRight size={14} weight="bold" className="fg-arrow" />
              </span>
            </div>
          </div>
        </button>

        <div className="grid gap-4">
          {COMING.map((c) => (
            <div key={c.title} className="rounded-3xl border border-dashed border-bone-50/10 bg-pine-900/30 p-5 md:p-6">
              <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-bone-600">
                Coming <span className="w-1 h-1 rounded-full bg-bone-800" /> next
              </div>
              <div className="mt-2 text-[17px] font-semibold tracking-tight text-bone-200">{c.title}</div>
              <p className="mt-1 text-[13px] leading-relaxed text-bone-600">{c.blurb}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
