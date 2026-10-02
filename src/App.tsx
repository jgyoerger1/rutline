import { AnimatePresence, motion } from 'framer-motion'
import { MapTrifold, PawPrint, Scan, SlidersHorizontal, Wind } from '@phosphor-icons/react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { AppCtx, useApp, type AppState, type View } from './components/AppContext'
import Onboarding from './components/Onboarding'
import MapView from './components/map/MapView'
import { PageTransition, Splash, TopoBackdrop, Wordmark } from './components/motion'
import { scoreForecast } from './lib/huntcast'
import { parsePeakOverride } from './lib/rut'
import { useSettings } from './lib/settings'
import { useForecast } from './lib/weather'

const ForecastView = lazy(() => import('./components/weather/ForecastView'))
const HuntCastView = lazy(() => import('./components/huntcast/HuntCastView'))
const TrackerView = lazy(() => import('./components/tracker/TrackerView'))
const MoreView = lazy(() => import('./components/more/MoreView'))

const VIEWS: Array<{ id: View; label: string; Icon: typeof MapTrifold }> = [
  { id: 'map', label: 'Map', Icon: MapTrifold },
  { id: 'forecast', label: 'Wind', Icon: Wind },
  { id: 'huntcast', label: 'Predict', Icon: PawPrint },
  { id: 'tracker', label: 'Track', Icon: Scan },
  { id: 'more', label: 'More', Icon: SlidersHorizontal },
]

