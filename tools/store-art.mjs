// App Store creative assets (iOS 27 product page): the header (21:9, 3840 x 1646)
// and the search results image (3:2, 3840 x 2560). Captures the live map from the
// dev server as the backdrop, then renders tools/store-header.html and
// tools/store-search.html to store/creative/. Run `npm run dev` first.
//   node tools/store-art.mjs
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import puppeteer from 'puppeteer-core'

const BASE = process.env.RUTLINE_URL ?? 'http://localhost:5173'
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const OUT = path.resolve('store/creative')
fs.mkdirSync(OUT, { recursive: true })

// Same ground and pins as tools/store-shots.mjs
const HOME = { lat: 41.3745, lon: -81.0565, label: 'Parkman, OH' }
const SETTINGS = { home: HOME, localOnly: true, mapLayer: 'satellite', parcelsEnabled: true, terrainOn: false, publicOn: false, unitsOn: false }
const PINS = [
  { type: 'stand', name: 'Creek bottom stand', lat: 41.3762, lon: -81.0548 },
  { type: 'blind', name: 'Field edge blind', lat: 41.3728, lon: -81.0592 },
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
  args: ['--hide-scrollbars', '--allow-file-access-from-files', '--lang=en-US'],
})
const page = await browser.newPage()
page.on('pageerror', (e) => console.log('page error:', e.message))
await page.evaluateOnNewDocument((s) => {
  localStorage.setItem('rutline.settings.v1', JSON.stringify(s))
  sessionStorage.setItem('rutline.splash.seen', '1')
}, SETTINGS)

// Map alone, full viewport, no app chrome: returns a data URL
async function mapShot(width, height, zoom, lat = HOME.lat, lon = HOME.lon) {
  await page.setViewport({ width, height, deviceScaleFactor: 2 })
  await page.goto(`${BASE}/?art=${width}#/map`, { waitUntil: 'load' })
  await page.waitForFunction(() => !!window.__map && !!window.__rutline, { timeout: 20000 })
  await page.evaluate(async (pins, trails) => {
    const { db, addWaypoint, addTrail } = window.__rutline
    if (await db.waypoints.count()) return
    for (const p of pins) await addWaypoint(p)
    for (const t of trails) await addTrail(t)
  }, PINS, TRAILS)
  await page.addStyleTag({ content: `
    body * { visibility: hidden !important; }
    .leaflet-container, .leaflet-container * { visibility: visible !important; }
    .leaflet-container { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 2147483647 !important; }
    .leaflet-control-container { display: none !important; }` })
  await page.evaluate((a, b, z) => { window.__map.invalidateSize(); window.__map.setView([a, b], z, { animate: false }) }, lat, lon, zoom)
  await page.waitForNetworkIdle({ idleTime: 2500, timeout: 45000 }).catch(() => {})
  await sleep(1500)
  if (process.env.ART_DEBUG) {
    console.log(await page.evaluate(() => ({ tiles: document.querySelectorAll('.leaflet-tile-loaded').length, box: JSON.stringify(document.querySelector('.leaflet-container').getBoundingClientRect()) })))
    await page.screenshot({ path: path.join(process.env.ART_DEBUG, `map-${width}.png`) })
  }
  return 'data:image/png;base64,' + (await page.screenshot({ type: 'png', encoding: 'base64' }))
}

async function render(template, map, width, height, name) {
  await page.setViewport({ width, height, deviceScaleFactor: 2 })
  await page.goto(pathToFileURL(path.resolve('tools', template)).href, { waitUntil: 'load' })
  // Set on the element: a multi-MB data URL in a custom property silently fails
  await page.evaluate((m) => { document.querySelector('.map').style.backgroundImage = `url("${m}")` }, map)
  await page.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode().catch(() => {}))]))
  await sleep(500)
  const file = path.join(OUT, name)
  // Opaque page, so Chrome writes RGB with no alpha channel (Apple rejects transparency)
  await page.screenshot({ path: file, type: 'png', clip: { x: 0, y: 0, width, height } })
  console.log('wrote', path.relative(process.cwd(), file))
}

const wide = await mapShot(1920, 823, 17)
await render('store-header.html', wide, 1920, 823, 'header-3840x1646.png')
const tall = await mapShot(1920, 1280, 17)
await render('store-search.html', tall, 1920, 1280, 'search-3840x2560.png')
await browser.close()
