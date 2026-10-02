import { DIRS8 } from '../../lib/geo'

/** Eight-point ring. Tap the directions the wind can blow FROM and still hunt this spot. */
export default function WindPicker({ value, onChange, windDir }: { value: string[]; onChange: (v: string[]) => void; windDir?: number }) {
  const toggle = (d: string) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d])
  const R = 64
  return (
    <div className="relative mx-auto" style={{ width: 2 * R + 48, height: 2 * R + 48 }}>
      <div className="absolute inset-6 rounded-full border border-bone-50/8" />
      {windDir != null && (
        <div className="absolute left-1/2 top-1/2 w-px h-[52px] bg-ember-400/60 origin-bottom" style={{ transform: `translate(-50%, -100%) rotate(${windDir}deg)` }} title="Current wind from" />
      )}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-[10px] font-mono text-bone-600 leading-tight w-20">
        {value.length ? `${value.length} wind${value.length === 1 ? '' : 's'}` : 'tap winds'}
      </div>
      {DIRS8.map((d, i) => {
        const a = ((i * 45 - 90) * Math.PI) / 180
        const x = R + 24 + R * Math.cos(a)
        const y = R + 24 + R * Math.sin(a)
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
  )
}
