// Renders the native launch screen source (resources/splash.png and
// splash-dark.png, 2732 x 2732) from tools/splash.html: plain pine, because the
// in-app Splash.tsx stages the mark right after. Then run `npm run ios:assets` to regenerate the iOS set.
//   node tools/splash.mjs
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import puppeteer from 'puppeteer-core'

const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const SIZE = 2732
const src = pathToFileURL(path.resolve('tools/splash.html')).href
const out = path.resolve('resources/splash.png')
const dark = path.resolve('resources/splash-dark.png')

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--allow-file-access-from-files'],
  defaultViewport: { width: SIZE, height: SIZE, deviceScaleFactor: 1 },
})
const page = await browser.newPage()
await page.goto(src, { waitUntil: 'load' })
await page.evaluate(() => new Promise((r) => setTimeout(r, 300)))
await page.screenshot({ path: out, type: 'png', clip: { x: 0, y: 0, width: SIZE, height: SIZE } })
await browser.close()
fs.copyFileSync(out, dark)
console.log('wrote', path.relative(process.cwd(), out), 'and splash-dark.png')
