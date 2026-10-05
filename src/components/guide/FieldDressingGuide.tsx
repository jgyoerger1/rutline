import { Crosshair } from '@phosphor-icons/react'
import { useState } from 'react'
import { addWaypoint } from '../../lib/db'
import { locate } from '../../lib/geo'
import { useApp } from '../AppContext'
import { Button } from '../ui'
import DeerDiagram from './DeerDiagram'
import ScrollGuide from './ScrollGuide'
import { FIELD_DRESSING, FIELD_DRESSING_STEPS } from './fieldDressing'

export default function FieldDressingGuide({ onBack }: { onBack: () => void }) {
  return (
    <ScrollGuide
      meta={FIELD_DRESSING}
      steps={FIELD_DRESSING_STEPS}
      Diagram={DeerDiagram}
      onBack={onBack}
      outro={{
        label: 'Before you drag',
        title: 'Mark the spot',
        body: 'One pin at the kill site ties tonight together: the stand that produced it, the line it ran, where it fell. Next season that is the pattern you hunt.',
        children: <KillSitePin />,
      }}
    />
  )
}

function KillSitePin() {
  const { toast, focusWaypoint } = useApp()
  const [busy, setBusy] = useState(false)

  async function dropPin() {
    setBusy(true)
    try {
      const pos = await locate()
      const when = new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })
      const id = await addWaypoint({ type: 'other', name: `Kill site · ${when}`, lat: pos.coords.latitude, lon: pos.coords.longitude, note: 'Dropped from the Field Guide after field dressing.' })
      toast('Kill-site pin dropped')
      focusWaypoint(id)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not get a fix')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="primary" size="lg" onClick={dropPin} disabled={busy}>
      <Crosshair size={18} weight="bold" className={busy ? 'breathe' : ''} />
      {busy ? 'Getting a fix…' : 'Drop a kill-site pin'}
    </Button>
  )
}
