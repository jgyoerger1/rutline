// App Store creative assets (iOS 27 product pages) from tools/store-art.html:
//   store/art/header-3840x1646.jpg   product-page header, 21:9 (Apple: fixed 3840 x 1646)
//   store/art/search-3840x2560.jpg   search-results artwork, 3:2 (Apple: 1920 x 1280 to 3840 x 2560)
// Both JPEG, no alpha (Apple rejects transparency). Nothing lives in the outer 20% of
// either side, since Apple crops the edges on some devices.
//   node tools/store-art.mjs
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import puppeteer from 'puppeteer-core'

const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const OUT = path.resolve('store/art')
fs.mkdirSync(OUT, { recursive: true })
const KINDS = {
  header: { width: 3840, height: 1646 },
  search: { width: 3840, height: 2560 },
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--allow-file-access-from-files', '--hide-scrollbars'] })
for (const [kind, size] of Object.entries(KINDS)) {
  const page = await browser.newPage()
  await page.setViewport({ ...size, deviceScaleFactor: 1 })
  await page.goto(`${pathToFileURL(path.resolve('tools/store-art.html')).href}?kind=${kind}`, { waitUntil: 'load' })
  // Let the background images decode before the capture
  await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => (i.onload = i.onerror = r))))))
  await new Promise((r) => setTimeout(r, 400))
  const file = path.join(OUT, `${kind}-${size.width}x${size.height}.jpg`)
  await page.screenshot({ path: file, type: 'jpeg', quality: 92, clip: { x: 0, y: 0, ...size } })
  console.log('wrote', path.relative(process.cwd(), file))
  await page.close()
}
await browser.close()
