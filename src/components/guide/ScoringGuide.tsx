import { ArrowCounterClockwise, Camera, Copy, Ruler } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { MEASURES, fmtEighths, scoreSheet, type Sheet } from '../../lib/score'
import RackMeasure from './RackMeasure'
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

const KEY = 'rutline.guide.score.v1'

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
  const [measuring, setMeasuring] = useState(false)
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

      {measuring && (
        <RackMeasure
          onClose={() => setMeasuring(false)}
          onApply={(vals) => {
            setSheet((s) => ({ ...s, ...vals }))
            setMeasuring(false)
            toast(`${Object.keys(vals).length} measurements added to the sheet`)
          }}
        />
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => setMeasuring(true)}>
          <Camera size={16} weight="bold" /> Measure from a photo
        </Button>
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
