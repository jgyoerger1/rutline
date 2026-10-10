import { ArrowSquareOut, ChatText, MagnifyingGlass, PencilSimple, Phone } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { firstText, formatPhone, phoneLookups, readMailing, readOwner, smsHref, telHref } from '../../lib/landowner'
import { useApp } from '../AppContext'
import { Button, SectionLabel } from '../ui'

// The web-search path ("Find a number") is hidden for the App Store launch:
// Apple's privacy rules frown on compiling personal details from public
// sources, and it is the one feature a reviewer could reject the app over.
// Flip this to show it again; everything underneath still works.
const SHOW_PHONE_SEARCH = false

const KIND_NOTE = {
  person: null,
  trust: 'Held in a trust. The trustee is usually the person named, so search them.',
  business: 'Owned by a business. Find who runs it, or the registered agent, and ask them.',
  public: 'Owned by a public body. Check its hunting rules instead of asking an owner.',
} as const

/**
 * Phone for a landowner: the saved number with Call and Text, or a set of
 * web searches (by name, by the tax mailing address, people-search listings)
 * that the hunter opens and reads themselves, plus a box to keep what they find.
 */
export default function LandownerContact({ owner, mailAddress, state, where, phone, onPhone }: { owner: string | null; mailAddress: string | null; state: string; where: string; phone: string | undefined; onPhone: (phone: string) => void }) {
  const { settings } = useApp()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(phone ?? '')

  const read = useMemo(() => (owner ? readOwner(owner) : null), [owner])
  const mail = useMemo(() => readMailing(mailAddress), [mailAddress])
  const lookups = useMemo(() => (read ? phoneLookups(read, mail, state) : []), [read, mail, state])
  const digits = draft.replace(/\D/g, '')
  const valid = digits.length === 10 || (digits.length === 11 && digits.startsWith('1'))

  function save() {
    if (!valid) return
    onPhone(formatPhone(draft))
    setEditing(false)
    setOpen(false)
  }

  if (phone && !editing) {
    return (
      <div>
        <SectionLabel>Phone</SectionLabel>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <span className="font-mono text-base tnum text-bone-50">{phone}</span>
          <button onClick={() => { setDraft(phone); setEditing(true) }} className="push text-bone-600 hover:text-bone-200" aria-label="Edit phone number">
            <PencilSimple size={14} />
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <a href={telHref(phone)} className="push inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-ember-500 text-ember-950 text-[13px] font-medium border border-ember-300/30">
            <Phone size={15} weight="fill" /> Call
          </a>
          <a href={smsHref(phone, firstText(settings.hunter.name, where))} className="push inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-pine-800 text-bone-50 text-[13px] font-medium border border-bone-50/10">
            <ChatText size={15} /> Text a first note
          </a>
        </div>
      </div>
    )
  }

  return (
    <div>
      <SectionLabel>Phone</SectionLabel>
      {!open && !editing ? (
        <div className="mt-1 flex items-center gap-3 flex-wrap">
          <span className="text-sm text-bone-600">Not on the county record</span>
          {SHOW_PHONE_SEARCH && read && (
            <button onClick={() => setOpen(true)} className="push inline-flex items-center gap-1.5 text-[13px] text-bone-50 underline underline-offset-4 decoration-bone-50/30">
              <MagnifyingGlass size={13} /> Find a number
            </button>
          )}
          <button onClick={() => setEditing(true)} className="push text-[13px] text-bone-400 hover:text-bone-50">
            Add one
          </button>
        </div>
      ) : (
        <div className="mt-2 rounded-2xl border border-bone-50/10 bg-pine-900/70 p-3 space-y-3">
          {open && read && (
            <>
              {KIND_NOTE[read.kind] && <p className="text-[12.5px] text-bone-400 leading-relaxed">{KIND_NOTE[read.kind]}</p>}
              <ul className="divide-y divide-bone-50/8">
                {lookups.map((l) => (
                  <li key={l.label}>
                    <a href={l.url} target="_blank" rel="noreferrer" className="push flex items-center gap-3 py-2.5">
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-bone-50">{l.label}</span>
                        <span className="block text-[12px] text-bone-600 truncate">{l.hint}</span>
                      </span>
                      <ArrowSquareOut size={15} className="text-bone-600 shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div>
            <label htmlFor="landowner-phone" className="text-[12px] text-bone-400">
              {open ? 'Found it? Keep it here' : 'Phone number'}
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                id="landowner-phone"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && save()}
                placeholder="(330) 555-0142"
                className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-pine-950 border border-bone-50/10 text-bone-50 font-mono text-sm tnum outline-none focus:border-ember-500/60"
              />
              <Button size="sm" variant="primary" disabled={!valid} onClick={save}>
                Save
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11.5px] text-bone-600 leading-relaxed">Searches open in your browser. Rutline does not look anyone up for you.</p>
            <button onClick={() => { setOpen(false); setEditing(false) }} className="push text-[12px] text-bone-400 hover:text-bone-50 shrink-0">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
