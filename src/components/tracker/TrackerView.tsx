import { AnimatePresence, motion } from 'framer-motion'
import { CameraSlash, DropHalf, Eye, Flashlight, Image, MapPin, Pause, Play, Scan, X } from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { addPhotoBlob, addWaypoint } from '../../lib/db'
import { locate } from '../../lib/geo'
import type { TrackerColor, TrackerMode } from '../../lib/types'
import { useApp } from '../AppContext'
import { Button, EmptyState, SectionLabel, Segmented } from '../ui'

/**
 * Blood light. Every frame is pushed through a red-isolation pass: pixels whose
 * hue sits in the blood band with enough chroma and brightness are painted in
 * the highlight colour; everything else drops to dim grayscale. Three
 * sensitivities mirror the field modes hunters already know: Low for fresh
 * bright blood with few false hits, High for darker drying blood, Soil for
 * old blood worked into dirt and sand (expect false hits on red leaves).
 */
const MODES: Record<TrackerMode, { hueTol: number; satMin: number; valMin: number; chromaMin: number; label: string; hint: string }> = {
  low: { hueTol: 12, satMin: 0.55, valMin: 80, chromaMin: 62, label: 'Low', hint: 'Fresh blood, fewest false hits' },
  high: { hueTol: 18, satMin: 0.42, valMin: 46, chromaMin: 40, label: 'High', hint: 'Fresh plus darker, drying blood' },
  soil: { hueTol: 24, satMin: 0.32, valMin: 36, chromaMin: 28, label: 'Soil', hint: 'Old blood in dirt and sand, may false trigger' },
}

const COLORS: Record<TrackerColor, [number, number, number]> = {
  red: [255, 48, 48],
  yellow: [255, 226, 70],
  green: [84, 255, 120],
}

const WORK_W = 400
const ALERT_PIXELS = 36

type Status = 'idle' | 'starting' | 'live' | 'frozen' | 'photo' | 'error'

