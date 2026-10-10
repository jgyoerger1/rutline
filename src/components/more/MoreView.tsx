import { useLiveQuery } from 'dexie-react-hooks'
import { AppleLogo, Database, DownloadSimple, Trash, UploadSimple } from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { clearLocal, exportBackup, exportGeoJSON, importBackup, liveCounts } from '../../lib/db'
import { defaultPeakRut, seasonYear } from '../../lib/rut'
import { downloadBlob } from '../../lib/useGeo'
import { useApp } from '../AppContext'
import HomePicker from '../HomePicker'
import AccountSection from './AccountSection'
import CampsSection from './CampsSection'
import CustomSourceForm from './CustomSourceForm'
import { COUNTY_SOURCES } from '../../lib/parcels'
import { Button, Field, Input, SectionLabel, Segmented } from '../ui'

export default function MoreView() {
  const { settings, setSettings, home, toast, peak } = useApp()
  const counts = useLiveQuery(liveCounts, [])
  const [busy, setBusy] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const importMode = useRef<'merge' | 'replace'>('merge')

  const guess = home ? defaultPeakRut(home.lat, home.lon, seasonYear(new Date())) : null
  const overrideValue = settings.rutPeakOverride ? `${seasonYear(new Date()) + (settings.rutPeakOverride.startsWith('01') || settings.rutPeakOverride.startsWith('02') ? 1 : 0)}-${settings.rutPeakOverride}` : ''

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label)
    try {
      await fn()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-5 md:py-8 pb-16">
      <SectionLabel>Settings</SectionLabel>
      <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight">Your ground, your rules</h1>

      <div className="mt-8 grid gap-x-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="divide-y divide-bone-50/8">
          <Section title="Home ground" body={home ? `${home.label} · ${home.lat.toFixed(4)}, ${home.lon.toFixed(4)}` : 'Not set. Weather and HuntCast wait on this.'}>
            <HomePicker compact onPick={(h) => { setSettings({ home: h }); toast(`Home ground set: ${h.label}`) }} />
          </Section>

          <Section title="Units">
            <Segmented id="units" value={settings.units} onChange={(units) => setSettings({ units })} options={[{ value: 'imperial', label: '°F · mph · inHg' }, { value: 'metric', label: '°C · km/h · hPa' }]} />
          </Section>

          <Section title="Peak rut" body={guess ? `Assumed ${guess.date.toLocaleDateString([], { month: 'long', day: 'numeric' })} from your latitude (${guess.confidence} confidence). ${guess.reason}` : 'Set a home ground to get a default.'}>
            <Field label="Peak breeding date" helper="Check your state wildlife agency's conception map. The phases shift around this date.">
              <div className="flex gap-2">
                <input
                  type="date"
                  value={overrideValue}
                  onChange={(e) => {
                    const v = e.target.value
                    setSettings({ rutPeakOverride: v ? v.slice(5) : null })
                  }}
                  className="flex-1 h-11 px-3.5 rounded-xl bg-pine-900 border border-bone-50/10 text-bone-50 outline-none focus:border-ember-500/60 font-mono text-sm"
                />
                {settings.rutPeakOverride && (
                  <Button variant="ghost" onClick={() => setSettings({ rutPeakOverride: null })}>
                    Use default
                  </Button>
                )}
              </div>
            </Field>
            {peak && <div className="mt-2 text-[12px] text-bone-600">In use: {peak.date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</div>}
          </Section>

          <Section title="Legal light" body="Minutes before sunrise and after sunset that count as shooting light. Most states use 30.">
            <Segmented id="legal" value={String(settings.legalLightMinutes) as '0' | '30' | '60'} onChange={(v) => setSettings({ legalLightMinutes: Number(v) })} options={[{ value: '0', label: 'Sunrise to sunset' }, { value: '30', label: '30 min' }, { value: '60', label: '60 min' }]} />
          </Section>
        </div>

        <div className="divide-y divide-bone-50/8">
          <Section title="Account" body="Sign in once and your pins, photos, landowners and settings follow you to every device.">
            <AccountSection />
          </Section>

          <Section title="Camps" body="A shared map for your crew. Share any pin or trail into a camp from its sheet; everything else stays yours.">
            <CampsSection />
          </Section>

          <Section title="Property lines" body="Boundaries and owner mailing addresses come from Ohio's statewide parcel service for all 88 counties. Owner names are added where the county publishes them.">
            <Segmented id="parcels" value={settings.parcelsEnabled ? 'on' : 'off'} onChange={(v) => setSettings({ parcelsEnabled: v === 'on' })} options={[{ value: 'on', label: 'Show lines' }, { value: 'off', label: 'Hide' }]} />
            <div className="mt-4 text-[13px] text-bone-400 leading-relaxed">
              <div className="text-bone-50 font-medium">Owner names built in</div>
              {COUNTY_SOURCES.map((s) => s.shortLabel).join(', ')}. Elsewhere in Ohio you get lines, site address, acres and the tax mailing address; names need the county's own site. Lines draw once you zoom in close.
            </div>
            <div className="mt-5">
              <SectionLabel className="mb-2">Add your county's layer</SectionLabel>
              <CustomSourceForm />
            </div>
          </Section>

          <Section title="You, for permission letters" body="Filled into the letter template. Stays on this device.">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Name">
                <Input value={settings.hunter.name} onChange={(e) => setSettings({ hunter: { ...settings.hunter, name: e.target.value } })} placeholder="Full name" />
              </Field>
              <Field label="Phone">
                <Input value={settings.hunter.phone} onChange={(e) => setSettings({ hunter: { ...settings.hunter, phone: e.target.value } })} placeholder="(330) 555-0142" inputMode="tel" />
              </Field>
              <Field label="Email">
                <Input value={settings.hunter.email} onChange={(e) => setSettings({ hunter: { ...settings.hunter, email: e.target.value } })} placeholder="you@example.com" inputMode="email" />
              </Field>
            </div>
          </Section>

          <Section title="Your data" body={counts ? `${counts.w} pins · ${counts.t} lines · ${counts.p} photos, on this device. Signed in, they also live in your account; otherwise back up before you switch phones.` : 'Counting...'}>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => run('backup', async () => downloadBlob(await exportBackup(), `rutline-backup-${new Date().toISOString().slice(0, 10)}.json`))} disabled={!!busy}>
                <DownloadSimple size={16} /> Backup (with photos)
              </Button>
              <Button variant="ghost" onClick={() => run('geo', async () => downloadBlob(await exportGeoJSON(), 'rutline-pins.geojson'))} disabled={!!busy}>
                <Database size={16} /> GeoJSON
              </Button>
              <Button variant="ghost" onClick={() => { importMode.current = 'merge'; importRef.current?.click() }} disabled={!!busy}>
                <UploadSimple size={16} /> Restore (merge)
              </Button>
              <Button variant="ghost" onClick={() => { importMode.current = 'replace'; importRef.current?.click() }} disabled={!!busy}>
                <UploadSimple size={16} /> Restore (replace)
              </Button>
              <input
                ref={importRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  const mode = importMode.current
                  if (mode === 'replace' && !confirm('Replace everything on this device with the backup?')) return
                  void run('import', async () => {
                    const r = await importBackup(f, mode)
                    toast(`Restored ${r.waypoints} pins, ${r.trails} lines, ${r.photos} photos`)
                  })
                  e.target.value = ''
                }}
              />
            </div>
            <div className="mt-4">
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  if (!confirm('Remove every pin, line and photo from this device? If you are signed in, your account copy is untouched and comes back on the next sync.')) return
                  void run('clear', async () => {
                    await clearLocal()
                    toast('This device is cleared')
                  })
                }}
                disabled={!!busy}
              >
                <Trash size={15} /> Clear this device
              </Button>
            </div>
          </Section>

          <Section title="Put it on your iPhone" body="Rutline is a web app that installs like a native one: full screen, home-screen icon, works offline on ground you have already looked at.">
            <ol className="text-sm text-bone-400 space-y-1.5 list-decimal pl-5 leading-relaxed">
              <li>Open this page in <span className="text-bone-50">Safari</span> (not Chrome).</li>
              <li>Tap the <span className="text-bone-50">Share</span> button, then <span className="text-bone-50">Add to Home Screen</span>.</li>
              <li>Open it from the icon. Allow location and camera when asked.</li>
            </ol>
            <div className="mt-3 inline-flex items-center gap-2 text-[12px] text-bone-600">
              <AppleLogo size={14} /> Photos and pins live in the installed app's own storage. Use Backup to move them.
            </div>
          </Section>

          <Section title="About" body="Rutline pulls weather from Open-Meteo, imagery from Esri and topo from USGS. Property lines, public land and hunting units come from state and county GIS servers. Your pins stay on your phone unless you sign in; then they sync to your account and to the camps you share them with.">
            <div className="text-[12px] text-bone-600 font-mono">v{__APP_VERSION__}</div>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, body, children }: { title: string; body?: string; children: React.ReactNode }) {
  return (
    <section className="py-7 first:pt-0">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {body && <p className="mt-1 text-[13px] text-bone-400 leading-relaxed max-w-[60ch]">{body}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}
