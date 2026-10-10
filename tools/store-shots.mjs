// App Store screenshots: 6.9-inch iPhone, 1320 x 2868 (440 x 956 CSS px at 3x).
// Drives the dev server with Chrome, seeds a home ground and a few pins,
// and saves PNGs to store/screenshots/. Run `npm run dev` first.
//   node tools/store-shots.mjs
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const BASE = process.env.RUTLINE_URL ?? 'http://localhost:5173'
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const OUT = path.resolve('store/screenshots')
fs.mkdirSync(OUT, { recursive: true })
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.png')) fs.unlinkSync(path.join(OUT, f))

// A wooded corner of Geauga County, Ohio: real parcels with owner names
const HOME = { lat: 41.3745, lon: -81.0565, label: 'Parkman, OH' }
const SETTINGS = {
  home: HOME,
  localOnly: true,
  mapLayer: 'satellite',
  parcelsEnabled: true,
  terrainOn: false,
  publicOn: false,
  unitsOn: false,
  hunter: { name: 'Jordan', phone: '', email: '', town: 'Stow, Ohio' },
}
const PINS = [
  { type: 'stand', name: 'Creek bottom stand', lat: 41.3762, lon: -81.0548, goodWinds: ['NW', 'W', 'SW'], note: 'Climber on the big oak. Deer cross the creek at the beaver dam.' },
  { type: 'blind', name: 'Field edge blind', lat: 41.3728, lon: -81.0592, goodWinds: ['N', 'NE', 'E'] },
  { type: 'scrape', name: 'Scrape line', lat: 41.3751, lon: -81.0571 },
  { type: 'rub', name: 'Rub, fresh', lat: 41.3741, lon: -81.0536 },
  { type: 'bedding', name: 'Thicket bedding', lat: 41.3779, lon: -81.0581 },
  { type: 'food', name: 'Cut corn', lat: 41.3715, lon: -81.0608 },
  { type: 'camera', name: 'Cam 2', lat: 41.3757, lon: -81.0601 },
  { type: 'funnel', name: 'Saddle funnel', lat: 41.3770, lon: -81.0556 },
]
const TRAILS = [
  { name: 'Creek crossing trail', kind: 'trail', points: [[41.3781, -81.0590], [41.3770, -81.0575], [41.3760, -81.0560], [41.3751, -81.0551], [41.3738, -81.0545]] },
  { name: 'Walk in', kind: 'entry', points: [[41.3712, -81.0620], [41.3730, -81.0600], [41.3748, -81.0578], [41.3760, -81.0552]] },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--hide-scrollbars', '--force-dark-mode', '--lang=en-US'],
  defaultViewport: { width: 440, height: 956, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
})
const page = await browser.newPage()
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
await page.evaluateOnNewDocument((settings) => {
  localStorage.setItem('rutline.settings.v1', JSON.stringify(settings))
  sessionStorage.setItem('rutline.splash.seen', '1')
}, SETTINGS)
page.on('pageerror', (e) => console.log('page error:', e.message))

async function open(hash, settle = 2500) {
  await page.goto(`${BASE}/#/${hash}`, { waitUntil: 'load' })
  await page.waitForFunction(() => !!document.querySelector('[data-view-scroll], .leaflet-container'), { timeout: 20000 }).catch(() => {})
  await sleep(settle)
}
async function idle(ms = 1500) {
  await page.waitForNetworkIdle({ idleTime: ms, timeout: 30000 }).catch(() => {})
}
async function shot(name) {
  const file = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: file, type: 'png' })
  console.log('saved', path.relative(process.cwd(), file))
}
async function mapAt(lat, lon, zoom) {
  await open('map', 2000)
  await page.waitForFunction(() => !!window.__map, { timeout: 20000 })
  await page.evaluate((a, b, z) => window.__map.setView([a, b], z, { animate: false }), lat, lon, zoom)
  await idle(2500)
  await sleep(1200)
}

// Seed pins and trails once (the hook is dev-only)
await open('map', 1500)
await page.waitForFunction(() => !!window.__rutline, { timeout: 20000 })
const count = await page.evaluate(async (pins, trails) => {
  const { db, addWaypoint, addTrail } = window.__rutline
  const have = await db.waypoints.count()
  if (have) return have
  for (const p of pins) await addWaypoint(p)
  for (const t of trails) await addTrail(t)
  return db.waypoints.count()
}, PINS, TRAILS)
console.log('waypoints in db:', count)

