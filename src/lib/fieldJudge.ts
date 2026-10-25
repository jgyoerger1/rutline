/**
 * Field judging a whitetail from a photo, the way hunters do it in the stand:
 * everything is measured against the deer's own head. On a mature Midwest
 * buck the ears span about 16 inches tip to tip when alert, an ear is about
 * 7 inches long, and eye to nose runs about 8 inches. Antlers compared to
 * those landmarks give a gross Boone and Crockett estimate good to roughly
 * plus or minus ten inches. It is a guess, not a tape.
 */
export type SpreadClass = 'inside' | 'ears' | 'outside' | 'wide'
export type BeamClass = 'short' | 'nose' | 'past'
export type TineClass = 'short' | 'average' | 'long'
export type MassClass = 'thin' | 'average' | 'heavy'

export interface FieldJudgeInput {
  /** Typical points on the whole rack, 6 to 14 */
  points: number
  spread: SpreadClass
  beam: BeamClass
  tines: TineClass
  mass: MassClass
}

export interface FieldJudgeResult {
  low: number
  high: number
  mid: number
  /** Per-side pieces, so the hunter can see where the inches come from */
  parts: { spread: number; beam: number; tines: number; mass: number }
}

export const SPREAD_OPTIONS: Array<{ value: SpreadClass; label: string; hint: string; inches: number }> = [
  { value: 'inside', label: 'Inside the ears', hint: 'Tips end before the ear tips', inches: 13 },
  { value: 'ears', label: 'At the ear tips', hint: 'Even with alert ears, about 16 in', inches: 16 },
  { value: 'outside', label: 'An inch or two outside', hint: 'Past the ears by a finger or two', inches: 18 },
  { value: 'wide', label: 'Well outside', hint: 'A hand or more past each ear', inches: 21 },
]
export const BEAM_OPTIONS: Array<{ value: BeamClass; label: string; hint: string; inches: number }> = [
  { value: 'short', label: 'Short of the nose', hint: 'Beam tips stop near the eye', inches: 18 },
  { value: 'nose', label: 'To the nose', hint: 'Tips reach the end of the nose in profile', inches: 21 },
  { value: 'past', label: 'Past the nose', hint: 'Tips curl out beyond the nose', inches: 24 },
]
export const TINE_OPTIONS: Array<{ value: TineClass; label: string; hint: string; factor: number }> = [
  { value: 'short', label: 'Short', hint: 'G2 shorter than an ear, about 6 in', factor: 0.78 },
  { value: 'average', label: 'Average', hint: 'G2 about an ear long, 7 to 8 in', factor: 1 },
  { value: 'long', label: 'Long', hint: 'G2 well past an ear, 10 in or more', factor: 1.28 },
]
export const MASS_OPTIONS: Array<{ value: MassClass; label: string; hint: string; inches: number }> = [
  { value: 'thin', label: 'Thin', hint: 'Bases thinner than the eye is wide', inches: 14 },
  { value: 'average', label: 'Average', hint: 'Bases about the width of the eye', inches: 16.5 },
  { value: 'heavy', label: 'Heavy', hint: 'Bases wider than the eye, mass carried out', inches: 19.5 },
]

/** Average tine lengths per side for a frame with this many points, before the tine factor */
function tinesPerSide(points: number): number {
  const perSide = Math.max(3, Math.min(7, Math.round(points / 2)))
  // Brow, G2, G3, G4, G5... typical inches on an average mature buck
  const typical = [4, 8, 6.5, 4.5, 2.5, 1.5, 1]
  let total = 0
  for (let i = 0; i < perSide - 1; i++) total += typical[i] ?? 1
  return total
}

export function fieldJudge(input: FieldJudgeInput): FieldJudgeResult {
  const spread = SPREAD_OPTIONS.find((o) => o.value === input.spread)?.inches ?? 16
  const beam = BEAM_OPTIONS.find((o) => o.value === input.beam)?.inches ?? 21
  const tineFactor = TINE_OPTIONS.find((o) => o.value === input.tines)?.factor ?? 1
  const mass = MASS_OPTIONS.find((o) => o.value === input.mass)?.inches ?? 16.5
  const tines = tinesPerSide(input.points) * tineFactor
  const mid = spread + 2 * (beam + tines + mass)
  const band = Math.max(8, Math.round(mid * 0.07))
  return {
    low: Math.round(mid - band),
    high: Math.round(mid + band),
    mid: Math.round(mid),
    parts: { spread, beam: Math.round(beam), tines: Math.round(tines), mass: Math.round(mass) },
  }
}
