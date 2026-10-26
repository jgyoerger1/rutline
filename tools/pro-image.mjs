// Renders the App Store subscription image (the 1024 x 1024 picture App Store
// Connect asks for on the subscription page; used for offer codes and win-back
// offers) from tools/pro-image.html to store/pro-subscription-1024.png.
//   node tools/pro-image.mjs
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import puppeteer from 'puppeteer-core'

const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const src = pathToFileURL(path.resolve('tools/pro-image.html')).href
const out = path.resolve('store/pro-subscription-1024.png')
fs.mkdirSync(path.dirname(out), { recursive: true })

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--allow-file-access-from-files'],
  defaultViewport: { width: 1024, height: 1024, deviceScaleFactor: 1 },
})
const page = await browser.newPage()
await page.goto(src, { waitUntil: 'load' })
await page.evaluate(() => document.fonts.ready)
const missing = await page.evaluate(() => ['Chakra Petch', 'Geist Mono'].filter((f) => !document.fonts.check(`700 20px "${f}"`)))
if (missing.length) console.warn('fonts not loaded:', missing.join(', '))
await page.screenshot({ path: out, type: 'png', clip: { x: 0, y: 0, width: 1024, height: 1024 } })
await browser.close()
console.log('wrote', path.relative(process.cwd(), out))
