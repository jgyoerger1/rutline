import { cloud } from './cloud'
import { shrinkImage } from './images'
import type { BuckRead } from './types'

/** What the score-buck server function returns (schema lives in supabase/functions/score-buck) */
export interface BuckReadResponse {
  is_buck: boolean
  points: number | null
  age_class: '1.5' | '2.5' | '3.5' | '4.5' | '5.5+' | 'unknown'
  age_confidence: 'low' | 'medium' | 'high'
  gross_low: number
  gross_high: number
  score_confidence: 'low' | 'medium' | 'high'
  why: string
  limit: string
}

export interface BuckReadHints {
  /** Where the photo was taken, e.g. "Geauga County, Ohio" */
  region?: string
  /** Month the photo was taken, 1-12, for body condition */
  month?: number
  trailCam?: boolean
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

/**
 * Ask the server for an AI read of a buck photo. Needs a signed-in account:
 * the model's API key lives on the server, never in the app. The photo is
 * resized to 1280 px before it goes up and is not stored by the server.
 */
export async function readBuck(photo: Blob, photoId: string, hints: BuckReadHints = {}): Promise<BuckRead> {
  if (!cloud) throw new Error('AI reads need an account, and this build has no account service.')
  if (!(await cloud.getUser())) throw new Error('Sign in to get an AI read. The field judge below works without one.')
  const small = await shrinkImage(photo, 1280, 0.8)
  const image = await blobToBase64(small.blob)
  const r = await cloud.callFunction<BuckReadResponse>('score-buck', { image, mediaType: 'image/jpeg', hints })
  if (!r.is_buck) throw new Error(r.why || 'No antlered deer could be made out in that photo.')
  return {
    source: 'ai',
    at: Date.now(),
    ageClass: r.age_class === 'unknown' ? null : r.age_class,
    points: r.points,
    grossLow: Math.round(r.gross_low),
    grossHigh: Math.round(r.gross_high),
    confidence: r.score_confidence,
    why: r.why,
    limit: r.limit,
    photoId,
  }
}