// 1. Map with pins, trails and property lines
await mapAt(HOME.lat, HOME.lon, 16)
await shot('01-map')

// 2. Tap a parcel, away from the pins, to show the owner of record
await mapAt(HOME.lat - 0.004, HOME.lon - 0.014, 17)
await page.touchscreen.tap(220, 520)
await sleep(2500)
// The record on screen is a real person's. Store screenshots show sample
// owner text instead, so nobody's name and address ship in the listing.
const swapped = await page.evaluate(() => {
  const leaf = (re) => [...document.querySelectorAll('div, span, h2, h3, p')].find((e) => e.children.length === 0 && re.test(e.textContent ?? ''))
  const ownerLabel = leaf(/^owner of record$/i)
  const name = ownerLabel?.nextElementSibling?.textContent?.trim()
  if (!name) return false
  const SAMPLE = 'BLACK CREEK FARMS LLC'
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const nodes = []
  while (walker.nextNode()) nodes.push(walker.currentNode)
  for (const n of nodes) {
    if (n.textContent.includes(name)) n.textContent = n.textContent.split(name).join(SAMPLE)
  }
  // "Tax bill to X" is split across nodes; replace the whole smallest element
  const tax = [...document.querySelectorAll('div, p, span')]
    .filter((e) => /^Tax bill to /.test((e.textContent ?? '').trim()))
    .sort((a, b) => a.textContent.length - b.textContent.length)[0]
  if (tax) tax.textContent = 'Tax bill to ' + SAMPLE
  const mail = leaf(/^mailing address$/i)?.nextElementSibling
  if (mail) {
    const t = [...mail.childNodes].find((c) => c.nodeType === 3 || c.children?.length === 0)
    if (t) t.textContent = 'PO BOX 118, PARKMAN OH 44080'
  }
  const parcel = leaf(/^parcel$/i)?.nextElementSibling
  if (parcel) {
    const t = [...parcel.childNodes].find((c) => c.nodeType === 3 || c.children?.length === 0)
    if (t) t.textContent = '25-000000'
  }
  return true
})
console.log('owner text swapped for sample:', swapped)
await sleep(300)
await shot('02-parcel-owner')

// 3. HuntCast
await open('huntcast', 3500)
await idle(1500)
await shot('03-huntcast')

// 4. Wind and weather
await open('forecast', 3500)
await idle(1500)
await shot('04-wind')

// 5. Scoring: the sheet with the example rack
await open('guide/scoring-a-buck', 2500)
await page.evaluate(() => {
  const s = document.querySelector('[data-view-scroll]')
  if (s) s.scrollTop = s.scrollHeight
})
await sleep(1200)
const example = await page.$$eval('button', (bs) => {
  const b = bs.find((x) => x.textContent.includes('Load the example rack'))
  if (b) b.click()
  return !!b
})
await sleep(900)
await page.evaluate(() => {
  const s = document.querySelector('[data-view-scroll]')
  if (s) s.scrollTop = s.scrollHeight - 1400
})
await sleep(800)
if (example) await shot('05-score-sheet')

// 6. Field guide, a step aligned under the sticky diagram
await open('guide/field-dressing', 2500)
await page.evaluate(() => {
  const s = document.querySelector('[data-view-scroll]')
  const steps = document.querySelectorAll('section.fg-step')
  const stage = document.querySelector('.fg-stage')
  const step = steps[2]
  if (!s || !step || !stage) return
  const top = step.getBoundingClientRect().top - stage.getBoundingClientRect().bottom + s.scrollTop
  s.scrollTop = top + 24
})
await sleep(2500)
await shot('06-field-guide')

// 7. Blood light
await open('tracker', 2500)
await shot('07-blood-light')

// 8. A stand with its huntable winds
await mapAt(HOME.lat + 0.0012, HOME.lon + 0.0012, 17)
const marker = await page.$('.leaflet-marker-icon')
if (marker) {
  const box = await marker.boundingBox()
  if (box) {
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
    await sleep(1800)
    await shot('08-stand')
  }
}

// 9. Field guide index
await open('guide', 2500)
await shot('09-field-guide-index')

await browser.close()
