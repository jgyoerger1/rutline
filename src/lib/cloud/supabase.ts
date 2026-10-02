import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import type { AuthEvent, CloudBackend, CloudUser, OAuthProvider, PushRow, RemoteProfile, RemoteRow, SyncTable } from './types'

interface Row {
  uid: string
  user_id: string
  type?: string | null
  lat?: number | null
  lon?: number | null
  waypoint_uid?: string | null
  data: Record<string, unknown>
  client_updated_at: number
  deleted_at: number | null
  synced_at: string
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
  if (/password should be/i.test(msg)) return 'Use a password of at least 8 characters.'
  if (/token has expired|invalid|otp/i.test(msg)) return 'That code is wrong or has expired. Request a new one.'
  return msg
}

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
    const { error } = await this.sb.rpc('delete_account')
    fail(error)
    await this.sb.auth.signOut()
  }

  async pull(table: SyncTable, sinceIso: string | null): Promise<RemoteRow[]> {
    let q = this.sb.from(table).select('*').order('synced_at', { ascending: true }).limit(2000)
    if (sinceIso) q = q.gt('synced_at', sinceIso)
    const { data, error } = await q
    fail(error)
    return ((data ?? []) as Row[]).map((r) => ({
      uid: r.uid,
      data: { ...r.data, ...(table === 'waypoints' ? { type: r.type, lat: r.lat, lon: r.lon } : {}), ...(table === 'trails' ? { kind: r.type } : {}), ...(table === 'photos' ? { waypointUid: r.waypoint_uid } : {}) },
      clientUpdatedAt: Number(r.client_updated_at),
      deletedAt: r.deleted_at == null ? null : Number(r.deleted_at),
      syncedAt: r.synced_at,
    }))
  }

  async push(table: SyncTable, rows: PushRow[]): Promise<void> {
    if (!this.userId) throw new Error('Not signed in')
    const payload = rows.map((r) => {
      const base: Record<string, unknown> = { uid: r.uid, user_id: this.userId, data: r.data, client_updated_at: r.clientUpdatedAt, deleted_at: r.deletedAt }
      if (table === 'waypoints') Object.assign(base, { type: r.type ?? null, lat: r.lat ?? null, lon: r.lon ?? null })
      if (table === 'trails') Object.assign(base, { type: r.type ?? null })
      if (table === 'photos') Object.assign(base, { waypoint_uid: r.waypointUid ?? null })
      return base
    })
    const { error } = await this.sb.from(table).upsert(payload, { onConflict: 'uid' })
    fail(error)
  }

  async getProfile(): Promise<RemoteProfile | null> {
    if (!this.userId) return null
    const { data, error } = await this.sb.from('profiles').select('settings, settings_updated_at').eq('id', this.userId).maybeSingle()
    fail(error)
    if (!data) return null
    return { settings: (data.settings as Record<string, unknown>) ?? {}, updatedAt: Number(data.settings_updated_at ?? 0) }
  }

  async putProfile(settings: Record<string, unknown>, updatedAt: number): Promise<void> {
    if (!this.userId) throw new Error('Not signed in')
    const { error } = await this.sb.from('profiles').upsert({ id: this.userId, settings, settings_updated_at: updatedAt }, { onConflict: 'id' })
    fail(error)
  }

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
