import { expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'
import { FORMATS_START, FORMATS_END, formatsTable } from '../scripts/formats-table'

const root = fileURLToPath(new URL('..', import.meta.url))

test('the README lists the Formats exactly as the catalogue does (run `bun run docs` to update it)', async () => {
  const readme = await Bun.file(`${root}/README.md`).text()
  const listed = readme.slice(readme.indexOf(FORMATS_START) + FORMATS_START.length, readme.indexOf(FORMATS_END))
  expect(readme).toContain(FORMATS_START)
  expect(listed.trim()).toBe(formatsTable().trim())
})

test('the table groups Formats by Shape, naming each one’s originator and file types', () => {
  expect(formatsTable()).toContain('| Table | Kahoot spreadsheet | Kahoot | `.xlsx` `.csv` |')
  expect(formatsTable()).toContain('| PDF | Google Forms printout | Google Forms | `.pdf` |')
})
