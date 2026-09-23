import { chromium } from '@playwright/test'
import { resolve } from 'node:path'

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const output = resolve(import.meta.dirname, '..', 'play-store')
const baseUrl = process.env.PARKO_SCREENSHOT_URL || 'http://127.0.0.1:4173/'
const browser = await chromium.launch({ executablePath: chrome, headless: true })
const context = await browser.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'sq-AL' })
await context.addInitScript(() => {
  localStorage.setItem('parko:onboarding:v1', JSON.stringify({ version: 1, completed: true, preferences: ['closest', 'cheapest'] }))
})
const page = await context.newPage()
await page.goto(baseUrl, { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)
await page.screenshot({ path: resolve(output, 'screenshot-1-map.png'), fullPage: false })

const reportButton = page.getByRole('button', { name: 'Hap raportimet e komunitetit' })
if (await reportButton.isVisible()) {
  await reportButton.click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: resolve(output, 'screenshot-2-community-report.png'), fullPage: false })
}

await browser.close()
console.log('Play Store screenshots u krijuan.')
