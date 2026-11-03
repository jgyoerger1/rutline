// Google Play store graphics: the 1024 x 500 feature graphic (from
// tools/feature-graphic.html) and the 512 x 512 hi-res icon (from
// resources/icon-only.png), both to store/play/.
//   node tools/feature-graphic.mjs
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import puppeteer from 'puppeteer-core'
import sharp from 'sharp'

const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const OUT = path.resolve('store/play')

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--allow-file-access-from-files'],
  defaultViewport: { width: 1024, height: 500, deviceScaleFactor: 1 },
})
const page = await browser.newPage()
await page.goto(pathToFileURL(path.resolve('tools/feature-graphic.html')).href, { waitUntil: 'load' })
await page.evaluate(() => document.fonts.ready)
const missing = await page.evaluate(() => ['Chakra Petch', 'Geist', 'Geist Mono'].filter((f) => !document.fonts.check(`700 20px "${f}"`)))
if (missing.length) console.warn('fonts not loaded:', missing.join(', '))
const feature = path.join(OUT, 'feature-graphic.png')
await page.screenshot({ path: feature, type: 'png', clip: { x: 0, y: 0, width: 1024, height: 500 } })
await browser.close()
console.log('wrote', path.relative(process.cwd(), feature))

// Play wants a 512 x 512 32-bit PNG; the full-bleed icon artwork is the source
const icon = path.join(OUT, 'icon-512.png')
await sharp(path.resolve('resources/icon-only.png')).resize(512, 512).ensureAlpha().png().toFile(icon)
console.log('wrote', path.relative(process.cwd(), icon))
