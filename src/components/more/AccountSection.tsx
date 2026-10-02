import { ArrowsClockwise, CloudArrowUp, CloudCheck, CloudSlash, CloudWarning, SignOut, Trash, UserCircle } from '@phosphor-icons/react'
import { useState } from 'react'
import { useAuth } from '../../lib/auth'
import { cloud, cloudConfigured } from '../../lib/cloud'
import { relTime } from '../../lib/format'
import { setSettings } from '../../lib/settings'
import { deleteAccount, deleteEverything, signOut, syncNow, useSyncStatus } from '../../lib/sync'
import { useApp } from '../AppContext'
import { Button, Input, SectionLabel } from '../ui'

export function syncLabel(s: ReturnType<typeof useSyncStatus>): { text: string; Icon: typeof CloudCheck; tone: string } {
  switch (s.state) {
    case 'syncing':
      return { text: 'Syncing', Icon: CloudArrowUp, tone: 'text-ember-400' }
    case 'offline':
      return { text: s.pending ? `Offline, ${s.pending} change${s.pending === 1 ? '' : 's'} waiting` : 'Offline', Icon: CloudSlash, tone: 'text-bone-400' }
    case 'error':
      return { text: s.error ?? 'Sync failed', Icon: CloudWarning, tone: 'text-ember-400' }
    case 'switch':
      return { text: 'Waiting on you', Icon: CloudWarning, tone: 'text-ember-400' }
    default:
      return { text: s.lastSyncedAt ? `Synced ${relTime(s.lastSyncedAt)}${s.pending ? `, ${s.pending} waiting` : ''}` : 'Not synced yet', Icon: CloudCheck, tone: 'text-bone-400' }
  }
}

export default function AccountSection() {
  const { toast } = useApp()
  const auth = useAuth()
  const sync = useSyncStatus()
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmText, setConfirmText] = useState('')

  if (!cloudConfigured || !cloud) {
    return (
      <div className="text-sm text-bone-400 leading-relaxed">
        <div className="text-bone-50 font-medium">Cloud sync is not set up on this build</div>
        Everything stays on this device until a Supabase project is connected. The setup takes about fifteen minutes and is written up in{' '}
        <a href="https://github.com/jgyoerger1/rutline/blob/main/supabase/README.md" target="_blank" rel="noreferrer" className="text-bone-50 underline underline-offset-4 decoration-bone-50/30">
          supabase/README.md
        </a>
        . Use Backup below to move data between devices in the meantime.
      </div>
    )
  }

  if (!auth.user) {
    return (
      <div>
        <p className="text-sm text-bone-400 leading-relaxed">You are running on this device only. Sign in to back everything up and use it on your phone and your desk.</p>
        <Button variant="primary" className="mt-3" onClick={() => setSettings({ localOnly: false })}>
          <UserCircle size={18} /> Sign in or create an account
        </Button>
      </div>
    )
  }

  const { text, Icon, tone } = syncLabel(sync)

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
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-pine-800 border border-bone-50/10 grid place-items-center text-ember-400 shrink-0">
          <UserCircle size={22} weight="duotone" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{auth.user.email ?? auth.user.id}</div>
          <div className={`mt-0.5 inline-flex items-center gap-1.5 text-[12.5px] ${tone}`}>
            <Icon size={14} className={sync.state === 'syncing' ? 'breathe' : ''} /> {text}
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => void run('sync', syncNow)} disabled={busy !== null || sync.state === 'syncing'}>
          <ArrowsClockwise size={15} className={sync.state === 'syncing' ? 'animate-spin' : ''} /> Sync now
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void run('out', () => signOut(false), 'Signed out. Your data is still on this device.')} disabled={busy !== null}>
          <SignOut size={15} /> Sign out, keep data here
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            if (!confirm('Sign out and remove all pins, lines and photos from this device? They stay in your account.')) return
            void run('outclear', () => signOut(true), 'Signed out and cleared this device.')
          }}
          disabled={busy !== null}
        >
          Sign out and clear this device
        </Button>
      </div>

      <div className="border-t border-bone-50/8 pt-4">
        <SectionLabel className="mb-2">Danger zone</SectionLabel>
        <p className="text-[12.5px] text-bone-600 leading-relaxed">Type DELETE to enable the buttons. Deleting everything removes every pin, line and photo from your account and from this device. Deleting the account also removes your sign-in.</p>
        <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" className="mt-2 max-w-[200px] font-mono" />
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="danger"
            disabled={confirmText !== 'DELETE' || busy !== null}
            onClick={() => {
              if (!confirm('Delete everything in your account and on this device?')) return
              void run('wipe', deleteEverything, 'Everything deleted.')
            }}
          >
            <Trash size={15} /> Delete everything
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={confirmText !== 'DELETE' || busy !== null}
            onClick={() => {
              if (!confirm('Delete your account? This cannot be undone.')) return
              void run('acct', deleteAccount, 'Account deleted.')
            }}
          >
            Delete my account
          </Button>
        </div>
      </div>
    </div>
  )
}
