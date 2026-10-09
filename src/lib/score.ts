/**
 * Boone and Crockett typical whitetail arithmetic, shared by the score sheet
 * and the photo tracer. Everything is inches; the sheet keeps strings so the
 * hunter can type "24 2/8" or "24.25".
 */
export type Side = 'L' | 'R'
export type Measure = 'F' | 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'H1' | 'H2' | 'H3' | 'H4'
export const MEASURES: Array<[Measure, string]> = [
  ['F', 'Main beam'],
  ['G1', 'Brow tine'],
  ['G2', 'Tine 2'],
  ['G3', 'Tine 3'],
  ['G4', 'Tine 4'],
  ['G5', 'Tine 5'],
  ['H1', 'Circ. 1'],
  ['H2', 'Circ. 2'],
  ['H3', 'Circ. 3'],
  ['H4', 'Circ. 4'],
]
export type Sheet = Record<string, string>

/** "24 2/8", "24-2", "24.25", "24" → inches as a number, or null. */
export function parseInches(s: string): number | null {
  const t = s.trim().replace(/"/g, '')
  if (!t) return null
  let m = /^(\d+)(?:[ -](\d)(?:\/8)?)?$/.exec(t)
  if (m) return Number(m[1]) + (m[2] ? Number(m[2]) / 8 : 0)
  m = /^(\d)\/8$/.exec(t)
  if (m) return Number(m[1]) / 8
  const n = Number(t)
  if (Number.isFinite(n)) return Math.round(n * 8) / 8
  return null
}

export function fmtEighths(n: number): string {
  const total = Math.round(n * 8)
  const whole = Math.floor(total / 8)
  const e = total - whole * 8
  return `${whole} ${e}/8`
}

export function scoreSheet(sheet: Sheet) {
  const v = (k: string) => parseInches(sheet[k] ?? '') ?? 0
  const sideSum = (s: Side) => MEASURES.reduce((acc, [m]) => acc + v(`${s}.${m}`), 0)
  const L = sideSum('L')
  const R = sideSum('R')
  const diffs = MEASURES.map(([m]) => Math.abs(v(`L.${m}`) - v(`R.${m}`)))
  const diff = diffs.reduce((a, b) => a + b, 0)
  const longest = Math.max(v('L.F'), v('R.F'))
  const spread = v('spread')
  const credit = longest > 0 ? Math.min(spread, longest) : spread
  const abnormal = v('abnormal')
  const gross = L + R + credit + abnormal
  const net = gross - diff - abnormal
  return { L, R, diffs, diff, credit, spread, abnormal, gross, net, any: L + R + spread + abnormal > 0 }
}
