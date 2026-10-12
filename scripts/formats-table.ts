import { FORMATS } from '../src/catalog'
import type { Shape } from '../src/reader'

/**
 * The README's list of Formats, written from the catalogue so the two can't
 * disagree. `bun run docs` rewrites it; a test checks it.
 */

export const FORMATS_START = '<!-- formats: written by `bun run docs` from src/catalog.ts -->'
export const FORMATS_END = '<!-- /formats -->'

const SHAPES: [Shape, string][] = [['table', 'Table'], ['text', 'Text'], ['xml', 'XML'], ['package', 'Package'], ['pdf', 'PDF']]

export function formatsTable(): string {
  const rows = SHAPES.flatMap(([shape, name]) =>
    FORMATS.filter((format) => format.shape === shape).map(
      (format) => `| ${name} | ${format.label} | ${format.originator} | ${format.fileTypes.map((type) => `\`${type}\``).join(' ')} |`,
    ),
  )
  return ['| Shape | Format | Originator | File types |', '| --- | --- | --- | --- |', ...rows].join('\n')
}

if (import.meta.main) {
  const path = new URL('../README.md', import.meta.url)
  const readme = await Bun.file(path).text()
  const start = readme.indexOf(FORMATS_START)
  const end = readme.indexOf(FORMATS_END)
  if (start < 0 || end < 0) throw new Error('README.md has no formats markers')
  await Bun.write(path, `${readme.slice(0, start + FORMATS_START.length)}\n\n${formatsTable()}\n\n${readme.slice(end)}`)
}
