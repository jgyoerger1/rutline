import { AnimatePresence, motion } from 'framer-motion'
import { CaretDown, MapPin } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { TIERS, type DayScore, type HourScore } from '../../lib/huntcast'
import { fmtHour, fmtTemp, fmtTime, wxCode } from '../../lib/format'
import { degToCompass } from '../../lib/geo'
import { useApp } from '../AppContext'
import { WxIcon } from '../icons'
import { Button, EmptyState, InlineError, SectionLabel, Skeleton } from '../ui'
import { CountUp, Reveal } from '../motion'
import HoofIcon from '../HoofIcon'
import Explain from './Explain'
import HourBars, { TIER_TEXT } from './HourBars'
import RutRibbon from './RutRibbon'
import StandPicks from './StandPicks'

export default function HuntCastView() {
  const { home, forecast, days, error, refresh, settings, peak, setView } = useApp()
  const todayKey = new Date().toISOString().slice(0, 10)
  const upcoming = useMemo(() => {
    const localToday = localKey(new Date())
    return days.filter((d) => d.date >= localToday).slice(0, 7)
  }, [days])
  const [dayKey, setDayKey] = useState<string | null>(null)
  const day = upcoming.find((d) => d.date === dayKey) ?? upcoming[0] ?? null
  const [hour, setHour] = useState<HourScore | null>(null)
  const [showExplain, setShowExplain] = useState(false)

  // Default the selected hour: the current hour today, otherwise the day's best
  useEffect(() => {
    if (!day) return
    if (hour && day.hours.some((h) => h.index === hour.index)) return
    const nowMs = Date.now()
    const isToday = day.date === localKey(new Date())
    const current = isToday ? day.hours.find((h) => nowMs >= h.time.getTime() && nowMs < h.time.getTime() + 3600000) : null
    const pick = current && current.legal ? current : [day.morning, day.evening, day.midday].filter(Boolean).sort((a, b) => b!.score - a!.score)[0] ?? day.hours[12]
    setHour(pick ?? null)
  }, [day, hour])

  if (!home) {
    return (
      <Page>
        <EmptyState icon={<MapPin size={26} weight="duotone" />} title="HuntCast needs your home ground" body="The movement index is built from the hour-by-hour forecast at one spot. Set the ground you hunt and this page fills in." action={<Button variant="primary" onClick={() => setView('more')}>Set home ground</Button>} />
      </Page>
    )
  }
  if (!forecast || !day || !peak) {
    return (
      <Page>
        <Heading />
        {error ? <InlineError message={error} onRetry={refresh} /> : <HcSkeleton />}
      </Page>
    )
  }

  void todayKey
  const units = settings.units
  const sel = hour && day.hours.some((h) => h.index === hour.index) ? hour : day.hours[12]
  const ups = sel.factors.filter((f) => f.points > 0)
  const downs = sel.factors.filter((f) => f.points < 0)
  const wx = wxCode(sel.hour.code, sel.hour.isDay)

  return (
    <Page>
      <Heading sub={home.label} />

      {/* Day strip */}
      <div className="-mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto no-bar">
        <div className="flex gap-2 min-w-max cascade">
          {upcoming.map((d, i) => {
            const active = d.date === day.date
            return (
              <button
                key={d.date}
                style={{ ['--i' as string]: i }}
                onClick={() => {
                  setDayKey(d.date)
                  setHour(null)
                }}
                className={`push w-[104px] md:w-[124px] shrink-0 rounded-2xl px-3 py-3 text-left border transition-colors ${active ? 'bg-pine-800 border-bone-50/15' : 'bg-pine-900/50 border-bone-50/6 hover:border-bone-50/12'}`}
                aria-pressed={active}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-mono uppercase tracking-wider text-bone-600">{i === 0 ? 'Today' : d.dayDate.toLocaleDateString([], { weekday: 'short' })}</div>
                    <div className="text-sm font-medium mt-0.5">{d.dayDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}</div>
                  </div>
                  <ScoreRing score={d.score} />
                </div>
                <div className={`mt-2 text-[12px] font-medium ${TIER_TEXT[d.tier]}`}>{TIERS[d.tier].label}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Day summary + hour bars */}
      <section className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-baseline gap-3">
                <CountUp value={day.score} className="font-mono text-5xl leading-none tnum" />
                <span className={`text-lg font-semibold ${TIER_TEXT[day.tier]}`}>{TIERS[day.tier].label}</span>
              </div>
              <p className="mt-2 text-sm text-bone-200 leading-relaxed max-w-[56ch]">{day.headline}</p>
            </div>
            <div className="text-right text-[12px] text-bone-600 font-mono tnum shrink-0 leading-5">
              <div>sun {fmtTime(day.sunrise)}</div>
              <div>set {fmtTime(day.sunset)}</div>
              <div>moon {Math.round(day.moon.illumination * 100)}%</div>
            </div>
          </div>

          <div className="mt-6">
            <HourBars day={day} selected={sel} onSelect={setHour} legalMinutes={settings.legalLightMinutes} />
          </div>

          <div className="mt-2 grid grid-cols-3 gap-3 border-t border-bone-50/8 pt-4">
            {[
              ['Morning', day.morning],
              ['Midday', day.midday],
              ['Evening', day.evening],
            ].map(([label, h]) => {
              const hs = h as HourScore | null
              return (
                <button key={label as string} disabled={!hs} onClick={() => hs && setHour(hs)} className="push text-left rounded-xl px-3 py-2 -mx-1 hover:bg-pine-800/50 transition-colors disabled:opacity-50">
                  <SectionLabel>{label as string}</SectionLabel>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-mono text-xl tnum">{hs ? hs.score : '–'}</span>
                    <span className="text-[12px] text-bone-400">{hs ? fmtHour(hs.time) : 'none'}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected hour */}
        <AnimatePresence mode="wait">
          <motion.div key={sel.index} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ type: 'spring', stiffness: 220, damping: 26 }} className="lg:border-l lg:border-bone-50/8 lg:pl-8">
            <div className="flex items-center justify-between">
              <div>
                <SectionLabel>{fmtHour(sel.time)}</SectionLabel>
                <div className="mt-1 flex items-baseline gap-2">
                  <CountUp value={sel.score} className="font-mono text-3xl tnum" duration={0.8} />
                  <span className={`text-sm font-semibold ${TIER_TEXT[sel.tier]}`}>{TIERS[sel.tier].label}</span>
                </div>
              </div>
              <div className="text-right text-[12px] text-bone-400 font-mono tnum leading-5">
                <div className="inline-flex items-center gap-1.5">
                  <WxIcon icon={wx.icon} isDay={sel.hour.isDay} size={14} /> {fmtTemp(sel.hour.tempF, units)}
                </div>
                <div>
                  {degToCompass(sel.hour.windDir)} {Math.round(units === 'metric' ? sel.hour.windMph * 1.60934 : sel.hour.windMph)} {units === 'metric' ? 'km/h' : 'mph'}
                </div>
                <div>{sel.hour.pressureInHg.toFixed(2)} inHg</div>
              </div>
            </div>
            <p className="mt-3 text-sm text-bone-200 leading-relaxed">{sel.summary}</p>

            <div className="mt-5 grid gap-5">
              <FactorList title="Kickers" items={ups} positive />
              <FactorList title="Drags" items={downs} />
              <div className="text-[12px] text-bone-600">
                Base {sel.base} from time of day · rut ×{sel.rut.meta.multiplier.toFixed(2)}
                {sel.night ? ' · after dark ×0.3' : !sel.legal ? ' · outside legal light ×0.6' : ''}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </section>

      {/* Stand picks + rut */}
      <Reveal>
      <section className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <StandPicks windDir={sel.hour.windDir} windMph={sel.hour.windMph} />
        <div>
          <div className="flex items-center justify-between mb-2">
            <SectionLabel>Rut phase</SectionLabel>
            <button onClick={() => setView('more')} className="text-[12px] text-bone-600 hover:text-bone-200 underline underline-offset-4 decoration-bone-50/20">
              {peak.confidence === 'low' ? 'Set your peak date' : 'Change peak date'}
            </button>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-lg font-semibold tracking-tight">{day.rut.meta.label}</span>
            <span className="font-mono text-[12px] text-bone-600 tnum">
              {day.rut.daysToPeak > 0 ? `${day.rut.daysToPeak} days to peak` : day.rut.daysToPeak === 0 ? 'peak breeding' : `${-day.rut.daysToPeak} days past peak`}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-bone-400 leading-relaxed">{day.rut.meta.tactic}</p>
          <div className="mt-4">
            <RutRibbon peak={peak.date} today={day.dayDate} current={day.rut.phase} />
          </div>
          <p className="mt-2 text-[12px] text-bone-600 leading-relaxed">{peak.reason}</p>
        </div>
      </section>
      </Reveal>

      <section className="border-t border-bone-50/8 pt-5">
        <button onClick={() => setShowExplain((v) => !v)} className="push flex items-center gap-2 text-sm font-medium text-bone-200 hover:text-bone-50" aria-expanded={showExplain}>
          <HoofIcon size={16} weight="fill" className="text-ember-400" />
          How HuntCast scores an hour
          <CaretDown size={14} className={`transition-transform ${showExplain ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence initial={false}>
          {showExplain && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 28 }} className="overflow-hidden">
              <div className="pt-5">
                <Explain />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </Page>
  )
}

function localKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function FactorList({ title, items, positive = false }: { title: string; items: HourScore['factors']; positive?: boolean }) {
  return (
    <div>
      <SectionLabel className="mb-1.5">{title}</SectionLabel>
      {items.length === 0 ? (
        <div className="text-[13px] text-bone-600">{positive ? 'Nothing working for you this hour.' : 'Nothing working against you.'}</div>
      ) : (
        <ul className="divide-y divide-bone-50/8 border-t border-b border-bone-50/8 cascade">
          {items.map((f, i) => (
            <li key={f.key} style={{ ['--i' as string]: i }} className="flex items-start gap-3 py-2">
              <span className={`font-mono text-[13px] tnum w-9 shrink-0 ${positive ? 'text-ember-400' : 'text-bone-400'}`}>
                {f.points > 0 ? '+' : ''}
                {f.points}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium">{f.label}</div>
                <div className="text-[12px] text-bone-600 leading-relaxed">{f.detail}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ScoreRing({ score }: { score: number }) {
  const r = 15
  const c = 2 * Math.PI * r
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden>
      <circle cx="20" cy="20" r={r} stroke="rgba(242,237,226,0.08)" strokeWidth="3" fill="none" />
      <motion.circle cx="20" cy="20" r={r} stroke="#e8702c" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - score / 100) }} transition={{ type: 'spring', stiffness: 60, damping: 16 }} transform="rotate(-90 20 20)" />
      <text x="20" y="24" textAnchor="middle" fontSize="11" fontFamily="Geist Mono Variable, monospace" fill="#f2ede2">
        {score}
      </text>
    </svg>
  )
}

function Page({ children }: { children: React.ReactNode }) {
  return <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-5 md:py-8 space-y-8 pb-12">{children}</div>
}

function Heading({ sub }: { sub?: string }) {
  return (
    <div>
      <SectionLabel>HuntCast</SectionLabel>
      <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight">When deer are on their feet</h1>
      {sub && <div className="text-[12px] text-bone-600 mt-1">{sub}</div>}
    </div>
  )
}

function HcSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="w-[104px] h-[92px] rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <Skeleton className="h-12 w-40" />
          <Skeleton className="h-44 w-full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  )
}

export type { DayScore }
