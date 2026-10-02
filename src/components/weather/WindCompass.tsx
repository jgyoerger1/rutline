import { motion } from 'framer-motion'
import { useRef } from 'react'
import { degToCompass } from '../../lib/geo'

/**
 * Wind streamline compass. The arrow enters from the side the wind blows FROM
 * and points where your scent goes, which is how a hunter thinks about it.
 */
export default function WindCompass({ dir, speed, gust, unit, size = 240 }: { dir: number; speed: number; gust?: number; unit: string; size?: number }) {
  // Unwrap rotation so a swing from 350 to 10 does not spin the long way round
  const acc = useRef<number>(dir)
  const target = dir
  let delta = ((target - (acc.current % 360)) + 540) % 360 - 180
  acc.current += delta
  const rotate = acc.current + 180 // streamline drawn pointing "to"; wind dir is "from"

  const ticks = Array.from({ length: 36 }, (_, i) => i * 10)
  return (
    <div className="relative select-none" style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" className="w-full h-full">
        <defs>
          <radialGradient id="wc-bg" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#1b2420" />
            <stop offset="100%" stopColor="#0e1311" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="96" fill="url(#wc-bg)" stroke="rgba(242,237,226,0.08)" />
        <circle cx="100" cy="100" r="78" fill="none" stroke="rgba(242,237,226,0.06)" />
        {ticks.map((t) => {
          const major = t % 90 === 0
          const mid = t % 45 === 0
          const len = major ? 10 : mid ? 7 : 4
          const r1 = 96 - 2
          const r2 = r1 - len
          const a = ((t - 90) * Math.PI) / 180
          return <line key={t} x1={100 + r1 * Math.cos(a)} y1={100 + r1 * Math.sin(a)} x2={100 + r2 * Math.cos(a)} y2={100 + r2 * Math.sin(a)} stroke={major ? '#c4ab74' : 'rgba(242,237,226,0.25)'} strokeWidth={major ? 1.6 : 1} />
        })}
        {[
          ['N', 100, 24],
          ['E', 176, 104],
          ['S', 100, 183],
          ['W', 24, 104],
        ].map(([l, x, y]) => (
          <text key={l} x={x} y={y} textAnchor="middle" fontSize="10" fontFamily="Geist Mono Variable, monospace" fill={l === 'N' ? '#f2ede2' : '#a9ad9f'} letterSpacing="1">
            {l}
          </text>
        ))}
        <motion.g className="needle" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} animate={{ rotate }} transition={{ type: 'spring', stiffness: 50, damping: 13, mass: 0.9 }}>
          {/* Streamline from top (from) to bottom (to); bounding box is symmetric about centre */}
          <line x1="100" y1="36" x2="100" y2="150" stroke="#d4823d" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
          <line x1="100" y1="36" x2="100" y2="60" stroke="#d4823d" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="2 4" />
          <path d="M100 166 L91 148 L100 153 L109 148 Z" fill="#e0914c" />
          <circle cx="100" cy="36" r="2.2" fill="#d4823d" opacity="0" />
        </motion.g>
        <circle cx="100" cy="100" r="30" fill="#131a16" stroke="rgba(242,237,226,0.08)" />
      </svg>
      <div className="absolute inset-0 grid place-items-center pointer-events-none">
        <div className="text-center -mt-1">
          <div className="font-mono text-[26px] leading-none tnum">{Math.round(speed)}</div>
          <div className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-bone-600 mt-1">
            {unit} · {degToCompass(dir)}
          </div>
        </div>
      </div>
      {gust != null && gust > speed + 3 && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-[9%] font-mono text-[10px] text-bone-600 tnum">
          gusts {Math.round(gust)}
        </div>
      )}
    </div>
  )
}
