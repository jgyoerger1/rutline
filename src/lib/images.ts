/** Decode an image honouring EXIF orientation where the browser supports it. */
async function decode(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' } as ImageBitmapOptions)
    } catch {
      /* fall through to <img> */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image.'))
    }
    img.src = url
  })
}

function dims(src: ImageBitmap | HTMLImageElement): { w: number; h: number } {
  return 'naturalWidth' in src ? { w: src.naturalWidth, h: src.naturalHeight } : { w: src.width, h: src.height }
}

export async function shrinkImage(blob: Blob, maxEdge = 1600, quality = 0.84): Promise<{ blob: Blob; width: number; height: number }> {
  const src = await decode(blob)
  const { w, h } = dims(src)
  const scale = Math.min(1, maxEdge / Math.max(w, h))
  const width = Math.max(1, Math.round(w * scale))
  const height = Math.max(1, Math.round(h * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.drawImage(src, 0, 0, width, height)
  if ('close' in src) src.close()
  const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality))
  if (!out) throw new Error('Could not encode image')
  return { blob: out, width, height }
}

export async function makeThumb(blob: Blob, edge = 360): Promise<Blob> {
  const { blob: out } = await shrinkImage(blob, edge, 0.78)
  return out
}

/**
 * Pull DateTimeOriginal out of a JPEG's EXIF block so trail-cam pulls sort by
 * when the deer walked by, not when you uploaded them.
 */
export async function readExifDate(file: Blob): Promise<number | null> {
  if (file.type !== 'image/jpeg' && file.type !== 'image/jpg') return null
  const head = await file.slice(0, 256 * 1024).arrayBuffer()
  const view = new DataView(head)
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null
  let offset = 2
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset)
    if (marker === 0xffe1) {
      const len = view.getUint16(offset + 2)
      const start = offset + 4
      if (view.byteLength < start + 6) return null
      const sig = String.fromCharCode(...new Uint8Array(head, start, 4))
      if (sig !== 'Exif') return null
      return parseTiff(view, start + 6, start + len - 2)
    }
    if ((marker & 0xff00) !== 0xff00) return null
    offset += 2 + view.getUint16(offset + 2)
  }
  return null
}

function parseTiff(view: DataView, tiff: number, end: number): number | null {
  if (tiff + 8 > view.byteLength) return null
  const little = view.getUint16(tiff) === 0x4949
  const u16 = (o: number) => view.getUint16(o, little)
  const u32 = (o: number) => view.getUint32(o, little)
  const ifd0 = tiff + u32(tiff + 4)
  const readAscii = (o: number, n: number) => {
    let s = ''
    for (let i = 0; i < n && o + i < view.byteLength; i++) {
      const c = view.getUint8(o + i)
      if (c === 0) break
      s += String.fromCharCode(c)
    }
    return s
  }
  const scanIfd = (ifd: number): { exifPtr?: number; dateTime?: string; original?: string } => {
    const out: { exifPtr?: number; dateTime?: string; original?: string } = {}
    if (ifd + 2 > end) return out
    const n = u16(ifd)
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12
      if (e + 12 > end) break
      const tag = u16(e)
      const count = u32(e + 4)
      const valOff = count > 4 ? tiff + u32(e + 8) : e + 8
      if (tag === 0x8769) out.exifPtr = tiff + u32(e + 8)
      if (tag === 0x0132) out.dateTime = readAscii(valOff, count)
      if (tag === 0x9003) out.original = readAscii(valOff, count)
    }
    return out
  }
  const a = scanIfd(ifd0)
  const b = a.exifPtr ? scanIfd(a.exifPtr) : {}
  const raw = b.original ?? a.original ?? a.dateTime
  if (!raw) return null
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(raw)
  if (!m) return null
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])
  return Number.isNaN(d.getTime()) ? null : d.getTime()
}
