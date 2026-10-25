import { Check, Lock } from '@phosphor-icons/react'
import { PRO_PRICE, proUntilLabel, useProState } from '../../lib/pro'
import { useApp } from '../AppContext'
import { Button } from '../ui'

/** Settings → Rutline Pro: where it stands and the way in */
export default function ProSection() {
  const { openPro } = useApp()
  const s = useProState()
  return (
    <div className="flex items-start gap-3">
      <span className={`mt-0.5 shrink-0 w-8 h-8 rounded-lg grid place-items-center ${s.pro ? 'bg-ember-500/15 text-ember-400' : 'bg-pine-800 text-bone-500'}`}>{s.pro ? <Check size={16} weight="bold" /> : <Lock size={16} />}</span>
      <div className="flex-1 min-w-0">
        {s.pro ? (
          <>
            <div className="text-sm text-bone-50">{s.until ? `Pro is on until ${proUntilLabel(s.until)}.` : 'Everything is unlocked in this preview build.'}</div>
            <div className="mt-0.5 text-[12.5px] text-bone-500">Terrain, unlimited tracking, the full week, Trophy Center, the whole guide and camps.</div>
          </>
        ) : (
          <>
            <div className="text-sm text-bone-50">Free, with Pro waiting: {PRO_PRICE} a season.</div>
            <div className="mt-0.5 text-[12.5px] text-bone-500">LiDAR terrain, unlimited blood tracking, seven days of HuntCast, Trophy Center, the whole field guide and camps.</div>
          </>
        )}
        <Button variant={s.pro ? 'secondary' : 'primary'} size="sm" className="mt-3" onClick={() => openPro('all')}>
          {s.pro ? 'Your season pass' : 'See Rutline Pro'}
        </Button>
      </div>
    </div>
  )
}