export default function TrackerView() {
  const { settings, setSettings, toast } = useApp()
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [hits, setHits] = useState(0)
  const [torch, setTorch] = useState<{ available: boolean; on: boolean }>({ available: false, on: false })
  const [peek, setPeek] = useState(false)
  const [marking, setMarking] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const workRef = useRef<HTMLCanvasElement | null>(null)
  const maskRef = useRef<Uint8Array | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef(0)
  const photoRef = useRef<ImageBitmap | HTMLImageElement | null>(null)
  const statusRef = useRef<Status>('idle')
  const modeRef = useRef(settings.trackerMode)
  const colorRef = useRef(settings.trackerColor)
  const peekRef = useRef(false)
  const soundRef = useRef(settings.trackerSound)
  const lastAlert = useRef(0)
  const audioRef = useRef<AudioContext | null>(null)
  const hitsAccum = useRef({ n: 0, sum: 0 })

  modeRef.current = settings.trackerMode
  colorRef.current = settings.trackerColor
  soundRef.current = settings.trackerSound
  peekRef.current = peek
  statusRef.current = status

  const process = useCallback((src: CanvasImageSource, sw: number, sh: number): number => {
    const canvas = canvasRef.current
    if (!canvas || !sw || !sh) return 0
    if (!workRef.current) workRef.current = document.createElement('canvas')
    const work = workRef.current
    const W = WORK_W
    const H = Math.max(1, Math.round((WORK_W * sh) / sw))
    if (work.width !== W || work.height !== H) {
      work.width = W
      work.height = H
      maskRef.current = new Uint8Array(W * H)
    }
    const wctx = work.getContext('2d', { willReadFrequently: true })
    if (!wctx) return 0
    wctx.drawImage(src, 0, 0, W, H)
    if (peekRef.current) {
      blit(canvas, work)
      return 0
    }
    const img = wctx.getImageData(0, 0, W, H)
    const d = img.data
    const m = MODES[modeRef.current]
    const mask = maskRef.current!
    // Pass 1: raw colour test
    for (let p = 0, i = 0; p < d.length; p += 4, i++) {
      const r = d[p]
      const g = d[p + 1]
      const b = d[p + 2]
      let ok = 0
      if (r >= m.valMin && r > g && r > b) {
        const min = g < b ? g : b
        const chroma = r - min
        if (chroma >= m.chromaMin && chroma / r >= m.satMin) {
          const hue = (60 * (g - b)) / chroma // -60..60, red at 0
          if (hue <= m.hueTol && hue >= -m.hueTol) ok = 1
        }
      }
      mask[i] = ok
    }
    // Pass 2: paint. A pixel only counts when enough of its 8 neighbours also
    // match, which strips sensor noise on leaf litter while real blood (a blob)
    // sails through. Soil mode is looser so faint, broken-up blood survives.
    const need = modeRef.current === 'soil' ? 2 : 3
    const [hr, hg, hb] = COLORS[colorRef.current]
    let count = 0
    for (let y = 0, i = 0, p = 0; y < H; y++) {
      for (let x = 0; x < W; x++, i++, p += 4) {
        let hit = false
        if (mask[i] && x > 0 && y > 0 && x < W - 1 && y < H - 1) {
          const n = mask[i - 1] + mask[i + 1] + mask[i - W] + mask[i + W] + mask[i - W - 1] + mask[i - W + 1] + mask[i + W - 1] + mask[i + W + 1]
          hit = n >= need
        }
        if (hit) {
          d[p] = hr
          d[p + 1] = hg
          d[p + 2] = hb
          count++
        } else {
          const l = (d[p] * 0.299 + d[p + 1] * 0.587 + d[p + 2] * 0.114) * 0.58
          d[p] = l
          d[p + 1] = l
          d[p + 2] = l
        }
      }
    }
    wctx.putImageData(img, 0, 0)
    blit(canvas, work)
    return count
  }, [])

  const alert = useCallback(() => {
    const now = performance.now()
    if (now - lastAlert.current < 650) return
    lastAlert.current = now
    try {
      navigator.vibrate?.(35)
    } catch {
      /* unsupported */
    }
    if (soundRef.current && audioRef.current) {
      const ctx = audioRef.current
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = 1180
      g.gain.setValueAtTime(0.0001, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.09)
      o.connect(g).connect(ctx.destination)
      o.start()
      o.stop(ctx.currentTime + 0.1)
    }
  }, [])

  const loop = useCallback(() => {
    const v = videoRef.current
    if (statusRef.current === 'live' && v && v.readyState >= 2) {
      const n = process(v, v.videoWidth, v.videoHeight)
      hitsAccum.current.n++
      hitsAccum.current.sum += n
      if (hitsAccum.current.n >= 6) {
        setHits(Math.round(hitsAccum.current.sum / hitsAccum.current.n))
        hitsAccum.current = { n: 0, sum: 0 }
      }
      if (n >= ALERT_PIXELS) alert()
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [process, alert])

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setTorch({ available: false, on: false })
    setStatus('idle')
    setHits(0)
  }, [])

  async function start() {
    setError(null)
    setStatus('starting')
    photoRef.current = null
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser cannot open the camera. On iPhone use Safari, and open the app over https.')
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      streamRef.current = stream
      const v = videoRef.current!
      v.srcObject = stream
      await v.play()
      const track = stream.getVideoTracks()[0]
      const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean }
      setTorch({ available: !!caps.torch, on: false })
      if (!audioRef.current) {
        try {
          audioRef.current = new AudioContext()
        } catch {
          /* no audio */
        }
      }
      setStatus('live')
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(loop)
    } catch (e) {
      stop()
      setStatus('error')
      const msg = e instanceof Error ? e.message : 'Could not open the camera.'
      setError(/denied|permission/i.test(msg) ? 'Camera permission was denied. Allow the camera for this site and try again.' : msg)
    }
  }

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch.on } as MediaTrackConstraintSet] })
      setTorch((t) => ({ ...t, on: !t.on }))
    } catch {
      toast('This camera will not switch its light from the browser. Use a white LED flashlight.')
    }
  }

  function freeze() {
    if (status === 'live') {
      videoRef.current?.pause()
      setStatus('frozen')
    } else if (status === 'frozen') {
      void videoRef.current?.play()
      setStatus('live')
    }
  }

  async function onPhoto(file: File | null) {
    if (!file) return
    stop()
    setError(null)
    try {
      const bmp = await createImageBitmap(file)
      photoRef.current = bmp
      setStatus('photo')
      const n = process(bmp, bmp.width, bmp.height)
      setHits(n)
    } catch {
      setError('Could not read that photo.')
      setStatus('error')
    }
  }

  // Re-run the filter on a still photo when settings change
  useEffect(() => {
    if (status === 'photo' && photoRef.current) {
      const b = photoRef.current
      const w = 'naturalWidth' in b ? b.naturalWidth : b.width
      const h = 'naturalHeight' in b ? b.naturalHeight : b.height
      setHits(process(b, w, h))
    }
  }, [settings.trackerMode, settings.trackerColor, peek, status, process])

  useEffect(() => () => stop(), [stop])

  async function markBlood() {
    const canvas = canvasRef.current
    if (!canvas) return
    setMarking(true)
    try {
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.85))
      let lat: number | null = null
      let lon: number | null = null
      try {
        const p = await locate({ timeout: 8000 })
        lat = p.coords.latitude
        lon = p.coords.longitude
      } catch {
        /* no fix */
      }
      if (lat == null || lon == null) {
        if (!settings.home) throw new Error('No GPS fix and no home ground to fall back on.')
        lat = settings.home.lat
        lon = settings.home.lon
        toast('No GPS fix; pinned at home ground. Drag it on the map.')
      }
      const id = await addWaypoint({ type: 'blood', name: `Blood ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`, lat, lon, note: `Tracker ${MODES[settings.trackerMode].label} mode, ${hits} px` })
      if (blob) await addPhotoBlob(id, blob, 'Blood light capture')
      toast('Blood sign pinned on the map')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not pin')
    } finally {
      setMarking(false)
    }
  }

  const live = status === 'live' || status === 'frozen'
  const showCanvas = live || status === 'photo'
  const detected = hits >= ALERT_PIXELS

  return (
    <div className="h-full flex flex-col">
      <div className="max-w-[1400px] w-full mx-auto px-4 md:px-8 pt-5 md:pt-8 flex items-end justify-between gap-4">
        <div>
          <SectionLabel>Blood light</SectionLabel>
          <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight">Find the trail</h1>
        </div>
        <Segmented
          id="tmode"
          value={settings.trackerMode}
          onChange={(trackerMode) => setSettings({ trackerMode })}
          options={(Object.keys(MODES) as TrackerMode[]).map((m) => ({ value: m, label: MODES[m].label }))}
        />
      </div>

      <div className="max-w-[1400px] w-full mx-auto px-4 md:px-8 py-4 flex-1 min-h-0 grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* Viewfinder */}
        <div className="relative rounded-3xl overflow-hidden bg-pine-900 border border-bone-50/8 min-h-[52dvh] md:min-h-0">
          <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none" />
          <canvas ref={canvasRef} className={`absolute inset-0 w-full h-full ${status === 'photo' ? 'object-contain' : 'object-cover'} ${showCanvas ? '' : 'hidden'}`} />

          {!showCanvas && (
            <div className="absolute inset-0 grid place-items-center p-6">
              {status === 'error' ? (
                <EmptyState icon={<CameraSlash size={26} weight="duotone" />} title="Camera did not open" body={error ?? 'Unknown error.'} action={<><Button variant="primary" onClick={start}>Try again</Button><PhotoButton onPhoto={onPhoto} /></>} className="w-full max-w-lg" />
              ) : (
                <EmptyState
                  icon={<Scan size={26} weight="duotone" />}
                  title="Turn your phone into a blood light"
                  body="Everything but blood drops to gray. Hold the phone about waist high, sweep in a slow grid, and keep your own shadow off the ground. At night use a white LED light without a hot spot."
                  action={
                    <>
                      <Button variant="primary" size="lg" onClick={start} disabled={status === 'starting'}>
                        <Scan size={18} weight="bold" /> {status === 'starting' ? 'Opening camera' : 'Start camera'}
                      </Button>
                      <PhotoButton onPhoto={onPhoto} />
                    </>
                  }
                  className="w-full max-w-lg"
                />
              )}
            </div>
          )}

          {showCanvas && (
            <>
              <div className="absolute top-3 left-3 right-3 flex items-start gap-2 pointer-events-none">
                <AnimatePresence>
                  {detected && (
                    <motion.div key="hit" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 22 }} className="bg-ember-500 text-ember-950 rounded-full px-3 h-9 inline-flex items-center gap-1.5 text-sm font-semibold">
                      <DropHalf size={16} weight="fill" /> Blood
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="ml-auto glass rounded-full px-3 h-9 inline-flex items-center gap-2 font-mono text-[12px] tnum">
                  <span className={`w-1.5 h-1.5 rounded-full ${status === 'live' ? 'bg-ember-400 breathe' : 'bg-bone-600'}`} />
                  {hits} px
                </div>
              </div>

              {/* Meter */}
              <div className="absolute left-3 right-3 bottom-[76px] h-1 rounded-full bg-bone-50/10 overflow-hidden pointer-events-none">
                <motion.div className="h-full bg-ember-400" animate={{ width: `${Math.min(100, (hits / (ALERT_PIXELS * 6)) * 100)}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
              </div>

              <div className="absolute left-3 right-3 bottom-3 flex items-center gap-2">
                {live && (
                  <>
                    <TrackerButton label={status === 'frozen' ? 'Resume' : 'Freeze'} onClick={freeze}>
                      {status === 'frozen' ? <Play size={20} weight="fill" /> : <Pause size={20} weight="fill" />}
                    </TrackerButton>
                    <TrackerButton label="Hold to see the real view" onPointerDown={() => setPeek(true)} onPointerUp={() => setPeek(false)} onPointerLeave={() => setPeek(false)} active={peek}>
                      <Eye size={20} />
                    </TrackerButton>
                    {torch.available && (
                      <TrackerButton label="Light" onClick={toggleTorch} active={torch.on}>
                        <Flashlight size={20} weight={torch.on ? 'fill' : 'regular'} />
                      </TrackerButton>
                    )}
                  </>
                )}
                <div className="ml-auto flex gap-2">
                  <Button variant="primary" onClick={markBlood} disabled={marking}>
                    <MapPin size={16} weight="bold" /> {marking ? 'Pinning' : 'Mark blood here'}
                  </Button>
                  <TrackerButton label="Stop" onClick={stop}>
                    <X size={20} weight="bold" />
                  </TrackerButton>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Side panel */}
        <div className="space-y-6 md:border-l md:border-bone-50/8 md:pl-6">
          <div>
            <SectionLabel className="mb-2">Sensitivity</SectionLabel>
            <ul className="divide-y divide-bone-50/8 border-t border-b border-bone-50/8">
              {(Object.keys(MODES) as TrackerMode[]).map((m) => (
                <li key={m}>
                  <button onClick={() => setSettings({ trackerMode: m })} className={`push w-full flex items-center gap-3 py-2.5 text-left px-1 -mx-1 rounded-lg ${settings.trackerMode === m ? 'text-bone-50' : 'text-bone-400 hover:text-bone-200'}`} aria-pressed={settings.trackerMode === m}>
                    <span className={`w-7 h-7 grid place-items-center rounded-md font-mono text-[12px] ${settings.trackerMode === m ? 'bg-ember-500 text-ember-950' : 'bg-pine-800'}`}>{MODES[m].label[0]}</span>
                    <span className="flex-1">
                      <span className="text-sm font-medium">{MODES[m].label}</span>
                      <span className="block text-[12px] text-bone-600">{MODES[m].hint}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <SectionLabel className="mb-2">Highlight</SectionLabel>
            <div className="flex gap-2">
              {(Object.keys(COLORS) as TrackerColor[]).map((c) => {
                const [r, g, b] = COLORS[c]
                const on = settings.trackerColor === c
                return (
                  <button key={c} onClick={() => setSettings({ trackerColor: c })} aria-label={c} aria-pressed={on} className={`push w-10 h-10 rounded-full border-2 ${on ? 'border-bone-50' : 'border-transparent'}`} style={{ background: `rgb(${r},${g},${b})` }} />
                )
              })}
              <label className="ml-auto inline-flex items-center gap-2 text-[13px] text-bone-400">
                <input type="checkbox" checked={settings.trackerSound} onChange={(e) => setSettings({ trackerSound: e.target.checked })} className="accent-ember-500" />
                Tick on hit
              </label>
            </div>
          </div>
          <div className="text-[12.5px] text-bone-600 leading-relaxed space-y-1.5">
            <p>Best within six feet of the ground. Fresh arterial blood is bright; liver and gut blood runs dark, so step up to High. Red leaves and berries will light up on Soil.</p>
            <p>Mark blood here drops a pin with the frame you are looking at, so the trail builds on the map as you go.</p>
            <p>iPhone: Safari does not vibrate or switch the flash from a web page. The tick and the orange badge are your alerts.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function blit(canvas: HTMLCanvasElement, work: HTMLCanvasElement) {
  if (canvas.width !== work.width || canvas.height !== work.height) {
    canvas.width = work.width
    canvas.height = work.height
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(work, 0, 0)
}

function TrackerButton({ label, active, children, ...rest }: { label: string; active?: boolean; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button aria-label={label} title={label} className={`push w-11 h-11 grid place-items-center rounded-xl glass transition-colors ${active ? 'bg-ember-500 text-ember-950' : 'text-bone-50'}`} {...rest}>
      {children}
    </button>
  )
}

function PhotoButton({ onPhoto }: { onPhoto: (f: File | null) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <Button variant="secondary" size="lg" onClick={() => ref.current?.click()}>
        <Image size={18} /> Try it on a photo
      </Button>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0] ?? null)} />
    </>
  )
}
