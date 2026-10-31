import { DIRS8, degToCompass } from '../../lib/geo'

const R = 64
const S = 2 * R + 48
const C = S / 2

/**
 * Eight-point ring. Tap the directions the wind can blow FROM and still hunt
 * this spot. The wind right now crosses the rose as an arrow: it starts under
 * the direction it blows from and points where it carries, like the compass.
 */
export default function WindPicker({ value, onChange, windDir }: { value: string[]; onChange: (v: string[]) => void; windDir?: number }) {
  const toggle = (d: string) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d])
  return (
    <div className="w-full">
      <div className="relative mx-auto" style={{ width: S, height: S }}>
        <div className="absolute inset-6 rounded-full border border-bone-50/8" />
        {windDir != null && (
          <svg className="absolute inset-0 pointer-events-none" width={S} height={S} viewBox={`0 0 ${S} ${S}`} role="img" aria-label={`Wind now from ${degToCompass(windDir)}`}>
            <defs>
              <marker id="wind-head" markerWidth="12" markerHeight="12" refX="6" refY="6" orient="auto" markerUnits="userSpaceOnUse">
                <path d="M1 1 L11 6 L1 11 Z" fill="#f08a3f" />
              </marker>
            </defs>
            {/* Drawn as "from north" and rotated by the from-bearing */}
            <g transform={`rotate(${windDir} ${C} ${C})`} stroke="#f08a3f" strokeLinecap="round" fill="none">
              <line x1={C} y1={C - R + 14} x2={C} y2={C + R - 22} strokeWidth="3" markerEnd="url(#wind-head)" />
              <line x1={C - 9} y1={C - R + 20} x2={C - 9} y2={C - R + 46} strokeWidth="1.5" opacity="0.4" />
              <line x1={C + 9} y1={C - R + 16} x2={C + 9} y2={C - R + 50} strokeWidth="1.5" opacity="0.4" />
            </g>
          </svg>
        )}
        {DIRS8.map((d, i) => {
          const a = ((i * 45 - 90) * Math.PI) / 180
          const x = C + R * Math.cos(a)
          const y = C + R * Math.sin(a)
          const on = value.includes(d)
          return (
            <button
              key={d}
              type="button"
              onClick={() => toggle(d)}
              aria-pressed={on}
              className={`push absolute -translate-x-1/2 -translate-y-1/2 w-11 h-11 rounded-full text-[12px] font-mono font-medium border transition-colors ${on ? 'bg-ember-500 text-ember-950 border-ember-300/40' : 'bg-pine-900 text-bone-400 border-bone-50/10 hover:text-bone-50'}`}
              style={{ left: x, top: y }}
            >
              {d}
            </button>
          )
        })}
      </div>
      <div className="mt-1.5 text-center text-[11px] font-mono text-bone-600 whitespace-nowrap">
        {value.length ? `${value.length} wind${value.length === 1 ? '' : 's'} picked` : 'tap the winds you can hunt'}
        {windDir != null && <span className="text-ember-400"> · now from {degToCompass(windDir)}</span>}
      </div>
    </div>
  )
}
