import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import type { AuthEvent, Camp, CampMember, CampRole, CloudBackend, CloudUser, OAuthProvider, PushRow, RemoteProfile, RemoteRow, SyncTable } from './types'

interface Row {
  uid: string
  user_id: string
  camp_id: string | null
  type?: string | null
  lat?: number | null
  lon?: number | null
  waypoint_uid?: string | null
  path?: string | null
  thumb_path?: string | null
  data: Record<string, unknown>
  client_updated_at: number
  deleted_at: number | null
  synced_at: string
}

interface CampRow {
  id: string
  name: string
  invite_code: string
  role: string
  member_count: number | string
  created_by: string
}

function toUser(s: Session | null): CloudUser | null {
  return s?.user ? { id: s.user.id, email: s.user.email ?? null } : null
}

function fail(error: { message: string } | null): void {
  if (error) throw new Error(friendly(error.message))
}

function friendly(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'Wrong email or password.'
  if (/email not confirmed/i.test(msg)) return 'Confirm your email first. Check your inbox for the link.'
  if (/rate limit|too many/i.test(msg)) return 'Too many attempts for now. Try again in a few minutes.'
  if (/already registered/i.test(msg)) return 'That email already has an account. Sign in instead.'
  if (/password should be|at least 6|at least 8/i.test(msg)) return 'Use a password of at least 8 characters.'
  if (/same password|different from the old/i.test(msg)) return 'Pick a password different from your current one.'
  if (/token has expired|invalid|otp/i.test(msg)) return 'That code is wrong or has expired. Request a new one.'
  if (/does not exist|could not find the function|schema cache/i.test(msg)) return 'The database is behind the app. Re-run supabase/schema.sql in the Supabase SQL editor, then sync again.'
  return msg
}

const toCamp = (c: CampRow): Camp => ({ id: c.id, name: c.name, inviteCode: c.invite_code, role: (c.role as CampRole) ?? 'member', memberCount: Number(c.member_count ?? 1), createdBy: c.created_by })

export class SupabaseBackend implements CloudBackend {
  readonly kind = 'supabase' as const
  readonly providers: OAuthProvider[]
  private sb: SupabaseClient
  private userId: string | null = null

