// Review screenshot for the Rutline Pro subscription in App Store Connect:
// the Pro sheet as the iOS build shows it, with the App Store buy block.
// Drives the dev server with Chrome like store-shots.mjs; the browser build
// cannot sell in-app, so the buy block is swapped in from ProSheet's NativeBuy
// markup. Saves to store/review/. Run `npm run dev` first.
//   node tools/pro-shot.mjs
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const BASE = process.env.RUTLINE_URL ?? 'http://localhost:5173'
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const OUT = path.resolve('store/review')
fs.mkdirSync(OUT, { recursive: true })
const PRICE = process.env.PRO_PRICE ?? '$19.99'

const SETTINGS = {
  home: { lat: 41.3745, lon: -81.0565, label: 'Parkman, OH' },
  localOnly: true,
  mapLayer: 'satellite',
  parcelsEnabled: true,
  hunter: { name: 'Jordan', phone: '', email: '', town: 'Stow, Ohio' },
}
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
  localStorage.removeItem('rutline.pro')
  localStorage.removeItem('rutline.pro.v1')
  sessionStorage.setItem('rutline.splash.seen', '1')
}, SETTINGS)
page.on('pageerror', (e) => console.log('page error:', e.message))

await page.goto(`${BASE}/?shot=pro#/more`, { waitUntil: 'load' })
await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent.includes('See Rutline Pro')), { timeout: 20000 })
await sleep(800)
await page.$$eval('button', (bs) => bs.find((b) => b.textContent.includes('See Rutline Pro')).click())
await page.waitForSelector('[role=dialog]', { timeout: 10000 })
await sleep(900)

// Show the sheet the way the App Store build renders it (ProSheet.tsx NativeBuy)
const swapped = await page.evaluate((price) => {
  const dlg = document.querySelector('[role=dialog]')
  if (!dlg) return 'no dialog'
  const leaf = (re) => [...dlg.querySelectorAll('div, span, p')].find((e) => e.children.length === 0 && re.test(e.textContent ?? ''))
  const term = leaf(/^for 12 months$/)
  if (term) term.textContent = 'a year'
  const blurb = [...dlg.querySelectorAll('p')].find((p) => p.textContent.startsWith('One payment, no auto-renew.'))
  if (blurb) blurb.textContent = 'Renews each year through your Apple ID unless you cancel; cancel any time and keep the rest of the year. Buy it in August, hunt the whole season, decide again next year. The free app stays free.'
  const block = dlg.querySelector('.space-y-3')
  if (!block) return 'no buy block'
  block.innerHTML = `
    <button class="push inline-flex items-center justify-center font-medium transition-colors h-11 px-4 text-sm gap-2 rounded-xl bg-ember-500 text-ember-950 border border-ember-300/30 w-full font-semibold">Buy Pro · ${price}</button>
    <p class="text-[12px] text-bone-600 leading-relaxed">Billed to your Apple ID for a year at a time; it renews unless you cancel in Settings › Apple ID › Subscriptions at least a day before the year ends. Signed out, Pro stays on this phone; sign in and it follows your account.</p>
    <button class="push inline-flex items-center justify-center font-medium transition-colors bg-transparent text-bone-200 border border-transparent h-9 px-3 text-[13px] gap-1.5 rounded-lg">↻ Restore purchases</button>
    <p class="text-[11.5px] text-bone-600"><span class="underline">Terms of use</span> · <span class="underline">Privacy</span></p>`
  return 'ok'
}, PRICE)
console.log('buy block:', swapped)
await sleep(400)

const top = path.join(OUT, 'pro-sheet.png')
await page.screenshot({ path: top, type: 'png' })
console.log('saved', path.relative(process.cwd(), top))

// Scroll the sheet to the buy button for the second frame
await page.evaluate(() => {
  const s = document.querySelector('[role=dialog] .overflow-y-auto')
  if (s) s.scrollTop = s.scrollHeight
})
await sleep(700)
const buy = path.join(OUT, 'pro-sheet-buy.png')
await page.screenshot({ path: buy, type: 'png' })
console.log('saved', path.relative(process.cwd(), buy))

await browser.close()
