import { GpsFix, MagnifyingGlass } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { locate, reverseGeocode, searchPlaces, type Place } from '../lib/geo'
import type { HomeGround } from '../lib/types'
import { Button, Input } from './ui'

export default function HomePicker({ onPick, compact = false }: { onPick: (home: HomeGround) => void; compact?: boolean }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [searching, setSearching] = useState(false)
  const timer = useRef<number | null>(null)

  async function useGps() {
    setBusy(true)
    setError(null)
    try {
      const p = await locate()
      const lat = p.coords.latitude
      const lon = p.coords.longitude
      const label = (await reverseGeocode(lat, lon)) ?? `${lat.toFixed(3)}, ${lon.toFixed(3)}`
      onPick({ lat, lon, label })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not get a fix.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current)
    if (q.trim().length < 2) {
      setResults([])
      return
    }
    timer.current = window.setTimeout(async () => {
      setSearching(true)
      try {
        setResults(await searchPlaces(q.trim()))
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Search failed.')
      } finally {
        setSearching(false)
      }
    }, 350)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [q])

  return (
    <div className="space-y-3">
      <Button variant="primary" size={compact ? 'md' : 'lg'} className="w-full" onClick={useGps} disabled={busy}>
        <GpsFix size={18} weight="bold" />
        {busy ? 'Getting a fix' : 'Use my location'}
      </Button>
      <div className="relative">
        <MagnifyingGlass size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-bone-600" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Or search a town: Kent, Ohio" className="pl-10" autoComplete="off" />
      </div>
      {searching && <div className="skeleton h-10" />}
      {!searching && results.length > 0 && (
        <ul className="divide-y divide-bone-50/8 rounded-xl border border-bone-50/8 overflow-hidden">
          {results.map((r) => (
            <li key={`${r.lat},${r.lon}`}>
              <button onClick={() => onPick({ lat: r.lat, lon: r.lon, label: [r.name, r.admin1].filter(Boolean).join(', ') })} className="push w-full text-left px-4 py-3 hover:bg-pine-800/70 transition-colors">
                <div className="text-sm font-medium">{r.name}</div>
                <div className="text-[12px] text-bone-600">{[r.admin1, r.country].filter(Boolean).join(', ')}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <div className="text-[13px] text-ember-400">{error}</div>}
    </div>
  )
}
