import { ArrowClockwise, ArrowUp, MapPin, SunHorizon, TrendDown, TrendUp, Wind } from '@phosphor-icons/react'
import { useMemo } from 'react'
import { moonInfo } from '../../lib/astro'
import { fmtDay, fmtHour, fmtPrecip, fmtPressureDelta, fmtSpeed, fmtTemp, fmtTime, relTime, wxCode } from '../../lib/format'
import { degToCompass } from '../../lib/geo'
import { nowIndex } from '../../lib/weather'
import { useApp } from '../AppContext'
import { WxIcon } from '../icons'
import { Button, EmptyState, InlineError, SectionLabel, Skeleton, Stat } from '../ui'
import { CountUp, Reveal } from '../motion'
import PressureChart from './PressureChart'
import WindCompass from './WindCompass'

export default function ForecastView() {
  const { home, forecast, loading, error, refresh, settings, setView } = useApp()
  const units = settings.units
  const idx = useMemo(() => (forecast ? nowIndex(forecast) : 0), [forecast])

  if (!home) {
    return (
      <Page>
        <EmptyState icon={<MapPin size={26} weight="duotone" />} title="No home ground yet" body="Wind and weather key off one spot: the ground you hunt. Set it once and every forecast, HuntCast hour and stand pick uses it." action={<Button variant="primary" onClick={() => setView('more')}>Set home ground</Button>} />
      </Page>
    )
  }

  if (!forecast) {
    return (
      <Page>
        <Header label={home.label} />
        {error ? <InlineError message={error} onRetry={refresh} /> : <ForecastSkeleton />}
      </Page>
    )
  }

  const now = forecast.hours[idx]
  const prev3 = forecast.hours[Math.max(0, idx - 3)]
  const trend = now.pressureInHg - prev3.pressureInHg
  const today = forecast.days.find((d) => d.date === now.iso.slice(0, 10)) ?? forecast.days[0]
  const moon = moonInfo(now.time, home.lat, home.lon)
  const wx = wxCode(now.code, now.isDay)
  const scentTo = degToCompass(now.windDir + 180, 8)
  const strip = forecast.hours.slice(idx, idx + 48)
  const todayKey = now.iso.slice(0, 10)
  const upcoming = forecast.days.filter((d) => d.date >= todayKey).slice(0, 7)

  return (
    <Page>
      <Header label={home.label} sub={`${forecast.elevationFt} ft · updated ${relTime(forecast.fetchedAt)}`} onRefresh={refresh} loading={loading} />
      {error && <InlineError message={`Showing the last pull. ${error}`} onRetry={refresh} />}

      {/* Now: asymmetric split, compass left, numbers right */}
      <section className="grid gap-8 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-center">
        <div className="flex items-center gap-6 md:gap-10">
          <WindCompass dir={now.windDir} speed={units === 'metric' ? now.windMph * 1.60934 : now.windMph} gust={units === 'metric' ? now.gustMph * 1.60934 : now.gustMph} unit={units === 'metric' ? 'km/h' : 'mph'} size={228} />
          <div className="min-w-0">
            <SectionLabel>Wind</SectionLabel>
            <div className="mt-1 text-2xl font-semibold tracking-tight leading-tight">
              {degToCompass(now.windDir)} <span className="font-mono text-bone-400 text-lg tnum">{fmtSpeed(now.windMph, units)}</span>
            </div>
            <p className="mt-2 text-sm text-bone-400 leading-relaxed">
              Blowing out of the {degToCompass(now.windDir, 8)}. Your scent carries <span className="text-bone-50 font-medium">{scentTo}</span>.
            </p>
            <p className="mt-1 text-[12px] text-bone-600 tnum font-mono">
              gusts {fmtSpeed(now.gustMph, units)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:border-l md:border-bone-50/8 md:pl-8">
          <div className="col-span-2 flex items-center gap-4">
            <WxIcon icon={wx.icon} isDay={now.isDay} size={44} weight="duotone" className="text-bone-200 shrink-0 float" />
            <div>
              <div className="font-mono text-4xl leading-none tnum"><CountUp value={units === 'metric' ? ((now.tempF - 32) * 5) / 9 : now.tempF} suffix={units === 'metric' ? '°C' : '°F'} /></div>
              <div className="text-sm text-bone-400 mt-1.5">
                {wx.label} · feels {fmtTemp(now.feelsF, units, false)}
              </div>
            </div>
          </div>
          <Stat
            label="Pressure"
            value={<CountUp value={units === 'metric' ? now.pressureInHg * 33.8639 : now.pressureInHg} decimals={units === 'metric' ? 0 : 2} suffix={units === 'metric' ? ' hPa' : ' inHg'} />}
            sub={
              <span className="inline-flex items-center gap-1">
                {trend > 0.015 ? <TrendUp size={13} className="text-ember-400" /> : trend < -0.015 ? <TrendDown size={13} className="text-ember-400" /> : null}
                {fmtPressureDelta(trend, units)} / 3 hr
              </span>
            }
          />
          <Stat label="Humidity" value={<CountUp value={now.humidity} suffix="%" />} sub={`dew point ${fmtTemp(now.dewF, units, false)}`} />
          <Stat label="Sun" value={`${fmtTime(today.sunrise)} – ${fmtTime(today.sunset)}`} sub="sunrise to sunset" />
          <Stat label="Moon" value={<CountUp value={moon.illumination * 100} suffix="%" />} sub={moon.name} />
        </div>
      </section>

      {/* Hourly strip */}
      <section>
        <div className="flex items-end justify-between mb-3">
          <SectionLabel>Next 48 hours</SectionLabel>
          <span className="text-[12px] text-bone-600">arrows show where the wind goes</span>
        </div>
        <div className="-mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto no-bar">
          <div className="flex gap-1 min-w-max border-t border-b border-bone-50/8 py-3">
            {strip.map((h, i) => {
              const c = wxCode(h.code, h.isDay)
              const newDay = h.time.getHours() === 0
              return (
                <div key={h.iso} className={`w-[58px] shrink-0 flex flex-col items-center gap-1.5 py-1 ${newDay ? 'border-l border-bone-50/10' : ''} ${i === 0 ? 'text-bone-50' : h.isDay ? 'text-bone-200' : 'text-bone-400'}`}>
                  <div className="font-mono text-[10.5px] text-bone-600">{i === 0 ? 'Now' : newDay ? h.time.toLocaleDateString([], { weekday: 'short' }) : fmtHour(h.time)}</div>
                  <WxIcon icon={c.icon} isDay={h.isDay} size={20} weight="duotone" />
                  <div className="font-mono text-[13px] tnum">{fmtTemp(h.tempF, units, false)}</div>
                  <ArrowUp size={14} weight="bold" className="text-ember-400" style={{ transform: `rotate(${h.windDir + 180}deg)` }} />
                  <div className="font-mono text-[10.5px] text-bone-600 tnum">{Math.round(units === 'metric' ? h.windMph * 1.60934 : h.windMph)}</div>
                  <div className={`font-mono text-[10px] tnum ${h.precipProb >= 40 ? 'text-bone-200' : 'text-transparent'}`}>{h.precipProb}%</div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Pressure */}
      <Reveal>
      <section className="grid gap-6 md:grid-cols-[2fr_1fr] md:items-start">
        <div>
          <div className="flex items-end justify-between mb-2">
            <SectionLabel>Barometer, 72 hours</SectionLabel>
            <span className="text-[12px] text-bone-600">shaded band is where deer move best</span>
          </div>
          <PressureChart hours={forecast.hours} nowIndex={idx} metric={units === 'metric'} />
        </div>
        <div className="md:pt-7 text-sm text-bone-400 leading-relaxed max-w-[42ch]">
          {trend >= 0.06 ? 'Rising fast. This is the classic behind-the-front surge: get in a stand.' : trend >= 0.02 ? 'Rising. Deer feed more as the barometer climbs.' : trend <= -0.06 ? 'Falling fast. Weather is coming and deer feed ahead of it, then hold tight when it hits.' : trend <= -0.02 ? 'Falling. Watch for the pre-storm feeding window.' : 'Steady. No pressure kicker right now; look to temperature and wind.'}
        </div>
      </section>
      </Reveal>

      {/* Days */}
      <Reveal>
      <section>
        <SectionLabel className="mb-2">This week</SectionLabel>
        <ul className="divide-y divide-bone-50/8 border-t border-b border-bone-50/8 cascade">
          {upcoming.map((d, i) => {
            const c = wxCode(d.code)
            return (
              <li key={d.date} style={{ ['--i' as string]: i }} className="grid grid-cols-[88px_28px_1fr_auto] md:grid-cols-[120px_32px_1fr_1fr_1fr_auto] items-center gap-3 py-3 text-sm">
                <div className="font-medium">{i === 0 ? 'Today' : fmtDay(d.sunrise)}</div>
                <WxIcon icon={c.icon} size={22} weight="duotone" className="text-bone-200" />
                <div className="text-bone-400 truncate">{c.label}</div>
                <div className="hidden md:flex items-center gap-1.5 text-bone-400 font-mono text-[13px] tnum">
                  <Wind size={14} /> {degToCompass(d.windDomDir, 8)} {Math.round(units === 'metric' ? d.windMaxMph * 1.60934 : d.windMaxMph)}
                </div>
                <div className="hidden md:flex items-center gap-1.5 text-bone-400 font-mono text-[13px] tnum">
                  <SunHorizon size={14} /> {fmtTime(d.sunrise)} · {fmtTime(d.sunset)}
                </div>
                <div className="font-mono tnum text-right">
                  <span className="text-bone-50">{fmtTemp(d.hiF, units, false)}</span> <span className="text-bone-600">{fmtTemp(d.loF, units, false)}</span>
                  {d.precipIn >= 0.05 && <span className="ml-3 text-[12px] text-bone-400">{fmtPrecip(d.precipIn, units)}</span>}
                </div>
              </li>
            )
          })}
        </ul>
        <p className="mt-3 text-[12px] text-bone-600">Forecast by Open-Meteo, blended from NOAA, ECMWF and DWD models. Refreshes every 30 minutes while the app is open.</p>
      </section>
      </Reveal>
    </Page>
  )
}

function Page({ children }: { children: React.ReactNode }) {
  return <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-5 md:py-8 space-y-10 pb-12">{children}</div>
}

function Header({ label, sub, onRefresh, loading }: { label: string; sub?: string; onRefresh?: () => void; loading?: boolean }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <SectionLabel>Wind and weather</SectionLabel>
        <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight">{label}</h1>
        {sub && <div className="text-[12px] text-bone-600 mt-1">{sub}</div>}
      </div>
      {onRefresh && (
        <Button size="sm" variant="ghost" onClick={onRefresh} disabled={loading} aria-label="Refresh forecast">
          <ArrowClockwise size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </Button>
      )}
    </div>
  )
}

function ForecastSkeleton() {
  return (
    <div className="space-y-10">
      <div className="grid gap-8 md:grid-cols-[1.15fr_1fr]">
        <div className="flex items-center gap-8">
          <Skeleton className="w-[228px] h-[228px] rounded-full" />
          <div className="space-y-3 flex-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-5">
          <Skeleton className="col-span-2 h-14" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      </div>
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-36 w-full" />
    </div>
  )
}
