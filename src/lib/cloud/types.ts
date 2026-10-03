/** The slice of a backend the app needs. Supabase implements it for real; a mock implements it for local testing. */

export type SyncTable = 'waypoints' | 'trails' | 'photos'

export interface CloudUser {
  id: string
  email: string | null
}

export type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'PASSWORD_RECOVERY' | 'TOKEN_REFRESHED' | 'USER_UPDATED' | 'INITIAL'

export interface RemoteRow {
  uid: string
  /** Who owns the row */
  userId: string
  /** Camp it is shared with, if any */
  campId: string | null
  /** Table-specific payload (everything that is not a sync column) */
  data: Record<string, unknown>
  clientUpdatedAt: number
  deletedAt: number | null
  /** Server write time, ISO string; the pull cursor */
  syncedAt: string
}

export interface PushRow {
  uid: string
  /** Owner. Stays the original owner when a camp member edits a shared row */
  userId: string
  campId: string | null
  data: Record<string, unknown>
  clientUpdatedAt: number
  deletedAt: number | null
  /** Indexed columns duplicated out of data for the server */
  type?: string
  lat?: number
  lon?: number
  waypointUid?: string | null
  path?: string | null
  thumbPath?: string | null
}

export interface RemoteProfile {
  settings: Record<string, unknown>
  updatedAt: number
  displayName: string | null
}

export type CampRole = 'owner' | 'member'

export interface Camp {
  id: string
  name: string
  inviteCode: string
  role: CampRole
  memberCount: number
  createdBy: string
}

export interface CampMember {
  userId: string
  displayName: string | null
  email: string | null
  role: CampRole
  joinedAt: string
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
  /** Which of these rows the current user can still see (membership may have changed) */
  visible(table: SyncTable, uids: string[]): Promise<string[]>

  getProfile(): Promise<RemoteProfile | null>
  putProfile(settings: Record<string, unknown>, updatedAt: number): Promise<void>
  setDisplayName(name: string): Promise<void>

  listCamps(): Promise<Camp[]>
  createCamp(name: string): Promise<Camp>
  joinCamp(code: string): Promise<Camp>
  leaveCamp(campId: string): Promise<void>
  renameCamp(campId: string, name: string): Promise<void>
  rotateInviteCode(campId: string): Promise<string>
  removeMember(campId: string, userId: string): Promise<void>
  campRoster(campId: string): Promise<CampMember[]>

  uploadPhoto(path: string, blob: Blob): Promise<void>
  downloadPhoto(path: string): Promise<Blob>
  deletePhotos(paths: string[]): Promise<void>
}
