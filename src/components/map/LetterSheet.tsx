import { CopySimple, Printer, ShareNetwork } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import type { OwnerInfo } from '../../lib/types'
import { useApp } from '../AppContext'
import { Button, Field, Input, SectionLabel, Sheet, Textarea } from '../ui'

export type LetterTarget = Pick<OwnerInfo, 'name' | 'mailAddress' | 'parcelId' | 'county' | 'situs'>

export function composeLetter(t: LetterTarget, hunter: { name: string; phone: string; email: string }, homeLabel: string | null): string {
  const today = new Date().toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
  const me = hunter.name.trim() || '____________'
  const reach = [hunter.phone.trim(), hunter.email.trim()].filter(Boolean).join(' or ') || '____________'
  const where = [t.situs ? `at ${t.situs}` : '', t.county ? `in ${t.county} County` : ''].filter(Boolean).join(' ')
  const parcel = t.parcelId ? ` (parcel ${t.parcelId})` : ''
  const greeting = t.name ? `Dear ${t.name},` : 'Dear Landowner,'
  const season = new Date().getMonth() >= 6 ? new Date().getFullYear() : new Date().getFullYear() - 1
  return [
    today,
    '',
    t.name ? t.name : 'Landowner',
    t.mailAddress ?? '',
    '',
    greeting,
    '',
    `My name is ${me}${homeLabel ? ` and I live in ${homeLabel}` : ''}. I am writing about your property ${where}${parcel}.`,
    '',
    `I am a careful, ethical whitetail hunter and would like to ask your permission to hunt it during the ${season} season. I hunt alone or with one partner, from a stand, with a bow or a firearm as the season allows. I take the rules seriously: I would park where you tell me, close every gate, stay off crops and away from buildings and livestock, pack out everything I bring in, and never bring anyone you have not approved.`,
    '',
    'I am glad to sign a release, show my license and insurance, keep an eye out for trespassers or problems on the back of the property, and share venison if you would like it.',
    '',
    `If you are open to it, I would welcome a short conversation at your convenience. You can reach me at ${reach}. If the answer is no, I understand completely and thank you for your time.`,
    '',
    'Sincerely,',
    '',
    me,
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
}

export default function LetterSheet({ target, onClose }: { target: LetterTarget | null; onClose: () => void }) {
  const { settings, setSettings, home, toast } = useApp()
  const [text, setText] = useState('')
  const [hunter, setHunter] = useState(settings.hunter)

  useEffect(() => {
    if (target) {
      setHunter(settings.hunter)
      setText(composeLetter(target, settings.hunter, home?.label ?? null))
    }
  }, [target]) // eslint-disable-line react-hooks/exhaustive-deps

  function regenerate(next = hunter) {
    if (!target) return
    setSettings({ hunter: next })
    setText(composeLetter(target, next, home?.label ?? null))
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      toast('Letter copied')
    } catch {
      toast('Select the text and copy it')
    }
  }

  async function share() {
    if (!navigator.share) return copy()
    try {
      await navigator.share({ title: 'Hunting permission request', text })
    } catch {
      /* cancelled */
    }
  }

  function print() {
    const frame = document.createElement('iframe')
    frame.style.position = 'fixed'
    frame.style.right = '0'
    frame.style.bottom = '0'
    frame.style.width = '0'
    frame.style.height = '0'
    frame.style.border = '0'
    document.body.appendChild(frame)
    const doc = frame.contentDocument
    if (!doc) return
    doc.open()
    doc.write(`<!doctype html><html><head><title>Permission request</title><style>body{font:12pt/1.55 Georgia,serif;color:#111;margin:1in;max-width:6.5in;white-space:pre-wrap}</style></head><body>${escapeHtml(text)}</body></html>`)
    doc.close()
    frame.contentWindow?.focus()
    frame.contentWindow?.print()
    window.setTimeout(() => frame.remove(), 2000)
  }

  return (
    <Sheet
      open={!!target}
      onClose={onClose}
      scrollKey={target ? `${target.parcelId}-${target.name}` : null}
      title="Permission letter"
      footer={
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" onClick={copy}>
            <CopySimple size={15} /> Copy
          </Button>
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <Button size="sm" onClick={share}>
              <ShareNetwork size={15} /> Share
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={print}>
            <Printer size={15} /> Print
          </Button>
        </div>
      }
    >
      {target && (
        <div className="space-y-5">
          <p className="text-[13px] text-bone-400 leading-relaxed">A short, specific letter to the tax mailing address gets more yeses than a cold call. Edit anything below; your details are saved for next time.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Your name">
              <Input value={hunter.name} onChange={(e) => setHunter({ ...hunter, name: e.target.value })} onBlur={() => regenerate()} placeholder="Full name" />
            </Field>
            <Field label="Phone">
              <Input value={hunter.phone} onChange={(e) => setHunter({ ...hunter, phone: e.target.value })} onBlur={() => regenerate()} placeholder="(330) 555-0142" inputMode="tel" />
            </Field>
            <Field label="Email">
              <Input value={hunter.email} onChange={(e) => setHunter({ ...hunter, email: e.target.value })} onBlur={() => regenerate()} placeholder="you@example.com" inputMode="email" />
            </Field>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <SectionLabel>Letter</SectionLabel>
              <button onClick={() => regenerate()} className="text-[12px] text-bone-600 hover:text-bone-200 underline underline-offset-4 decoration-bone-50/20">
                Reset to template
              </button>
            </div>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[360px] font-mono text-[13px] leading-relaxed" spellCheck />
          </div>
        </div>
      )}
    </Sheet>
  )
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}
