import { Drop, Scan } from '@phosphor-icons/react'
import { useState } from 'react'
import { addWaypoint } from '../../lib/db'
import { locate } from '../../lib/geo'
import { useApp } from '../AppContext'
import { Button } from '../ui'
import ScrollGuide from './ScrollGuide'
import TrailDiagram from './TrailDiagram'
import { BLOOD_TRAIL, BLOOD_TRAIL_STEPS } from './bloodTrail'

export default function BloodTrailGuide({ onBack }: { onBack: () => void }) {
  return (
    <ScrollGuide
      meta={BLOOD_TRAIL}
      steps={BLOOD_TRAIL_STEPS}
      Diagram={TrailDiagram}
      onBack={onBack}
      outro={{
        label: 'On the ground',
        title: 'Build the line as you go',
        body: 'Every blood pin you drop becomes a point on the map. By the time you reach the deer the whole track is drawn: hit site, last blood, recovery. The Track tab opens the blood-light camera for the dark stretches.',
        children: <TrailActions />,
      }}
    />
  )
}

function TrailActions() {
  const { toast, focusWaypoint, setView } = useApp()
  const [busy, setBusy] = useState(false)

  async function dropBlood() {
    setBusy(true)
    try {
      const pos = await locate()
      const when = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      const id = await addWaypoint({ type: 'blood', name: `Blood · ${when}`, lat: pos.coords.latitude, lon: pos.coords.longitude, note: 'Dropped from the Field Guide.' })
      toast('Blood pin dropped')
      focusWaypoint(id)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not get a fix')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="primary" size="lg" onClick={dropBlood} disabled={busy}>
        <Drop size={18} weight="fill" className={busy ? 'breathe' : ''} />
        {busy ? 'Getting a fix…' : 'Drop a blood pin here'}
      </Button>
      <Button variant="secondary" size="lg" onClick={() => setView('tracker')}>
        <Scan size={18} weight="bold" /> Open the blood light
      </Button>
    </div>
  )
}
