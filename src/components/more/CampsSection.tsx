import { CaretDown, CopySimple, LinkSimple, ShareNetwork, SignOut, Tent, UserMinus, UsersThree } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth'
import { memberLabel, refreshCamps, setMyName, useCamps } from '../../lib/camps'
import { cloud, cloudConfigured } from '../../lib/cloud'
import type { Camp, CampMember } from '../../lib/cloud/types'
import { setSettings } from '../../lib/settings'
import { syncNow } from '../../lib/sync'
import { useApp } from '../AppContext'
import { Button, Field, Input } from '../ui'

export function inviteLink(code: string): string {
  return `${location.origin}${location.pathname}#/join/${code}`
}

export default function CampsSection() {
  const { toast } = useApp()
  const auth = useAuth()
  const camps = useCamps()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [myName, setMyNameInput] = useState(camps.myName ?? '')

  useEffect(() => {
    setMyNameInput(camps.myName ?? '')
  }, [camps.myName])

  useEffect(() => {
    if (auth.user && !camps.loaded) void refreshCamps()
  }, [auth.user, camps.loaded])

  if (!cloudConfigured || !cloud) return <p className="text-sm text-bone-400">Camps need the account backend. See the Account section above.</p>
  if (!auth.user) {
    return (
      <div>
        <p className="text-sm text-bone-400 leading-relaxed">A camp is a shared map for your lease or your crew. Sign in to create one or join a friend's.</p>
        <Button variant="primary" className="mt-3" onClick={() => setSettings({ localOnly: false })}>
          Sign in
        </Button>
      </div>
    )
  }
  const backend = cloud

  async function run(label: string, fn: () => Promise<void>, done?: string) {
    setBusy(label)
    try {
      await fn()
      if (done) toast(done)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <Field label="Your name in camps" helper="What friends see next to pins you share.">
        <div className="flex gap-2">
          <Input value={myName} onChange={(e) => setMyNameInput(e.target.value)} placeholder="Jordan" />
          <Button
            onClick={() =>
              void run('name', async () => {
                await backend.setDisplayName(myName)
                setMyName(myName.trim() || null)
                await refreshCamps()
              }, 'Name saved')
            }
            disabled={busy !== null || (myName.trim() || '') === (camps.myName ?? '')}
          >
            Save
          </Button>
        </div>
      </Field>

      {camps.camps.length === 0 && camps.loaded && (
        <div className="rounded-2xl border border-dashed border-bone-50/12 px-5 py-5 text-sm text-bone-400 leading-relaxed">
          <div className="text-bone-50 font-medium">No camps yet</div>
          Create one for your property, send the code to your buddies, and share pins into it from any pin's sheet. Your private pins stay private.
        </div>
      )}

      {camps.camps.length > 0 && (
        <ul className="divide-y divide-bone-50/8 border-t border-b border-bone-50/8">
          {camps.camps.map((c) => (
            <CampRow key={c.id} camp={c} me={auth.user!.id} busy={busy} run={run} />
          ))}
        </ul>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Start a camp" helper="You get a code to hand out.">
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Back forty" />
            <Button
              variant="primary"
              disabled={busy !== null || !name.trim()}
              onClick={() =>
                void run('create', async () => {
                  const c = await backend.createCamp(name.trim())
                  setName('')
                  await refreshCamps()
                  toast(`${c.name} created. Code ${c.inviteCode}`)
                })
              }
            >
              <Tent size={16} /> Create
            </Button>
          </div>
        </Field>
        <Field label="Join a camp" helper="Paste the 8-character code from a friend.">
          <div className="flex gap-2">
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABCD2345" className="font-mono tracking-[0.15em]" />
            <Button
              disabled={busy !== null || code.trim().length < 6}
              onClick={() =>
                void run('join', async () => {
                  const c = await backend.joinCamp(code.trim())
                  setCode('')
                  await refreshCamps()
                  await syncNow()
                  toast(`Joined ${c.name}`)
                })
              }
            >
              <UsersThree size={16} /> Join
            </Button>
          </div>
        </Field>
      </div>
      {camps.error && <div className="text-[13px] text-ember-400">{camps.error}</div>}
    </div>
  )
}

function CampRow({ camp, me, busy, run }: { camp: Camp; me: string; busy: string | null; run: (label: string, fn: () => Promise<void>, done?: string) => Promise<void> }) {
  const { toast } = useApp()
  const [open, setOpen] = useState(false)
  const [roster, setRoster] = useState<CampMember[] | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState(camp.name)
  const owner = camp.role === 'owner'

  useEffect(() => {
    if (!open || !cloud) return
    let alive = true
    void cloud.campRoster(camp.id).then((r) => alive && setRoster(r)).catch(() => alive && setRoster([]))
    return () => {
      alive = false
    }
  }, [open, camp.id, camp.memberCount])

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast(`${what} copied`)
    } catch {
      toast(text)
    }
  }

  async function shareLink() {
    const url = inviteLink(camp.inviteCode)
    const text = `Join my ${camp.name} camp in Rutline: ${url}  (code ${camp.inviteCode})`
    if (navigator.share) {
      try {
        await navigator.share({ title: `Join ${camp.name}`, text, url })
      } catch {
        /* cancelled */
      }
    } else await copy(url, 'Invite link')
  }

  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-pine-800 border border-bone-50/10 grid place-items-center text-ember-400 shrink-0">
          <Tent size={18} weight="duotone" />
        </div>
        <div className="flex-1 min-w-0">
          {renaming ? (
            <div className="flex gap-2">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="h-9" />
              <Button
                size="sm"
                variant="primary"
                onClick={() =>
                  void run('rename', async () => {
                    await cloud!.renameCamp(camp.id, newName)
                    await refreshCamps()
                    setRenaming(false)
                  }, 'Renamed')
                }
                disabled={busy !== null}
              >
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRenaming(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="text-sm font-semibold tracking-tight truncate">{camp.name}</div>
          )}
          <div className="text-[12px] text-bone-600 mt-0.5">
            {camp.memberCount} member{camp.memberCount === 1 ? '' : 's'} · {owner ? 'you own it' : 'member'}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button onClick={() => copy(camp.inviteCode, 'Code')} className="push inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-pine-900 border border-bone-50/10 font-mono text-[12.5px] tracking-[0.15em] tnum">
              {camp.inviteCode} <CopySimple size={13} className="text-bone-600" />
            </button>
            <Button size="sm" variant="ghost" onClick={shareLink}>
              {typeof navigator !== 'undefined' && 'share' in navigator ? <ShareNetwork size={14} /> : <LinkSimple size={14} />} Invite
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
              <UsersThree size={14} /> Members <CaretDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {open && (
        <div className="mt-3 ml-12 rounded-2xl border border-bone-50/8 bg-pine-900/60 p-3">
          {roster === null && <div className="skeleton h-10" />}
          {roster && (
            <ul className="divide-y divide-bone-50/8">
              {roster.map((m) => (
                <li key={m.userId} className="flex items-center gap-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">
                      {memberLabel(m)} {m.userId === me && <span className="text-bone-600">(you)</span>}
                    </div>
                    <div className="text-[11.5px] text-bone-600">{m.role === 'owner' ? 'owner' : `joined ${new Date(m.joinedAt).toLocaleDateString()}`}</div>
                  </div>
                  {owner && m.userId !== me && (
                    <button
                      onClick={() => {
                        if (!confirm(`Remove ${memberLabel(m)} from ${camp.name}? Their shared pins go back to private.`)) return
                        void run('remove', async () => {
                          await cloud!.removeMember(camp.id, m.userId)
                          await refreshCamps()
                          await syncNow()
                          setRoster((r) => r?.filter((x) => x.userId !== m.userId) ?? null)
                        }, 'Member removed')
                      }}
                      className="push w-8 h-8 grid place-items-center rounded-lg text-bone-600 hover:text-ember-400"
                      aria-label="Remove member"
                    >
                      <UserMinus size={16} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap gap-2 border-t border-bone-50/8 pt-3">
            {owner && (
              <>
                <Button size="sm" variant="ghost" onClick={() => setRenaming(true)} disabled={busy !== null}>
                  Rename
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (!confirm('Make a new code? The old one stops working.')) return
                    void run('rotate', async () => {
                      const code = await cloud!.rotateInviteCode(camp.id)
                      await refreshCamps()
                      toast(`New code ${code}`)
                    })
                  }}
                  disabled={busy !== null}
                >
                  New code
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                if (!confirm(`Leave ${camp.name}? Pins you shared go back to private; pins others shared disappear from your map.`)) return
                void run('leave', async () => {
                  await cloud!.leaveCamp(camp.id)
                  await refreshCamps()
                  await syncNow()
                }, `Left ${camp.name}`)
              }}
              disabled={busy !== null}
            >
              <SignOut size={14} /> Leave
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}
