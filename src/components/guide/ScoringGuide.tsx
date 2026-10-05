import { ArrowCounterClockwise, Copy, Ruler } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../AppContext'
import { Button } from '../ui'
import RackDiagram from './RackDiagram'
import ScrollGuide from './ScrollGuide'
import { EXAMPLE_RACK, SCORING, SCORING_STEPS } from './scoring'

export default function ScoringGuide({ onBack }: { onBack: () => void }) {
  return (
    <ScrollGuide
      meta={SCORING}
      steps={SCORING_STEPS}
      Diagram={RackDiagram}
      onBack={onBack}
      outro={{
        label: 'Score sheet',
        title: 'Your rack',
        body: 'Type each measurement in inches and eighths, 24 2/8 or 24.25 either way. Gross, differences and the typical net update as you go. It stays on this device until you clear it.',
        children: <ScoreSheet />,
      }}
    />
  )
}

// ---------- the sheet ----------

type Side = 'L' | 'R'
type Measure = 'F' | 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'H1' | 'H2' | 'H3' | 'H4'
const MEASURES: Array<[Measure, string]> = [
  ['F', 'Main beam'],
  ['G1', 'Brow tine'],
  ['G2', 'Tine 2'],
  ['G3', 'Tine 3'],
  ['G4', 'Tine 4'],
  ['G5', 'Tine 5'],
  ['H1', 'Circ. 1'],
  ['H2', 'Circ. 2'],
  ['H3', 'Circ. 3'],
  ['H4', 'Circ. 4'],
]
type Sheet = Record<string, string>
const KEY = 'rutline.guide.score.v1'

