import { motion } from 'framer-motion'
import type { HourData } from '../../lib/types'
import { fmtHourShort } from '../../lib/format'

/** 72-hour barometer with the 29.90-30.40 "deer band" shaded and now marked. The line draws itself in. */
export default function PressureChart({ hours, nowIndex, metric }: { hours: HourData[]; nowIndex: number; metric: boolean }) {
  const from = Math.max(0, nowIndex - 24)
  const to = Math.min(hours.length - 1, nowIndex + 48)
  const slice = hours.slice(from, to + 1)
  if (slice.length < 2) return null
  const W = 720
  const H = 150
  const padL = 40
  const padR = 10
  const padT = 14
  const padB = 24
  const vals = slice.map((h) => h.pressureInHg)
  const lo = Math.min(29.6, ...vals) - 0.05
  const hi = Math.max(30.5, ...vals) + 0.05
  const x = (i: number) => padL + (i / (slice.length - 1)) * (W - padL - padR)
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB)
  const path = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const nowX = x(nowIndex - from)
  const nowY = y(vals[nowIndex - from])
  const bandTop = y(30.4)
  const bandBot = y(29.9)
  const fmt = (v: number) => (metric ? `${Math.round(v * 33.8639)}` : v.toFixed(2))
  const labels = slice.map((h, i) => ({ i, h })).filter(({ h }) => h.time.getHours() % 12 === 0)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Barometric pressure, last day and next two">
      <motion.rect x={padL} y={bandTop} width={W - padL - padR} height={bandBot - bandTop} fill="#e8702c" initial={{ opacity: 0 }} animate={{ opacity: 0.08 }} transition={{ duration: 1.2 }} />
      <line x1={padL} x2={W - padR} y1={bandTop} y2={bandTop} stroke="#e8702c" opacity="0.25" strokeDasharray="3 4" />
      <line x1={padL} x2={W - padR} y1={bandBot} y2={bandBot} stroke="#e8702c" opacity="0.25" strokeDasharray="3 4" />
      <text x={padL - 6} y={bandTop + 3} textAnchor="end" fontSize="9" fill="#767d74" fontFamily="Geist Mono Variable, monospace">
        {fmt(30.4)}
      </text>
      <text x={padL - 6} y={bandBot + 3} textAnchor="end" fontSize="9" fill="#767d74" fontFamily="Geist Mono Variable, monospace">
        {fmt(29.9)}
      </text>
      <motion.path d={path} fill="none" stroke="#f2ede2" strokeWidth="1.6" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }} />
      <motion.line x1={nowX} x2={nowX} y1={padT} y2={H - padB} stroke="#f08a3f" strokeWidth="1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} />
      <motion.circle cx={nowX} cy={nowY} r="3" fill="#f08a3f" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.1, type: 'spring', stiffness: 300, damping: 18 }} style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
      <motion.circle cx={nowX} cy={nowY} r="3" fill="none" stroke="#f08a3f" strokeWidth="1" initial={{ scale: 1, opacity: 0.8 }} animate={{ scale: 3.2, opacity: 0 }} transition={{ delay: 1.3, duration: 1.8, repeat: Infinity, repeatDelay: 0.6, ease: 'easeOut' }} style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
      {labels.map(({ i, h }) => (
        <text key={i} x={x(i)} y={H - 7} textAnchor="middle" fontSize="9" fill="#767d74" fontFamily="Geist Mono Variable, monospace">
          {h.time.getHours() === 0 ? h.time.toLocaleDateString([], { weekday: 'short' }) : fmtHourShort(h.time)}
        </text>
      ))}
    </svg>
  )
}
