// Renders the home-screen icons from the mark: node scripts/icons.mjs
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('playwright')

const mark = (size, pad) => `<html><body style="margin:0;background:#161513">
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${-pad} ${-pad} ${32 + 2 * pad} ${32 + 2 * pad}">
<rect x="${-pad}" y="${-pad}" width="${32 + 2 * pad}" height="${32 + 2 * pad}" fill="#161513"/>
<path d="M4 9 V4 H9 M23 4 H28 V9 M28 23 V28 H23 M9 28 H4 V23" stroke="#cbc6bb" stroke-width="1.6" fill="none" stroke-linecap="square"/>
<path d="M13 7 L8 25 M21.5 7 L16.5 25" stroke="#ff4f00" stroke-width="3.4" stroke-linecap="square"/></svg></body></html>`

const browser = await chromium.launch()
const page = await browser.newPage()
for (const [file, size, pad] of [['icon-192.png', 192, 3], ['icon-512.png', 512, 3], ['icon-maskable-512.png', 512, 9], ['apple-touch-icon.png', 180, 4]]) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(mark(size, pad))
  await page.screenshot({ path: `public/icons/${file}` })
}
await browser.close()
