// Captioned App Store screenshots: each raw capture from tools/store-shots.mjs gets a
// short headline above it (tools/store-frames.html) and is written, in App Store order,
// to store/screenshots/<class>-captioned/. The first three are what search results show.
//   node tools/store-frames.mjs             # 6.3-inch class (1206 x 2622), the one Apple requires
//   node tools/store-frames.mjs --class=6.9
//   node tools/store-frames.mjs --only=blood-light   # redo one (or a comma list); the rest stay as they are
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import puppeteer from 'puppeteer-core'

const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const CLASSES = { '6.3': { width: 402, height: 874 }, '6.9': { width: 440, height: 956 } }
const CLASS = (process.argv.find((a) => a.startsWith('--class=')) ?? '--class=6.3').slice('--class='.length)
const SIZE = CLASSES[CLASS]
if (!SIZE) throw new Error(`unknown class ${CLASS}`)
const RAW = path.resolve('store/screenshots', CLASS)
const OUT = path.resolve('store/screenshots', `${CLASS}-captioned`)
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) ?? '--only=').slice('--only='.length).split(',').filter(Boolean)
fs.mkdirSync(OUT, { recursive: true })
if (!ONLY.length) for (const f of fs.readdirSync(OUT)) if (f.endsWith('.png')) fs.unlinkSync(path.join(OUT, f))

// App Store order: the first three show in search results, so the pitch comes first
const SHOTS = [
  { raw: '01-map', out: '01-map', kicker: 'Stands · trails · property lines', title: 'Your ground, on one map' },
  { raw: '04-wind', out: '02-wind', kicker: 'Live wind · next 48 hours', title: 'Know which stand to sit, and why' },
  { raw: '02-parcel-owner', out: '03-landowner', kicker: 'Owner of record · county records', title: 'Who owns it, before you knock' },
  { raw: '10-lidar-terrain', out: '04-terrain', kicker: 'LiDAR · USGS 3DEP', title: 'Benches, saddles and draws, lit up' },
  { raw: '03-huntcast', out: '05-huntcast', kicker: 'HuntCast', title: 'A daily deer-movement forecast' },
  { raw: '07-blood-light', out: '06-blood-light', kicker: 'After the shot', title: 'Blood light for the trail' },
  { raw: '08-stand', out: '07-stand', kicker: 'Every pin', title: 'Each stand knows its winds' },
  { raw: '05-score-sheet', out: '08-score', kicker: 'Field guide', title: 'Score the rack, no math' },
  { raw: '06-field-guide', out: '09-field-dressing', kicker: 'Field guide', title: 'Field dressing, step by step' },
  { raw: '09-field-guide-index', out: '10-guide', kicker: 'Field guide', title: 'The whole guide, in your pocket' },
]

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--allow-file-access-from-files', '--hide-scrollbars'],
  defaultViewport: { ...SIZE, deviceScaleFactor: 3 },
})
const page = await browser.newPage()
const html = pathToFileURL(path.resolve('tools/store-frames.html')).href
for (const s of SHOTS) {
  if (ONLY.length && !ONLY.some((o) => s.out.includes(o) || s.raw.includes(o))) continue
  const src = path.join(RAW, `${s.raw}.png`)
  if (!fs.existsSync(src)) {
    console.log('missing raw capture, skipped:', path.relative(process.cwd(), src))
    continue
  }
  const q = new URLSearchParams({ kicker: s.kicker, title: s.title, src: pathToFileURL(src).href })
  await page.goto(`${html}?${q}`, { waitUntil: 'load' })
  await page.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map((i) => (i.complete ? null : new Promise((r) => (i.onload = i.onerror = r))))]))
  await new Promise((r) => setTimeout(r, 150))
  const file = path.join(OUT, `${s.out}.png`)
  await page.screenshot({ path: file, type: 'png' })
  console.log('saved', path.relative(process.cwd(), file))
}
await browser.close()