function readHash(): View {
  const h = location.hash.replace(/^#\/?/, '').split('/')[0] as View
  return VIEWS.some((v) => v.id === h) ? h : 'map'
}

export default function App() {
  const [settings, setSettings] = useSettings()
  const home = settings.home
  const { forecast, loading, error, refresh } = useForecast(home?.lat ?? null, home?.lon ?? null)
  const [view, setViewState] = useState<View>(readHash)
  const [toasts, setToasts] = useState<Array<{ id: number; message: string }>>([])
  const [focusRequest, setFocusRequest] = useState<number | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(() => !settings.home)

  useEffect(() => {
    const onHash = () => setViewState(readHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const setView = useCallback((v: View) => {
    location.hash = `/${v}`
    setViewState(v)
  }, [])

  const toast = useCallback((message: string) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, message }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800)
  }, [])

  const peak = useMemo(() => (home ? parsePeakOverride(settings.rutPeakOverride, home.lat, home.lon, new Date()) : null), [home, settings.rutPeakOverride])

  const days = useMemo(() => {
    if (!forecast || !home || !peak) return []
    return scoreForecast(forecast, { lat: home.lat, lon: home.lon, peakRut: peak.date, legalLightMinutes: settings.legalLightMinutes })
  }, [forecast, home, peak, settings.legalLightMinutes])

  const focusWaypoint = useCallback(
    (id: number) => {
      setFocusRequest(id)
      setView('map')
    },
    [setView],
  )

  const state: AppState = {
    settings,
    setSettings,
    home,
    forecast,
    loading,
    error,
    refresh,
    days,
    peak,
    view,
    setView,
    toast,
    focusWaypoint,
    focusRequest,
    clearFocus: () => setFocusRequest(null),
  }

  return (
    <AppCtx.Provider value={state}>
      <div className="h-[100dvh] flex flex-col md:flex-row bg-pine-950">
        {/* Desktop rail */}
        <aside className="hidden md:flex w-[92px] shrink-0 flex-col items-center border-r border-pine-700 bg-pine-900/60 pt-4 pb-6">
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => setView('map')} className="rounded-2xl overflow-hidden w-12 h-12 border border-bone-50/10 shadow-pine" aria-label="Rutline home">
            <img src="icons/icon-192.png" alt="" className="w-full h-full object-cover" />
          </motion.button>
          <nav className="mt-8 flex flex-col gap-1 w-full px-3" aria-label="Primary">
            {VIEWS.map(({ id, label, Icon }) => {
              const active = view === id
              return (
                <motion.button
                  key={id}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setView(id)}
                  className={`relative flex flex-col items-center gap-1 rounded-xl py-2.5 text-[11px] font-medium tracking-wide transition-colors ${active ? 'text-bone-50' : 'text-bone-600 hover:text-bone-200'}`}
                  aria-current={active ? 'page' : undefined}
                >
                  {active && <motion.span layoutId="rail-active" className="absolute inset-0 rounded-xl bg-pine-700/70 border border-bone-50/8" transition={{ type: 'spring', stiffness: 300, damping: 30 }} />}
                  <Icon size={22} weight={active ? 'fill' : 'regular'} className="relative" />
                  <span className="relative">{label}</span>
                </motion.button>
              )
            })}
          </nav>
          <div className="mt-auto">
            <StatusDot />
          </div>
        </aside>

        <main className="relative flex-1 min-w-0 min-h-0 flex flex-col">
          {/* Mobile top bar */}
          <header className="md:hidden shrink-0 pt-safe bg-pine-950/90 backdrop-blur border-b border-pine-700">
            <div className="h-12 px-4 flex items-center gap-3">
              <img src="icons/icon-192.png" alt="" className="w-7 h-7 rounded-lg border border-bone-50/10" />
              <Wordmark className="text-[17px]" />
              <span className="ml-auto text-xs text-bone-600 truncate max-w-[42%]">{home?.label ?? 'No home ground'}</span>
              <StatusDot />
            </div>
          </header>

          <div className="relative flex-1 min-h-0">
            <div className={view === 'map' ? 'absolute inset-0' : 'absolute inset-0 invisible pointer-events-none'} aria-hidden={view !== 'map'}>
              <MapView active={view === 'map'} />
            </div>
            {view !== 'map' && (
              <>
                <TopoBackdrop />
                <div className="absolute inset-0 overflow-y-auto overscroll-contain">
                  <Suspense fallback={<ViewSkeleton />}>
                    <PageTransition id={view}>
                      {view === 'forecast' && <ForecastView />}
                      {view === 'huntcast' && <HuntCastView />}
                      {view === 'tracker' && <TrackerView />}
                      {view === 'more' && <MoreView />}
                    </PageTransition>
                  </Suspense>
                </div>
              </>
            )}
          </div>

          {/* Mobile tab bar */}
          <nav className="md:hidden shrink-0 glass border-t border-bone-50/8 pb-safe" aria-label="Primary">
            <div className="grid grid-cols-5 h-16">
              {VIEWS.map(({ id, label, Icon }) => {
                const active = view === id
                return (
                  <motion.button key={id} whileTap={{ scale: 0.9 }} onClick={() => setView(id)} className={`relative flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium ${active ? 'text-ember-400' : 'text-bone-600'}`} aria-current={active ? 'page' : undefined}>
                    {active && <motion.span layoutId="tab-active" className="absolute top-1.5 w-9 h-1 rounded-full bg-ember-500" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
                    <Icon size={22} weight={active ? 'fill' : 'regular'} />
                    {label}
                  </motion.button>
                )
              })}
            </div>
          </nav>
        </main>
      </div>

      <AnimatePresence>{showOnboarding && <Onboarding onDone={() => setShowOnboarding(false)} />}</AnimatePresence>
      <Splash />

      <div className="fixed left-1/2 -translate-x-1/2 bottom-24 md:bottom-8 z-[70] flex flex-col gap-2 items-center pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.98 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }} className="glass rounded-full px-4 py-2 text-sm text-bone-50">
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="grain" aria-hidden />
    </AppCtx.Provider>
  )
}

function StatusDot() {
  const { forecast, loading, error, home } = useApp()
  const fresh = forecast && Date.now() - forecast.fetchedAt < 40 * 60 * 1000
  const label = !home ? 'No location' : error ? 'Weather offline' : loading ? 'Updating' : fresh ? 'Live' : 'Stale'
  const tone = !home ? 'bg-bone-800' : error ? 'bg-ember-600' : fresh ? 'bg-bone-50' : 'bg-ember-400'
  return (
    <span className="relative inline-flex items-center justify-center w-6 h-6" title={label} aria-label={`Weather status: ${label}`}>
      <span className={`absolute w-2 h-2 rounded-full ${tone} ${fresh && !error ? 'breathe' : ''}`} />
      <span className={`w-2 h-2 rounded-full ${tone}`} />
    </span>
  )
}

function ViewSkeleton() {
  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 md:px-8 space-y-4">
      <div className="skeleton h-7 w-48" />
      <div className="skeleton h-40 w-full" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="skeleton h-20" />
        <div className="skeleton h-20" />
        <div className="skeleton h-20" />
        <div className="skeleton h-20" />
      </div>
    </div>
  )
}
