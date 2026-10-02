/** The slice of a backend the app needs. Supabase implements it for real; a mock implements it for local testing. */

export type SyncTable = 'waypoints' | 'trails' | 'photos'

export interface CloudUser {
  id: string
  email: string | null
}

export type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'PASSWORD_RECOVERY' | 'TOKEN_REFRESHED' | 'USER_UPDATED' | 'INITIAL'

export interface RemoteRow {
  uid: string
  /** Table-specific payload (everything that is not a sync column) */
  data: Record<string, unknown>
  clientUpdatedAt: number
  deletedAt: number | null
  /** Server write time, ISO string; the pull cursor */
  syncedAt: string
}

export interface PushRow {
  uid: string
  data: Record<string, unknown>
  clientUpdatedAt: number
  deletedAt: number | null
  /** Indexed columns duplicated out of data for the server */
  type?: string
  lat?: number
  lon?: number
  waypointUid?: string | null
}

export interface RemoteProfile {
  settings: Record<string, unknown>
  updatedAt: number
}

export type OAuthProvider = 'google' | 'apple'

export interface CloudBackend {
  readonly kind: 'supabase' | 'mock'
  readonly providers: OAuthProvider[]

  getUser(): Promise<CloudUser | null>
  onAuthChange(cb: (user: CloudUser | null, event: AuthEvent) => void): () => void

  signInWithPassword(email: string, password: string): Promise<void>
  signUpWithPassword(email: string, password: string): Promise<{ needsConfirmation: boolean }>
  sendEmailCode(email: string): Promise<void>
  verifyEmailCode(email: string, code: string): Promise<void>
  signInWithProvider(provider: OAuthProvider): Promise<void>
  sendPasswordReset(email: string): Promise<void>
  updatePassword(password: string): Promise<void>
  signOut(): Promise<void>
  deleteAccount(): Promise<void>

  pull(table: SyncTable, sinceIso: string | null): Promise<RemoteRow[]>
  push(table: SyncTable, rows: PushRow[]): Promise<void>

  getProfile(): Promise<RemoteProfile | null>
  putProfile(settings: Record<string, unknown>, updatedAt: number): Promise<void>

  uploadPhoto(path: string, blob: Blob): Promise<void>
  downloadPhoto(path: string): Promise<Blob>
  deletePhotos(paths: string[]): Promise<void>
}
