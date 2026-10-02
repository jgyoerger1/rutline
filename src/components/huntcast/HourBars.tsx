import { motion } from 'framer-motion'
import type { DayScore, HourScore, Tier } from '../../lib/huntcast'

export const TIER_BAR: Record<Tier, string> = {
  poor: 'bg-pine-600',
  fair: 'bg-bone-800',
  good: 'bg-ember-600',
  great: 'bg-ember-500',
  best: 'bg-ember-300',
}

export const TIER_TEXT: Record<Tier, string> = {
  poor: 'text-bone-600',
  fair: 'text-bone-400',
  good: 'text-ember-500',
  great: 'text-ember-400',
  best: 'text-ember-300',
}

export default function HourBars({ day, selected, onSelect, legalMinutes }: { day: DayScore; selected: HourScore | null; onSelect: (h: HourScore) => void; legalMinutes: number }) {
  const start = day.dayDate.getTime()
  const span = 24 * 3600000
  const pct = (t: number) => Math.min(100, Math.max(0, ((t - start) / span) * 100))
  const legalL = pct(day.sunrise.getTime() - legalMinutes * 60000)
  const legalR = pct(day.sunset.getTime() + legalMinutes * 60000)
  const now = Date.now()
  const showNow = now >= start && now < start + span
  return (
    <div>
      <div className="relative h-44 md:h-52">
        <div className="absolute inset-y-0 bg-bone-50/[0.035] border-x border-bone-50/10 rounded-sm" style={{ left: `${legalL}%`, width: `${legalR - legalL}%` }} aria-hidden />
        <div className="absolute inset-0 grid grid-cols-[repeat(24,minmax(0,1fr))] gap-[3px] items-end">
          {day.hours.map((h, i) => {
            const isSel = selected?.index === h.index
            return (
              <button key={h.hour.iso} onClick={() => onSelect(h)} className="relative h-full flex items-end group" aria-label={`${h.time.getHours()}:00, score ${h.score}`} aria-pressed={isSel}>
                <motion.div
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ type: 'spring', stiffness: 140, damping: 18, delay: i * 0.018 }}
                  style={{ height: `${Math.max(4, h.score)}%`, transformOrigin: 'bottom' }}
                  className={`w-full rounded-t-[3px] ${TIER_BAR[h.tier]} ${h.night ? 'opacity-35' : h.legal ? '' : 'opacity-60'} ${isSel ? 'ring-2 ring-bone-50 ring-offset-2 ring-offset-pine-950' : 'group-hover:brightness-110'} transition-[filter]`}
                />
              </button>
            )
          })}
        </div>
        {showNow && <div className="absolute top-0 bottom-0 w-px bg-bone-50/70" style={{ left: `${pct(now)}%` }} aria-hidden />}
      </div>
      <div className="relative h-5 mt-1 font-mono text-[10px] text-bone-600">
        {[0, 6, 12, 18].map((hr) => (
          <span key={hr} className="absolute -translate-x-1/2" style={{ left: `${(hr / 24) * 100}%` }}>
            {hr === 0 ? '12a' : hr === 12 ? '12p' : hr < 12 ? `${hr}a` : `${hr - 12}p`}
          </span>
        ))}
        <span className="absolute right-0">12a</span>
      </div>
    </div>
  )
}