/** "24 2/8", "24-2", "24.25", "24" → inches as a number, or null. */
export function parseInches(s: string): number | null {
  const t = s.trim().replace(/"/g, '')
  if (!t) return null
  let m = /^(\d+)(?:[ -](\d)(?:\/8)?)?$/.exec(t)
  if (m) return Number(m[1]) + (m[2] ? Number(m[2]) / 8 : 0)
  m = /^(\d)\/8$/.exec(t)
  if (m) return Number(m[1]) / 8
  const n = Number(t)
  if (Number.isFinite(n)) return Math.round(n * 8) / 8
  return null
}

export function fmtEighths(n: number): string {
  const total = Math.round(n * 8)
  const whole = Math.floor(total / 8)
  const e = total - whole * 8
  return `${whole} ${e}/8`
}

export function scoreSheet(sheet: Sheet) {
  const v = (k: string) => parseInches(sheet[k] ?? '') ?? 0
  const sideSum = (s: Side) => MEASURES.reduce((acc, [m]) => acc + v(`${s}.${m}`), 0)
  const L = sideSum('L')
  const R = sideSum('R')
  const diffs = MEASURES.map(([m]) => Math.abs(v(`L.${m}`) - v(`R.${m}`)))
  const diff = diffs.reduce((a, b) => a + b, 0)
  const longest = Math.max(v('L.F'), v('R.F'))
  const spread = v('spread')
  const credit = longest > 0 ? Math.min(spread, longest) : spread
  const abnormal = v('abnormal')
  const gross = L + R + credit + abnormal
  const net = gross - diff - abnormal
  return { L, R, diffs, diff, credit, spread, abnormal, gross, net, any: L + R + spread + abnormal > 0 }
}

function ScoreSheet() {
  const { toast } = useApp()
  const [sheet, setSheet] = useState<Sheet>(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Sheet
    } catch {
      return {}
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(sheet))
    } catch {
      /* ignore */
    }
  }, [sheet])

  const r = useMemo(() => scoreSheet(sheet), [sheet])
  const set = (k: string, val: string) => setSheet((s) => ({ ...s, [k]: val }))

  function loadExample() {
    const next: Sheet = { spread: EXAMPLE_RACK.spread, abnormal: EXAMPLE_RACK.abnormal }
    for (const side of ['L', 'R'] as const) for (const [m, val] of Object.entries(EXAMPLE_RACK[side])) next[`${side}.${m}`] = val
    setSheet(next)
  }

  async function copy() {
    const lines = [
      `Rutline green score (B&C typical)`,
      ...MEASURES.filter(([m]) => sheet[`L.${m}`] || sheet[`R.${m}`]).map(([m, label]) => `${m} ${label}: L ${sheet[`L.${m}`] || '-'} · R ${sheet[`R.${m}`] || '-'}`),
      `Inside spread: ${sheet.spread || '-'} (credit ${fmtEighths(r.credit)})`,
      `Abnormal points: ${sheet.abnormal || '-'}`,
      `Left ${fmtEighths(r.L)} · Right ${fmtEighths(r.R)} · Differences ${fmtEighths(r.diff)}`,
      `Gross ${fmtEighths(r.gross)} · Net typical ${fmtEighths(r.net)}`,
    ]
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      toast('Score copied')
    } catch {
      toast('Could not copy on this device')
    }
  }

  const cell = 'h-10 w-full px-2.5 rounded-lg bg-pine-900 border border-bone-50/10 text-bone-50 font-mono text-[13px] tnum outline-none focus:border-ember-500/60 placeholder:text-bone-800'

  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_56px] gap-x-2 gap-y-1.5 items-center">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-bone-600">Measure</div>
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-bone-600">Left</div>
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-bone-600">Right</div>
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-bone-600 text-right">Diff</div>
        {MEASURES.map(([m, label], i) => (
          <div key={m} className="contents">
            <label htmlFor={`sc-L-${m}`} className="min-w-0 leading-tight">
              <span className="font-mono text-[12px] text-bone-50">{m}</span>
              <span className="block text-[11px] text-bone-600 truncate">{label}</span>
            </label>
            <input id={`sc-L-${m}`} className={cell} inputMode="decimal" placeholder="0 0/8" value={sheet[`L.${m}`] ?? ''} onChange={(e) => set(`L.${m}`, e.target.value)} aria-label={`Left ${label}`} />
            <input className={cell} inputMode="decimal" placeholder="0 0/8" value={sheet[`R.${m}`] ?? ''} onChange={(e) => set(`R.${m}`, e.target.value)} aria-label={`Right ${label}`} />
            <div className={`text-right font-mono text-[12px] tnum ${r.diffs[i] > 0 ? 'text-ember-300' : 'text-bone-800'}`}>{r.diffs[i] > 0 ? fmtEighths(r.diffs[i]) : '·'}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-bone-600">Inside spread</span>
          <input className={cell} inputMode="decimal" placeholder="0 0/8" value={sheet.spread ?? ''} onChange={(e) => set('spread', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-bone-600">Abnormal points, total</span>
          <input className={cell} inputMode="decimal" placeholder="0 0/8" value={sheet.abnormal ?? ''} onChange={(e) => set('abnormal', e.target.value)} />
        </label>
      </div>

      <div className="mt-6 rounded-2xl border border-bone-50/8 bg-pine-900/60 p-4 md:p-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-bone-600">Gross</div>
            <div className="mt-1 font-mono text-[28px] leading-none tnum text-bone-50">{r.any ? fmtEighths(r.gross) : '—'}</div>
          </div>
          <div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-bone-600">Net typical</div>
            <div className="mt-1 font-mono text-[28px] leading-none tnum text-ember-400">{r.any ? fmtEighths(r.net) : '—'}</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] text-bone-400 font-mono tnum">
          <span>Left {fmtEighths(r.L)}</span>
          <span>Right {fmtEighths(r.R)}</span>
          <span>Spread credit {fmtEighths(r.credit)}</span>
          <span>Differences −{fmtEighths(r.diff)}</span>
          <span className="col-span-2">Abnormal −{fmtEighths(r.abnormal)} from the net</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={loadExample}>
          <Ruler size={16} weight="bold" /> Load the example rack
        </Button>
        <Button variant="secondary" onClick={copy} disabled={!r.any}>
          <Copy size={16} weight="bold" /> Copy score
        </Button>
        <Button variant="ghost" onClick={() => setSheet({})} disabled={!r.any}>
          <ArrowCounterClockwise size={16} weight="bold" /> Clear
        </Button>
      </div>
    </div>
  )
}
