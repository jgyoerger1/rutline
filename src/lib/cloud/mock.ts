/**
 * A fake backend that lives in localStorage so the sign-in, sync and camp
 * flows can be exercised end to end on a dev build with no project. Any
 * password of 8+ characters works; the one-time code is always 000000.
 * Sign out and sign in as a second email to play the friend. Never enabled
 * in production.
 */
import type { AuthEvent, Camp, CampMember, CampRole, CloudBackend, CloudUser, OAuthProvider, PushRow, RemoteProfile, RemoteRow, SyncTable } from './types'

interface StoredRow extends RemoteRow {
  path?: string | null
  thumbPath?: string | null
}

interface StoredCamp {
  id: string
  name: string
  inviteCode: string
  createdBy: string
  members: Array<{ userId: string; role: CampRole; joinedAt: string }>
}

interface Store {
  users: Record<string, { id: string; email: string }>
  session: CloudUser | null
  tables: Record<string, Record<string, StoredRow | undefined>>
  profiles: Record<string, RemoteProfile>
  camps: Record<string, StoredCamp>
  files: Record<string, string>
}

const KEY = 'rutline.mockcloud.v2'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

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
    return { users: {}, session: null, tables: {}, profiles: {}, camps: {}, files: {} }
  }

  private save(): void {
    localStorage.setItem(KEY, JSON.stringify(this.store))
  }

  private now(): string {
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
      this.store.profiles[u.id] = { settings: {}, updatedAt: 0, displayName: null }
    }
    return u
  }

  private isMember(campId: string | null, userId: string): boolean {
    if (!campId) return false
    return !!this.store.camps[campId]?.members.some((m) => m.userId === userId)
  }

  private canSee(r: StoredRow, userId: string): boolean {
    return r.userId === userId || this.isMember(r.campId, userId)
  }

  // ---------- auth ----------

  async getUser(): Promise<CloudUser | null> {
    return this.store.session
  }

  onAuthChange(cb: (user: CloudUser | null, event: AuthEvent) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  async signInWithPassword(email: string, password: string): Promise<void> {
    await sleep(300)
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
    await sleep(300)
    if (!email.includes('@')) throw new Error('Enter a valid email.')
  }

  async verifyEmailCode(email: string, code: string): Promise<void> {
    await sleep(300)
    if (code.trim() !== '000000') throw new Error('That code is wrong or has expired. Request a new one.')
    this.store.session = this.userFor(email)
    this.save()
    this.emit('SIGNED_IN')
  }

  async signInWithProvider(provider: OAuthProvider): Promise<void> {
    await sleep(400)
    this.store.session = this.userFor(`${provider}-user@example.com`)
    this.save()
    this.emit('SIGNED_IN')
  }

  async sendPasswordReset(): Promise<void> {
    await sleep(300)
  }

  async updatePassword(password: string): Promise<void> {
    await sleep(300)
    if (password.length < 8) throw new Error('Use a password of at least 8 characters.')
  }

  async signOut(): Promise<void> {
    this.store.session = null
    this.save()
    this.emit('SIGNED_OUT')
  }

  async deleteAccount(): Promise<void> {
    const u = this.user()
    for (const t of Object.values(this.store.tables)) for (const k of Object.keys(t)) if (t[k]?.userId === u.id) delete t[k]
    delete this.store.profiles[u.id]
    for (const c of Object.values(this.store.camps)) c.members = c.members.filter((m) => m.userId !== u.id)
    for (const k of Object.keys(this.store.files)) if (k.startsWith(`${u.id}/`)) delete this.store.files[k]
    await this.signOut()
  }

  // ---------- rows ----------

  async pull(table: SyncTable, sinceIso: string | null): Promise<RemoteRow[]> {
    await sleep(120)
    const u = this.user()
    return Object.values(this.store.tables[table] ?? {})
      .filter((r): r is StoredRow => !!r && this.canSee(r, u.id))
      .filter((r) => !sinceIso || r.syncedAt > sinceIso)
      .sort((a, b) => (a.syncedAt < b.syncedAt ? -1 : 1))
      .map((r) => ({ uid: r.uid, userId: r.userId, campId: r.campId, data: { ...r.data, ...(table === 'photos' ? { path: r.path ?? null, thumbPath: r.thumbPath ?? null } : {}) }, clientUpdatedAt: r.clientUpdatedAt, deletedAt: r.deletedAt, syncedAt: r.syncedAt }))
  }

  async push(table: SyncTable, rows: PushRow[]): Promise<void> {
    await sleep(120)
    const u = this.user()
    const t = (this.store.tables[table] ??= {})
    for (const r of rows) {
      const existing = t[r.uid]
      if (existing && !this.canSee(existing, u.id)) throw new Error('Not allowed')
      const owner = existing?.userId ?? r.userId ?? u.id
      t[r.uid] = {
        uid: r.uid,
        userId: owner,
        campId: r.campId ?? null,
        data: { ...r.data, ...(r.type ? { type: r.type, kind: r.type } : {}), ...(r.lat != null ? { lat: r.lat, lon: r.lon } : {}), ...(r.waypointUid !== undefined ? { waypointUid: r.waypointUid } : {}) },
        path: r.path ?? existing?.path ?? null,
        thumbPath: r.thumbPath ?? existing?.thumbPath ?? null,
        clientUpdatedAt: r.clientUpdatedAt,
        deletedAt: r.deletedAt,
        syncedAt: this.now(),
      }
      // photos follow their pin's camp
      if (table === 'waypoints') {
        for (const p of Object.values(this.store.tables.photos ?? {})) if (p && p.data.waypointUid === r.uid && p.campId !== (r.campId ?? null)) { p.campId = r.campId ?? null; p.syncedAt = this.now() }
      }
    }
    this.save()
  }

  async visible(table: SyncTable, uids: string[]): Promise<string[]> {
    const u = this.user()
    const t = this.store.tables[table] ?? {}
    return uids.filter((id) => {
      const r = t[id]
      return !!r && this.canSee(r, u.id)
    })
  }

  // ---------- profile ----------

  async getProfile(): Promise<RemoteProfile | null> {
    return this.store.profiles[this.user().id] ?? null
  }

  async putProfile(settings: Record<string, unknown>, updatedAt: number): Promise<void> {
    const id = this.user().id
    this.store.profiles[id] = { ...(this.store.profiles[id] ?? { displayName: null }), settings, updatedAt }
    this.save()
  }

  async setDisplayName(name: string): Promise<void> {
    const id = this.user().id
    this.store.profiles[id] = { ...(this.store.profiles[id] ?? { settings: {}, updatedAt: 0 }), displayName: name.trim() || null }
    this.save()
  }

  // ---------- camps ----------

  private campFor(c: StoredCamp, userId: string): Camp {
    return { id: c.id, name: c.name, inviteCode: c.inviteCode, role: c.members.find((m) => m.userId === userId)?.role ?? 'member', memberCount: c.members.length, createdBy: c.createdBy }
  }

  private code(): string {
    let s = ''
    for (let i = 0; i < 8; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    return s
  }

  async listCamps(): Promise<Camp[]> {
    await sleep(100)
    const u = this.user()
    return Object.values(this.store.camps)
      .filter((c) => c.members.some((m) => m.userId === u.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => this.campFor(c, u.id))
  }

  async createCamp(name: string): Promise<Camp> {
    await sleep(200)
    const u = this.user()
    if (!name.trim()) throw new Error('Give the camp a name')
    const c: StoredCamp = { id: crypto.randomUUID(), name: name.trim(), inviteCode: this.code(), createdBy: u.id, members: [{ userId: u.id, role: 'owner', joinedAt: new Date().toISOString() }] }
    this.store.camps[c.id] = c
    this.save()
    return this.campFor(c, u.id)
  }

  async joinCamp(code: string): Promise<Camp> {
    await sleep(200)
    const u = this.user()
    const c = Object.values(this.store.camps).find((x) => x.inviteCode === code.trim().toUpperCase())
    if (!c) throw new Error('No camp has that code')
    if (!c.members.some((m) => m.userId === u.id)) c.members.push({ userId: u.id, role: 'member', joinedAt: new Date().toISOString() })
    this.save()
    return this.campFor(c, u.id)
  }

  async leaveCamp(campId: string): Promise<void> {
    await sleep(150)
    const u = this.user()
    const c = this.store.camps[campId]
    if (!c) return
    c.members = c.members.filter((m) => m.userId !== u.id)
    for (const t of Object.values(this.store.tables)) for (const r of Object.values(t)) if (r && r.campId === campId && r.userId === u.id) { r.campId = null; r.syncedAt = this.now() }
    if (!c.members.length) delete this.store.camps[campId]
    else if (!c.members.some((m) => m.role === 'owner')) { c.members[0].role = 'owner'; c.createdBy = c.members[0].userId }
    this.save()
  }

  async renameCamp(campId: string, name: string): Promise<void> {
    const u = this.user()
    const c = this.store.camps[campId]
    if (!c || c.createdBy !== u.id) throw new Error('Only the camp owner can rename it')
    c.name = name.trim() || c.name
    this.save()
  }

  async rotateInviteCode(campId: string): Promise<string> {
    const u = this.user()
    const c = this.store.camps[campId]
    if (!c || c.createdBy !== u.id) throw new Error('Only the camp owner can change the code')
    c.inviteCode = this.code()
    this.save()
    return c.inviteCode
  }

  async removeMember(campId: string, userId: string): Promise<void> {
    const u = this.user()
    const c = this.store.camps[campId]
    if (!c || c.createdBy !== u.id) throw new Error('Only the camp owner can remove members')
    c.members = c.members.filter((m) => m.userId !== userId)
    for (const t of Object.values(this.store.tables)) for (const r of Object.values(t)) if (r && r.campId === campId && r.userId === userId) { r.campId = null; r.syncedAt = this.now() }
    this.save()
  }

  async campRoster(campId: string): Promise<CampMember[]> {
    await sleep(100)
    const u = this.user()
    const c = this.store.camps[campId]
    if (!c || !c.members.some((m) => m.userId === u.id)) throw new Error('Not a member of that camp')
    return c.members.map((m) => {
      const email = Object.values(this.store.users).find((x) => x.id === m.userId)?.email ?? null
      return { userId: m.userId, displayName: this.store.profiles[m.userId]?.displayName ?? null, email, role: m.role, joinedAt: m.joinedAt }
    })
  }

  // ---------- storage ----------

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
