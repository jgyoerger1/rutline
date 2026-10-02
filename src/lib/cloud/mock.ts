/**
 * A fake backend that lives in localStorage so the sign-in and sync flows can
 * be exercised end to end on a dev build with no project. Any password works;
 * the one-time code is always 000000. Never enabled in production.
 */
import type { AuthEvent, CloudBackend, CloudUser, OAuthProvider, PushRow, RemoteProfile, RemoteRow, SyncTable } from './types'

interface Store {
  users: Record<string, { id: string; email: string }>
  session: CloudUser | null
  tables: Record<string, Record<string, Record<string, (RemoteRow & { userId: string }) | undefined>>>
  profiles: Record<string, RemoteProfile>
  files: Record<string, string>
}

const KEY = 'rutline.mockcloud.v1'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result))
    r.onerror = () => rej(r.error)
    r.readAsDataURL(blob)
  })
}

export class MockBackend implements CloudBackend {
  readonly kind = 'mock' as const
  readonly providers: OAuthProvider[] = ['google']
  private store: Store
  private listeners = new Set<(u: CloudUser | null, e: AuthEvent) => void>()
  private tick = 0

  constructor() {
    this.store = this.load()
  }

  private load(): Store {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) return JSON.parse(raw) as Store
    } catch {
      /* fresh */
    }
    return { users: {}, session: null, tables: {}, profiles: {}, files: {} }
  }

  private save(): void {
    localStorage.setItem(KEY, JSON.stringify(this.store))
  }

  private now(): string {
    // strictly increasing so cursors never skip a row
    const t = Math.max(Date.now(), this.tick + 1)
    this.tick = t
    return new Date(t).toISOString()
  }

  private emit(e: AuthEvent): void {
    this.listeners.forEach((l) => l(this.store.session, e))
  }

  private user(): CloudUser {
    if (!this.store.session) throw new Error('Not signed in')
    return this.store.session
  }

  private userFor(email: string): CloudUser {
    const key = email.trim().toLowerCase()
    let u = this.store.users[key]
    if (!u) {
      u = { id: `mock-${btoa(key).replace(/[^a-z0-9]/gi, '').slice(0, 12)}`, email: key }
      this.store.users[key] = u
    }
    return u
  }

  async getUser(): Promise<CloudUser | null> {
    return this.store.session
  }

  onAuthChange(cb: (user: CloudUser | null, event: AuthEvent) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  async signInWithPassword(email: string, password: string): Promise<void> {
    await sleep(400)
    if (!email.includes('@')) throw new Error('Enter a valid email.')
    if (password.length < 8) throw new Error('Wrong email or password.')
    this.store.session = this.userFor(email)
    this.save()
    this.emit('SIGNED_IN')
  }

  async signUpWithPassword(email: string, password: string): Promise<{ needsConfirmation: boolean }> {
    await this.signInWithPassword(email, password)
    return { needsConfirmation: false }
  }

  async sendEmailCode(email: string): Promise<void> {
    await sleep(400)
    if (!email.includes('@')) throw new Error('Enter a valid email.')
  }

  async verifyEmailCode(email: string, code: string): Promise<void> {
    await sleep(400)
    if (code.trim() !== '000000') throw new Error('That code is wrong or has expired. Request a new one.')
    this.store.session = this.userFor(email)
    this.save()
    this.emit('SIGNED_IN')
  }

  async signInWithProvider(provider: OAuthProvider): Promise<void> {
    await sleep(600)
    this.store.session = this.userFor(`${provider}-user@example.com`)
    this.save()
    this.emit('SIGNED_IN')
  }

  async sendPasswordReset(): Promise<void> {
    await sleep(300)
  }

  async updatePassword(): Promise<void> {
    await sleep(300)
  }

  async signOut(): Promise<void> {
    this.store.session = null
    this.save()
    this.emit('SIGNED_OUT')
  }

  async deleteAccount(): Promise<void> {
    const u = this.user()
    for (const t of Object.values(this.store.tables)) delete t[u.id]
    delete this.store.profiles[u.id]
    for (const k of Object.keys(this.store.files)) if (k.startsWith(`${u.id}/`)) delete this.store.files[k]
    await this.signOut()
  }

  async pull(table: SyncTable, sinceIso: string | null): Promise<RemoteRow[]> {
    await sleep(150)
    const u = this.user()
    const rows = Object.values(this.store.tables[table]?.[u.id] ?? {}).filter((r): r is RemoteRow & { userId: string } => !!r)
    return rows
      .filter((r) => !sinceIso || r.syncedAt > sinceIso)
      .sort((a, b) => (a.syncedAt < b.syncedAt ? -1 : 1))
      .map(({ userId, ...r }) => {
        void userId
        return r
      })
  }

  async push(table: SyncTable, rows: PushRow[]): Promise<void> {
    await sleep(150)
    const u = this.user()
    const t = (this.store.tables[table] ??= {})
    const mine = (t[u.id] ??= {})
    for (const r of rows) {
      mine[r.uid] = { uid: r.uid, data: { ...r.data, ...(r.type ? { type: r.type, kind: r.type } : {}), ...(r.lat != null ? { lat: r.lat, lon: r.lon } : {}), ...(r.waypointUid !== undefined ? { waypointUid: r.waypointUid } : {}) }, clientUpdatedAt: r.clientUpdatedAt, deletedAt: r.deletedAt, syncedAt: this.now(), userId: u.id }
    }
    this.save()
  }

  async getProfile(): Promise<RemoteProfile | null> {
    return this.store.profiles[this.user().id] ?? null
  }

  async putProfile(settings: Record<string, unknown>, updatedAt: number): Promise<void> {
    this.store.profiles[this.user().id] = { settings, updatedAt }
    this.save()
  }

  async uploadPhoto(path: string, blob: Blob): Promise<void> {
    this.store.files[path] = await blobToDataUrl(blob)
    this.save()
  }

  async downloadPhoto(path: string): Promise<Blob> {
    const d = this.store.files[path]
    if (!d) throw new Error('Photo missing')
    const res = await fetch(d)
    return res.blob()
  }

  async deletePhotos(paths: string[]): Promise<void> {
    for (const p of paths) delete this.store.files[p]
    this.save()
  }
}
