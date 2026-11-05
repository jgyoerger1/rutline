// Blood light screenshot with the camera running. Chrome's fake camera plays a still
// photo (store/source/blood-trail.jpg) as the live feed, so the capture shows the real
// tracker UI the way a hunter sees it: the filtered frame, scanline, corner brackets,
// the Blood pill and the pixel count. Run `npm run dev` first.
//   node tools/blood-shot.mjs                   # 6.3-inch class, 1206 x 2622 (402 x 874 CSS px at 3x)
//   node tools/blood-shot.mjs --class=6.9       # 1320 x 2868; --class=duo-outer (1398 x 2034) and duo-inner (2007 x 2853) for iPhone Duo
//   node tools/blood-shot.mjs --photo=some.jpg  # another source photo; a landscape photo is extended to a portrait frame
//   node tools/blood-shot.mjs --still           # the "Try it on a photo" state instead of the live camera
// Writes store/screenshots/<class>/07-blood-light.png (the raw capture that tools/store-frames.mjs
// captions) and store/creative/blood-light-<w>x<h>.png (the same frame, for feature cards and posts).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const CLASSES = { '6.3': { width: 402, height: 874 }, '6.9': { width: 440, height: 956 }, 'duo-outer': { width: 466, height: 678 }, 'duo-inner': { width: 669, height: 951 } }
const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`)) ?? `--${name}=${fallback}`).slice(name.length + 3)
const CLASS = arg('class', '6.3')
const SIZE = CLASSES[CLASS]
if (!SIZE) throw new Error(`unknown class ${CLASS}; use ${Object.keys(CLASSES).join(' or ')}`)
const PHOTO = path.resolve(arg('photo', 'store/source/blood-trail.jpg'))
const STILL = process.argv.includes('--still')

const BASE = process.env.RUTLINE_URL ?? 'http://localhost:5173'
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const RAW = path.resolve('store/screenshots', CLASS)
const CREATIVE = path.resolve('store/creative')
fs.mkdirSync(RAW, { recursive: true })
fs.mkdirSync(CREATIVE, { recursive: true })
if (!fs.existsSync(PHOTO)) throw new Error(`no source photo at ${PHOTO}`)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Same ground as tools/store-shots.mjs, Pro on so the free-minutes counter stays out of the frame
const SETTINGS = {
  home: { lat: 41.3745, lon: -81.0565, label: 'Parkman, OH' },
  localOnly: true,
  mapLayer: 'satellite',
  parcelsEnabled: true,
  hunter: { name: 'Jordan', phone: '', email: '', town: 'Stow, Ohio' },
  trackerColor: 'red',
  trackerSound: false,
}

// A phone camera in portrait hands the tracker 720 x 1280 frames. A portrait photo is
// cover-cropped to that; a landscape photo sits across the middle, and gray copies of it
// (turned, then flipped) fill the frame above and below, feathered in so no seam shows.
async function cameraFrame(photo, W = 720, H = 1280) {
  const sharp = (await import('sharp')).default
  const { width, height } = await sharp(photo).metadata()
  if (height / width >= (H / W) * 0.9) return sharp(photo).resize(W, H, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer()
  const mid = await sharp(photo).resize(W).toBuffer()
  const mh = (await sharp(mid).metadata()).height
  const top = Math.round((H - mh) / 2)
  // The gray copies are a touch larger than the photo so they reach well under its edges
  const fillH = Math.min(H, Math.round(mh * 1.18))
  const filler = (s) => s.resize(W, fillH, { fit: 'cover' }).modulate({ saturation: 0, brightness: 0.9 }).toBuffer()
  const above = await filler(sharp(mid).rotate(180))
  const below = await filler(sharp(mid).flip())
  const feather = Math.max(8, Math.min(150, fillH - top, top + mh - (H - fillH)))
  // The photo as raw RGBA, its top and bottom rows fading out over the feather
  const rgb = await sharp(mid).removeAlpha().raw().toBuffer()
  const centre = Buffer.alloc(W * mh * 4)
  for (let y = 0; y < mh; y++) {
    const a = Math.round(255 * (y < feather ? y / feather : y >= mh - feather ? (mh - 1 - y) / feather : 1))
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3, o = (y * W + x) * 4
      centre[o] = rgb[i]; centre[o + 1] = rgb[i + 1]; centre[o + 2] = rgb[i + 2]; centre[o + 3] = a
    }
  }
  return sharp({ create: { width: W, height: H, channels: 3, background: '#2b2b2b' } })
    .composite([
      { input: above, top: 0, left: 0 },
      { input: below, top: H - fillH, left: 0 },
      { input: centre, raw: { width: W, height: mh, channels: 4 }, top, left: 0 },
    ])
    .jpeg({ quality: 90 })
    .toBuffer()
}

// Chrome plays an .mjpeg file (JPEG frames back to back; one frame loops) as the camera
const frameFile = path.join(os.tmpdir(), 'rutline-blood-frame.mjpeg')
fs.writeFileSync(frameFile, await cameraFrame(PHOTO))

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    '--hide-scrollbars',
    '--force-dark-mode',
    '--lang=en-US',
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    `--use-file-for-fake-video-capture=${frameFile}`,
  ],
  defaultViewport: { ...SIZE, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
})
await browser.defaultBrowserContext().overridePermissions(BASE, ['camera'])
const page = await browser.newPage()
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
await page.evaluateOnNewDocument((s) => {
  localStorage.setItem('rutline.settings.v1', JSON.stringify(s))
  sessionStorage.setItem('rutline.splash.seen', '1')
  localStorage.setItem('rutline.pro', '1') // dev-only Pro override (src/lib/pro.ts)
}, SETTINGS)
page.on('pageerror', (e) => console.log('page error:', e.message))

await page.goto(`${BASE}/?shot=blood#/tracker`, { waitUntil: 'load' })
await page.waitForFunction(() => !!document.querySelector('[data-view-scroll]'), { timeout: 20000 }).catch(() => {})
await sleep(1500)

