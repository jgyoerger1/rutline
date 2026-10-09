import { useState } from 'react'
import { guessFields, inspectLayer, type LayerInfo } from '../../lib/parcels'
import type { CustomParcelSource, ParcelFieldMap } from '../../lib/types'
import { useApp } from '../AppContext'
import { Button, Field, Input } from '../ui'

const SLOTS: Array<{ key: keyof Omit<ParcelFieldMap, 'mailParts' | 'situsParts' | 'mailLines'>; label: string; hint: string }> = [
  { key: 'parcelId', label: 'Parcel ID', hint: 'PIN, APN, parcel number' },
  { key: 'owner', label: 'Owner name', hint: 'The field that holds the deeded owner' },
  { key: 'owner2', label: 'Second owner', hint: 'Optional' },
  { key: 'mailName', label: 'Mailing name', hint: 'Optional, if different from owner' },
  { key: 'mailAddress', label: 'Mailing address', hint: 'One field with the whole address, or leave blank and list parts below' },
  { key: 'situs', label: 'Site address', hint: 'Where the parcel is' },
  { key: 'acres', label: 'Acres', hint: 'Optional, computed from the shape if blank' },
  { key: 'landUse', label: 'Land use', hint: 'Optional' },
  { key: 'county', label: 'County field', hint: 'Optional' },
]

export default function CustomSourceForm() {
  const { settings, setSettings, toast } = useApp()
  const existing = settings.customParcelSource
  const [label, setLabel] = useState(existing?.label ?? '')
  const [url, setUrl] = useState(existing?.url ?? '')
  const [county, setCounty] = useState(existing?.county ?? '')
  const [fields, setFields] = useState<ParcelFieldMap>(existing?.fields ?? {})
  const [mailParts, setMailParts] = useState((existing?.fields.mailParts ?? []).join(', '))
  const [info, setInfo] = useState<LayerInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function read() {
    setBusy(true)
    setError(null)
    try {
      const li = await inspectLayer(url)
      setInfo(li)
      if (!label) setLabel(li.name)
      const g = { ...li.guess, ...fields }
      setFields(g)
      if (!mailParts && li.guess.mailParts?.length) setMailParts(li.guess.mailParts.join(', '))
      toast(`Read ${li.fields.length} fields from ${li.name}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that layer.')
    } finally {
      setBusy(false)
    }
  }

  function save() {
    if (!url.trim()) {
      setError('Paste the layer URL first.')
      return
    }
    const parts = mailParts
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const clean: ParcelFieldMap = {}
    for (const s of SLOTS) if (fields[s.key]) clean[s.key] = fields[s.key]
    if (parts.length) clean.mailParts = parts
    if (!clean.parcelId && !clean.owner && !clean.situs) {
      setError('Map at least the parcel ID, owner or site address field.')
      return
    }
    const src: CustomParcelSource = { label: label.trim() || 'Your parcel layer', url: url.trim().replace(/\/query.*$/, '').replace(/\/+$/, ''), county: county.trim(), fields: clean, extent: info?.extent ?? existing?.extent ?? null }
    setSettings({ customParcelSource: src, parcelsEnabled: true })
    setError(null)
    toast('Parcel layer saved')
  }

  function clear() {
    setSettings({ customParcelSource: null })
    setLabel('')
    setUrl('')
    setCounty('')
    setFields({})
    setMailParts('')
    setInfo(null)
    toast('Custom layer removed')
  }

  const names = info?.fields.map((f) => f.name) ?? []
  const Select = ({ slot }: { slot: (typeof SLOTS)[number] }) => (
    <Field label={slot.label} helper={slot.hint}>
      {names.length ? (
        <select value={fields[slot.key] ?? ''} onChange={(e) => setFields({ ...fields, [slot.key]: e.target.value || undefined })} className="w-full h-11 px-3.5 rounded-xl bg-pine-900 border border-bone-50/10 text-bone-50 outline-none focus:border-ember-500/60 text-sm">
          <option value="">Not mapped</option>
          {names.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      ) : (
        <Input value={fields[slot.key] ?? ''} onChange={(e) => setFields({ ...fields, [slot.key]: e.target.value || undefined })} placeholder="Field name" />
      )}
    </Field>
  )

  return (
    <div className="space-y-4">
      {existing && (
        <div className="rounded-xl border border-bone-50/10 bg-pine-900/60 px-4 py-3 text-sm">
          <div className="font-medium">{existing.label}</div>
          <div className="text-[12px] text-bone-600 font-mono break-all">{existing.url}</div>
          <div className="text-[12px] text-bone-400 mt-1">
            {existing.county ? `Replaces ${existing.county} County rows. ` : ''}
            {existing.extent ? 'Used inside its own extent.' : 'Used everywhere property lines are on.'}
          </div>
        </div>
      )}
      <Field label="Layer URL" helper="An ArcGIS parcel layer ending in /FeatureServer/0 or /MapServer/0. Your county GIS or auditor site usually links one.">
        <div className="flex gap-2">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://gis.yourcounty.gov/arcgis/rest/services/Parcels/MapServer/0" className="font-mono text-[12.5px]" />
          <Button onClick={read} disabled={busy || !url.trim()}>
            {busy ? 'Reading' : 'Read layer'}
          </Button>
        </div>
      </Field>
      {info && (
        <div className="text-[12px] text-bone-400">
          {info.name} · {info.fields.length} fields{info.extent ? ` · extent known` : ' · no extent published'}
          <button onClick={() => setFields({ ...guessFields(names) })} className="ml-2 underline underline-offset-4 decoration-bone-50/20 hover:text-bone-50">
            Re-guess fields
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Label" helper="Shown as the source on each parcel">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Portage County Auditor" />
        </Field>
        <Field label="County name" helper="As Ohio's statewide layer spells it, so its rows get replaced. Blank if outside Ohio.">
          <Input value={county} onChange={(e) => setCounty(e.target.value)} placeholder="Portage" />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SLOTS.map((s) => (
          <Select key={s.key} slot={s} />
        ))}
        <Field label="Mailing address parts" helper="Comma-separated field names: street, city, state, zip" className="sm:col-span-2">
          <Input value={mailParts} onChange={(e) => setMailParts(e.target.value)} placeholder="MAIL_ADDR, MAIL_CITY, MAIL_STATE, MAIL_ZIP" className="font-mono text-[12.5px]" />
        </Field>
      </div>
      {error && <div className="text-[13px] text-ember-400">{error}</div>}
      <div className="flex gap-2">
        <Button variant="primary" onClick={save}>
          Save layer
        </Button>
        {existing && (
          <Button variant="ghost" onClick={clear}>
            Remove
          </Button>
        )}
      </div>
    </div>
  )
}
