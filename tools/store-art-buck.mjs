// Alternate App Store creative assets, brand art only (the buck and the lockup, no
// headline), from tools/store-art-buck.html. The primary set with the headline over the
// live map is tools/store-art.mjs. Both write to store/creative/:
//   header-lockup-3840x1646.jpg   product-page header, 21:9 (Apple: fixed 3840 x 1646)
//   search-lockup-3840x2560.jpg   search-results artwork, 3:2 (Apple: 1920 x 1280 to 3840 x 2560)
// JPEG, no alpha (Apple rejects transparency). The lockup reaches past Apple's safe area
// (the middle 43% x 40%), so check the App Store Connect preview on a small phone.
//   node tools/store-art-buck.mjs
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import puppeteer from 'puppeteer-core'

const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const OUT = path.resolve('store/creative')
fs.mkdirSync(OUT, { recursive: true })
const KINDS = {
  header: { width: 3840, height: 1646 },
  search: { width: 3840, height: 2560 },
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--allow-file-access-from-files', '--hide-scrollbars'] })
for (const [kind, size] of Object.entries(KINDS)) {
  const page = await browser.newPage()
  await page.setViewport({ ...size, deviceScaleFactor: 1 })
  await page.goto(`${pathToFileURL(path.resolve('tools/store-art-buck.html')).href}?kind=${kind}`, { waitUntil: 'load' })
  // Let the background images decode before the capture
  await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => (i.onload = i.onerror = r))))))
  await new Promise((r) => setTimeout(r, 400))
  const file = path.join(OUT, `${kind}-lockup-${size.width}x${size.height}.jpg`)
  await page.screenshot({ path: file, type: 'jpeg', quality: 92, clip: { x: 0, y: 0, ...size } })
  console.log('wrote', path.relative(process.cwd(), file))
  await page.close()
}
await browser.close()