if (STILL) {
  const input = await page.$('input[type=file]')
  await input.uploadFile(PHOTO)
} else {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((el) => /Start camera/.test(el.textContent ?? ''))
    if (!b) throw new Error('no Start camera button')
    b.click()
  })
}
// The canvas loses `hidden` once the feed (or the photo) is on it
await page.waitForFunction(() => {
  const c = document.querySelector('canvas')
  return !!c && !c.classList.contains('hidden')
}, { timeout: 15000 })
await sleep(3000) // hits average over frames and the Blood pill springs in
// Hold the scan sweep about two fifths of the way down the frame instead of wherever it happens to be
await page.addStyleTag({ content: '.scanline { animation-play-state: paused !important; animation-delay: -1.15s !important; }' })
await sleep(200)
const state = await page.evaluate(() => ({
  live: !!document.querySelector('.scanline'),
  blood: /\bBlood\b/.test(document.body.innerText),
  px: document.body.innerText.match(/(\d+) px/)?.[1] ?? '0',
  error: document.body.innerText.match(/Camera did not open[\s\S]{0,160}/)?.[0] ?? null,
}))
console.log(STILL ? 'photo' : 'camera', state)
if (state.error) throw new Error(state.error)

const raw = path.join(RAW, '07-blood-light.png')
await page.screenshot({ path: raw, type: 'png' })
console.log('wrote', path.relative(process.cwd(), raw))
// The phone-size frame also goes to store/creative for feature cards and posts; the other classes are store-only
if (CLASS === '6.3') {
  const out = path.join(CREATIVE, `blood-light-${SIZE.width * 3}x${SIZE.height * 3}.png`)
  fs.copyFileSync(raw, out)
  console.log('wrote', path.relative(process.cwd(), out))
}
await browser.close()