  constructor(url: string, anonKey: string, providers: OAuthProvider[]) {
    this.providers = providers
    this.sb = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storageKey: 'rutline.auth' },
    })
  }

  private redirectTo(): string {
    return `${location.origin}${location.pathname}`
  }

  private me(): string {
    if (!this.userId) throw new Error('Not signed in')
    return this.userId
  }

  async getUser(): Promise<CloudUser | null> {
    const { data } = await this.sb.auth.getSession()
    const u = toUser(data.session)
    this.userId = u?.id ?? null
    return u
  }

  onAuthChange(cb: (user: CloudUser | null, event: AuthEvent) => void): () => void {
    const { data } = this.sb.auth.onAuthStateChange((event, session) => {
      const u = toUser(session)
      this.userId = u?.id ?? null
      cb(u, event as AuthEvent)
    })
    return () => data.subscription.unsubscribe()
  }

  async signInWithPassword(email: string, password: string): Promise<void> {
    const { error } = await this.sb.auth.signInWithPassword({ email, password })
    fail(error)
  }

  async signUpWithPassword(email: string, password: string): Promise<{ needsConfirmation: boolean }> {
    const { data, error } = await this.sb.auth.signUp({ email, password, options: { emailRedirectTo: this.redirectTo() } })
    fail(error)
    return { needsConfirmation: !data.session }
  }

  async sendEmailCode(email: string): Promise<void> {
    const { error } = await this.sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: this.redirectTo() } })
    fail(error)
  }

  async verifyEmailCode(email: string, code: string): Promise<void> {
    const { error } = await this.sb.auth.verifyOtp({ email, token: code.trim(), type: 'email' })
    fail(error)
  }

  async signInWithProvider(provider: OAuthProvider): Promise<void> {
    const { error } = await this.sb.auth.signInWithOAuth({ provider, options: { redirectTo: this.redirectTo() } })
    fail(error)
  }

  async sendPasswordReset(email: string): Promise<void> {
    const { error } = await this.sb.auth.resetPasswordForEmail(email, { redirectTo: this.redirectTo() })
    fail(error)
  }

  async updatePassword(password: string): Promise<void> {
    const { error } = await this.sb.auth.updateUser({ password })
    fail(error)
  }

  async signOut(): Promise<void> {
    await this.sb.auth.signOut()
    this.userId = null
  }

  async deleteAccount(): Promise<void> {
    const prefix = this.me()
    // Storage objects must go through the Storage API; the database function cannot remove them
    for (let guard = 0; guard < 50; guard++) {
      const { data, error } = await this.sb.storage.from('photos').list(prefix, { limit: 100 })
      fail(error)
      if (!data?.length) break
      const { error: rmErr } = await this.sb.storage.from('photos').remove(data.map((o) => prefix + '/' + o.name))
      fail(rmErr)
      if (data.length < 100) break
    }
    const { error } = await this.sb.rpc('delete_account')
    fail(error)
    await this.sb.auth.signOut()
    this.userId = null
  }

  // ---------- rows ----------

  async pull(table: SyncTable, sinceIso: string | null): Promise<RemoteRow[]> {
    let q = this.sb.from(table).select('*').order('synced_at', { ascending: true }).limit(2000)
    if (sinceIso) q = q.gt('synced_at', sinceIso)
    const { data, error } = await q
    fail(error)
    return ((data ?? []) as Row[]).map((r) => ({
      uid: r.uid,
      userId: r.user_id,
      campId: r.camp_id ?? null,
      data: {
        ...r.data,
        ...(table === 'waypoints' ? { type: r.type, lat: r.lat, lon: r.lon } : {}),
        ...(table === 'trails' ? { kind: r.type } : {}),
        ...(table === 'photos' ? { waypointUid: r.waypoint_uid, path: r.path ?? r.data.path ?? null, thumbPath: r.thumb_path ?? r.data.thumbPath ?? null } : {}),
      },
      clientUpdatedAt: Number(r.client_updated_at),
      deletedAt: r.deleted_at == null ? null : Number(r.deleted_at),
      syncedAt: r.synced_at,
    }))
  }

  async push(table: SyncTable, rows: PushRow[]): Promise<void> {
    this.me()
    const payload = rows.map((r) => {
      const base: Record<string, unknown> = { uid: r.uid, user_id: r.userId, camp_id: r.campId, data: r.data, client_updated_at: r.clientUpdatedAt, deleted_at: r.deletedAt }
      if (table === 'waypoints') Object.assign(base, { type: r.type ?? null, lat: r.lat ?? null, lon: r.lon ?? null })
      if (table === 'trails') Object.assign(base, { type: r.type ?? null })
      if (table === 'photos') Object.assign(base, { waypoint_uid: r.waypointUid ?? null, path: r.path ?? null, thumb_path: r.thumbPath ?? null })
      return base
    })
    const { error } = await this.sb.from(table).upsert(payload, { onConflict: 'uid' })
    fail(error)
  }

  async visible(table: SyncTable, uids: string[]): Promise<string[]> {
    if (!uids.length) return []
    const out: string[] = []
    for (let i = 0; i < uids.length; i += 200) {
      const { data, error } = await this.sb.from(table).select('uid').in('uid', uids.slice(i, i + 200))
      fail(error)
      for (const r of (data ?? []) as Array<{ uid: string }>) out.push(r.uid)
    }
    return out
  }

  // ---------- profile ----------

  async getProfile(): Promise<RemoteProfile | null> {
    if (!this.userId) return null
    let { data, error } = await this.sb.from('profiles').select('settings, settings_updated_at, display_name').eq('id', this.userId).maybeSingle()
    if (error && /display_name/i.test(error.message)) {
      // Schema not yet updated for camps: settings still sync, the name waits
      ;({ data, error } = await this.sb.from('profiles').select('settings, settings_updated_at').eq('id', this.userId).maybeSingle())
    }
    fail(error)
    if (!data) return null
    const d = data as { settings?: Record<string, unknown>; settings_updated_at?: number; display_name?: string | null }
    return { settings: d.settings ?? {}, updatedAt: Number(d.settings_updated_at ?? 0), displayName: d.display_name ?? null }
  }

  async putProfile(settings: Record<string, unknown>, updatedAt: number): Promise<void> {
    const id = this.me()
    const { error } = await this.sb.from('profiles').upsert({ id, settings, settings_updated_at: updatedAt }, { onConflict: 'id' })
    fail(error)
  }

  async setDisplayName(name: string): Promise<void> {
    const id = this.me()
    const { error } = await this.sb.from('profiles').upsert({ id, display_name: name.trim() || null }, { onConflict: 'id' })
    fail(error)
  }

  // ---------- camps ----------

  async listCamps(): Promise<Camp[]> {
    const { data, error } = await this.sb.rpc('my_camps')
    fail(error)
    return ((data ?? []) as CampRow[]).map(toCamp)
  }

  async createCamp(name: string): Promise<Camp> {
    const { data, error } = await this.sb.rpc('create_camp', { p_name: name })
    fail(error)
    const c = data as CampRow
    return toCamp({ ...c, role: 'owner', member_count: 1 })
  }

  async joinCamp(code: string): Promise<Camp> {
    const { data, error } = await this.sb.rpc('join_camp', { p_code: code })
    fail(error)
    const c = data as CampRow
    return toCamp({ ...c, role: c.created_by === this.userId ? 'owner' : 'member', member_count: 0 })
  }

  async leaveCamp(campId: string): Promise<void> {
    const { error } = await this.sb.rpc('leave_camp', { p_camp: campId })
    fail(error)
  }

  async renameCamp(campId: string, name: string): Promise<void> {
    const { error } = await this.sb.rpc('rename_camp', { p_camp: campId, p_name: name })
    fail(error)
  }

  async rotateInviteCode(campId: string): Promise<string> {
    const { data, error } = await this.sb.rpc('rotate_invite_code', { p_camp: campId })
    fail(error)
    return String(data)
  }

  async removeMember(campId: string, userId: string): Promise<void> {
    const { error } = await this.sb.rpc('remove_member', { p_camp: campId, p_user: userId })
    fail(error)
  }

  async campRoster(campId: string): Promise<CampMember[]> {
    const { data, error } = await this.sb.rpc('camp_roster', { p_camp: campId })
    fail(error)
    return ((data ?? []) as Array<{ user_id: string; display_name: string | null; email: string | null; role: string; joined_at: string }>).map((m) => ({
      userId: m.user_id,
      displayName: m.display_name,
      email: m.email,
      role: (m.role as CampRole) ?? 'member',
      joinedAt: m.joined_at,
    }))
  }

  // ---------- storage ----------

  async uploadPhoto(path: string, blob: Blob): Promise<void> {
    const { error } = await this.sb.storage.from('photos').upload(path, blob, { upsert: true, contentType: blob.type || 'image/jpeg', cacheControl: '31536000' })
    fail(error)
  }

  async downloadPhoto(path: string): Promise<Blob> {
    const { data, error } = await this.sb.storage.from('photos').download(path)
    fail(error)
    if (!data) throw new Error('Photo missing')
    return data
  }

  async deletePhotos(paths: string[]): Promise<void> {
    if (!paths.length) return
    const { error } = await this.sb.storage.from('photos').remove(paths)
    if (error && !/not found/i.test(error.message)) fail(error)
  }
}
