// Renders saved Google Forms /printform pages to PDF as Chrome's Save as PDF
// does. Needs Playwright:
//   node scripts/google-forms/render.mjs <saved-html-dir> test/fixtures/google-forms scripts/google-forms/fixtures.json
// The saved pages come from the signed-in editor (see receiver.ts); they hold
// the account's details and must never be committed. Only the PDFs are.
//
// Every form is saved plain (`<key>.pdf`) and with Chrome's default header
// and footer (`<key>.headers.pdf`: date, title, address, page numbers). The
// forms in VARIED are also saved on A4, scaled to 70%, with no margins and in
// landscape. A page saved in another language (`<key>.<lang>.html`) is saved
// plain, as `<key>.<lang>.pdf`.
import { chromium } from '@playwright/test'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'

const [htmlDir, outDir, fixturesJson] = process.argv.slice(2)
const ids = Object.fromEntries(JSON.parse(readFileSync(fixturesJson, 'utf8')).forms.map(({ key, id }) => [key, id]))

const VARIED = new Set([
  'all-types', 'tricky-text', 'huge-stem', 'sections', 'long-quiz',
  'short-answers-tricky', 'long-description', 'numbered-titles', 'teacher-mix',
])

const margin = (inches) => ({ top: inches, bottom: inches, left: inches, right: inches })
const tiny = 'font-size:8px;font-family:Arial;width:100%;display:flex;justify-content:space-between;padding:0 0.4in;'
const PLAIN = { format: 'Letter', margin: margin('0.4in') }
const VARIANTS = {
  headers: {
    format: 'Letter',
    displayHeaderFooter: true,
    headerTemplate: `<div style="${tiny}"><span class="date"></span><span class="title"></span><span></span></div>`,
    footerTemplate: `<div style="${tiny}"><span class="url"></span><span><span class="pageNumber"></span>/<span class="totalPages"></span></span></div>`,
    margin: margin('0.5in'),
  },
  a4: { format: 'A4', margin: margin('0.4in') },
  scaled: { format: 'Letter', scale: 0.7, margin: margin('0.4in') },
  nomargin: { format: 'Letter', margin: margin('0') },
  landscape: { format: 'Letter', landscape: true, margin: margin('0.4in') },
}

const browser = await chromium.launch()
for (const file of readdirSync(htmlDir).filter((name) => name.endsWith('.html')).sort()) {
  const [key, lang] = file.slice(0, -5).split('.')
  const id = ids[key]
  if (!id) continue
  const url = `https://docs.google.com/forms/d/${id}/printform`
  const html = readFileSync(`${htmlDir}/${file}`, 'utf8')
  const context = await browser.newContext({ locale: lang ?? 'en-US', timezoneId: 'America/New_York' })
  const page = await context.newPage()
  await page.route(url, (route) => route.fulfill({ body: html, contentType: 'text/html; charset=utf-8' }))
  // Nothing signed in leaves this machine: other docs.google.com calls are refused.
  await page.route(/docs\.google\.com\/(?!forms\/d\/[^/]+\/printform$)/, (route) => route.abort())
  await page.goto(url, { waitUntil: 'networkidle' }).catch(() => {})
  await page.waitForTimeout(1500)
  const name = lang ? `${key}.${lang}` : key
  writeFileSync(`${outDir}/${name}.pdf`, await page.pdf(PLAIN))
  if (!lang) {
    writeFileSync(`${outDir}/${name}.headers.pdf`, await page.pdf(VARIANTS.headers))
    if (VARIED.has(key)) {
      for (const variant of ['a4', 'scaled', 'nomargin', 'landscape']) {
        writeFileSync(`${outDir}/${name}.${variant}.pdf`, await page.pdf(VARIANTS[variant]))
      }
    }
  }
  console.log(name)
  await context.close()
}
await browser.close()
