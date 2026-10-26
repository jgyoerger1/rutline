/**
 * Score cards: a square-ish image a hunter posts with the buck. Drawn on a
 * canvas from the app's own fonts and colours, shared through the phone's
 * share sheet, or saved when the browser cannot share files.
 */
export interface ScoreCardSpec {
  /** The buck's photo; the card is typographic without one */
  photo?: Blob | null
  eyebrow: string
  title: string
  /** The big line: "138 to 150 gross" or "Gross 154 6/8" */
  score: string
  /** Under the score: "4½ years · AI read, medium confidence" */
  detail?: string
  /** Small lines at the bottom of the text block */
  lines?: string[]
}

const W = 1080
const H = 1350
const BG = '#0f1311'
const BONE = '#f2ede2'
const BONE_2 = '#bdb7aa'
const BONE_3 = '#8b8578'
const EMBER = '#e8702c'

async function fontsReady(): Promise<void> {
  try {
    await Promise.all([document.fonts.load('700 80px "Chakra Petch"'), document.fonts.load('600 56px "Geist Variable"'), document.fonts.load('500 30px "Geist Mono Variable"')])
  } catch {
    /* fall back to whatever the canvas has */
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image failed'))
    img.src = src
  })
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(' ')
  const out: string[] = []
  let line = ''
  for (const w of words) {
    const t = line ? `${line} ${w}` : w
    if (ctx.measureText(t).width > max && line) {
      out.push(line)
      line = w
    } else line = t
  }
  if (line) out.push(line)
  return out
}

export async function renderScoreCard(spec: ScoreCardSpec): Promise<Blob> {
  await fontsReady()
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, W, H)

  // Photo, cover-cropped into the top, fading into the dark block
  let textTop = 120
  if (spec.photo) {
    try {
      const bmp = await createImageBitmap(spec.photo, { imageOrientation: 'from-image' })
      const ph = 900
      const k = Math.max(W / bmp.width, ph / bmp.height)
      const dw = bmp.width * k
      const dh = bmp.height * k
      ctx.drawImage(bmp, (W - dw) / 2, (ph - dh) / 2, dw, dh)
      bmp.close()
      const g = ctx.createLinearGradient(0, ph - 420, 0, ph + 1)
      g.addColorStop(0, 'rgba(15,19,17,0)')
      g.addColorStop(1, BG)
      ctx.fillStyle = g
      ctx.fillRect(0, ph - 420, W, 421)
      textTop = ph - 40
    } catch {
      /* no photo: typographic card */
    }
  }

  const pad = 72
  let y = textTop
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = EMBER
  ctx.font = '500 26px "Geist Mono Variable", ui-monospace, monospace'
  ctx.letterSpacing = '6px'
  ctx.fillText(spec.eyebrow.toUpperCase(), pad, y)
  ctx.letterSpacing = '0px'

  y += 78
  ctx.fillStyle = BONE
  ctx.font = '600 64px "Geist Variable", system-ui, sans-serif'
  const titleLines = wrap(ctx, spec.title, W - pad * 2).slice(0, 2)
  for (const l of titleLines) {
    ctx.fillText(l, pad, y)
    y += 72
  }

  y += 30
  ctx.fillStyle = BONE
  ctx.font = '700 104px "Chakra Petch", "Geist Variable", sans-serif'
  const scoreLines = wrap(ctx, spec.score, W - pad * 2).slice(0, 2)
  for (const l of scoreLines) {
    ctx.fillText(l, pad, y)
    y += 112
  }

  if (spec.detail) {
    y += 2
    ctx.fillStyle = BONE_2
    ctx.font = '500 34px "Geist Variable", system-ui, sans-serif'
    for (const l of wrap(ctx, spec.detail, W - pad * 2).slice(0, 2)) {
      ctx.fillText(l, pad, y)
      y += 44
    }
  }
  if (spec.lines?.length) {
    y += 26
    ctx.fillStyle = BONE_3
    ctx.font = '500 27px "Geist Mono Variable", ui-monospace, monospace'
    for (const l of spec.lines.slice(0, 4)) {
      ctx.fillText(l, pad, y)
      y += 40
    }
  }

  // Footer: hairline, mark, wordmark, the line that sells the app
  const fy = H - 130
  ctx.strokeStyle = 'rgba(242,237,226,0.12)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(pad, fy - 46)
  ctx.lineTo(W - pad, fy - 46)
  ctx.stroke()
  try {
    const mark = await loadImage('icons/icon-192.png')
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(pad, fy - 10, 64, 64, 14)
    ctx.clip()
    ctx.drawImage(mark, pad, fy - 10, 64, 64)
    ctx.restore()
  } catch {
    /* no mark */
  }
  ctx.font = '700 44px "Chakra Petch", sans-serif'
  ctx.letterSpacing = '3px'
  ctx.fillStyle = BONE
  ctx.fillText('RUT', pad + 86, fy + 38)
  const rutW = ctx.measureText('RUT').width
  ctx.fillStyle = EMBER
  ctx.fillText('LINE', pad + 86 + rutW, fy + 38)
  ctx.letterSpacing = '0px'
  ctx.fillStyle = BONE_3
  ctx.font = '500 26px "Geist Mono Variable", ui-monospace, monospace'
  ctx.textAlign = 'right'
  ctx.fillText('Scored with Rutline', W - pad, fy + 12)
  ctx.fillText('jordanyoerger.com/rutline', W - pad, fy + 48)
  ctx.textAlign = 'left'

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas failed'))), 'image/jpeg', 0.9))
}

/** Share through the phone's sheet; otherwise save the file. Returns how it went out. */
export async function shareImage(blob: Blob, filename: string, text: string): Promise<'shared' | 'saved' | 'opened'> {
  const file = new File([blob], filename, { type: blob.type })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text })
      return 'shared'
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return 'shared'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10000)
  return 'saved'
}
