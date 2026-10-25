import { useEffect, useRef, useState } from 'react'
import { RUT_PHASES, rutTimeline, type RutPhase } from '../../lib/rut'

const SHADE: Record<RutPhase, string> = {
  offseason: 'bg-pine-700',
  early: 'bg-pine-600',
  prerut: 'bg-bone-800',
  seeking: 'bg-ember-600',
  chasing: 'bg-ember-400',
  peak: 'bg-ember-500',
  postrut: 'bg-bone-800',
  second: 'bg-ember-600/80',
  late: 'bg-pine-600',
}
const LABELLED: RutPhase[] = ['prerut', 'seeking', 'chasing', 'peak', 'second', 'late']
const CHAR_PX = 6.1 // 10px mono
const GAP_PX = 6

export default function RutRibbon({ peak, today, current }: { peak: Date; today: Date; current: RutPhase }) {
  const segs = rutTimeline(peak)
  const start = segs[0].start.getTime()
  const end = segs[segs.length - 1].end.getTime()
  const pct = (t: number) => Math.min(100, Math.max(0, ((t - start) / (end - start)) * 100))
  const inRange = today.getTime() >= start && today.getTime() <= end

  // Phase labels sit under the middle of their segment. The seeking, chasing
  // and peak segments are a week or two each, so on a phone their labels
  // collide: keep the current phase's label, then add the others only where
  // they fit, in order of segment width.
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  const candidates = segs
    .filter((s) => LABELLED.includes(s.phase))
    .map((s) => {
      const text = RUT_PHASES[s.phase].short
      const centre = (pct(s.start.getTime()) + pct(s.end.getTime())) / 2
      const half = (text.length * CHAR_PX) / 2 + GAP_PX
      return { phase: s.phase, text, centre, left: (centre / 100) * width - half, right: (centre / 100) * width + half, span: pct(s.end.getTime()) - pct(s.start.getTime()) }
    })
  const placed: typeof candidates = []
  const order = [...candidates].sort((a, b) => (a.phase === current ? -1 : b.phase === current ? 1 : b.span - a.span))
  for (const c of order) {
    if (width === 0 || placed.every((p) => c.right <= p.left || c.left >= p.right)) placed.push(c)
  }

  return (
    <div>
      <div className="relative h-9">
        <div className="absolute inset-x-0 top-2 h-3 flex gap-px rounded-full overflow-hidden">
          {segs.map((s) => (
            <div key={s.phase} title={RUT_PHASES[s.phase].label} className={`${SHADE[s.phase]} ${s.phase === current ? 'opacity-100' : 'opacity-60'}`} style={{ width: `${pct(s.end.getTime()) - pct(s.start.getTime())}%` }} />
          ))}
        </div>
        {inRange && (
          <div className="absolute top-0 -translate-x-1/2" style={{ left: `${pct(today.getTime())}%` }}>
            <div className="w-px h-7 bg-bone-50 mx-auto" />
            <div className="w-2 h-2 rounded-full bg-bone-50 -mt-0.5 mx-auto" />
          </div>
        )}
      </div>
      <div ref={ref} className="relative h-5 font-mono text-[10px] text-bone-600">
        {placed.map((c) => (
          <span key={c.phase} className={`absolute -translate-x-1/2 whitespace-nowrap ${c.phase === current ? 'text-bone-200' : ''}`} style={{ left: `${c.centre}%` }}>
            {c.text}
          </span>
        ))}
      </div>
      <div className="flex justify-between font-mono text-[10px] text-bone-600 mt-1">
        <span>{segs[0].start.toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
        <span>peak {peak.toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
        <span>{segs[segs.length - 1].end.toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
      </div>
    </div>
  )
}
