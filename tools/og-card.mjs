// Renders the Facebook / iMessage link preview (Open Graph image) from
// tools/og-card.html to public/brand/og.jpg at 2400 x 1260 (1200 x 630 @2x).
//   node tools/og-card.mjs
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import puppeteer from 'puppeteer-core'

const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const src = pathToFileURL(path.resolve('tools/og-card.html')).href
const out = path.resolve('public/brand/og.jpg')

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--allow-file-access-from-files'],
  defaultViewport: { width: 1200, height: 630, deviceScaleFactor: 2 },
})
const page = await browser.newPage()
await page.goto(src, { waitUntil: 'load' })
await page.evaluate(() => document.fonts.ready)
const missing = await page.evaluate(() => ['Chakra Petch', 'Geist', 'Geist Mono'].filter((f) => !document.fonts.check(`700 20px "${f}"`)))
if (missing.length) console.warn('fonts not loaded:', missing.join(', '))
await page.screenshot({ path: out, type: 'jpeg', quality: 88, clip: { x: 0, y: 0, width: 1200, height: 630 } })
await browser.close()
console.log('wrote', path.relative(process.cwd(), out))
