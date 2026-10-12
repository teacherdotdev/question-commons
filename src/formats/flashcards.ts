import { htmlBlocks, plainBlocks, richBlocks } from '../rich-text'
import { delimitedRows, excerpt } from '../text'
import { BLANK_MARK, type Blocks, type ReaderQuestion, type FormatInput, type FormatSpec, type ImportIssue, type ParseResult } from '../reader'

/**
 * Flashcards exported as text, by Quizlet or Anki. Each card becomes a Short
 * Answer question: the term is asked, and the definition is its Suggested
 * Answer.
 *
 * Quizlet's export is one card to a line, its term and definition separated
 * by a tab (its default) or a comma. Its custom separators can't be split
 * reliably, as a card may hold them, and are not read. Any two-column file
 * looks like one, so it is read only when an app asks for it (ADR-0006).
 *
 * Anki's text export adds header lines — `#separator:Tab`, `#html:true`,
 * `#columns:…`, `#deck:…`, `#tags:…` and the `#… column:N` lines naming its
 * tags and deck columns. A deck names the bank, and tags become topics. A
 * cloze note, `The capital of France is {{c1::Paris}}.`, becomes a Fill in
 * the Blank question whose Blank, where the cloze stood, holds `Paris`.
 *
 * Its header lines are what identify it.
 */

type Separator = '\t' | ',' | ';' | '|' | ':' | ' '
type Layout = { fields: '\t' | ',' }

const LAYOUTS: Layout[] = [{ fields: '\t' }, { fields: ',' }]

const ANKI_SEPARATORS: Record<string, Separator> = {
  tab: '\t', comma: ',', semicolon: ';', space: ' ', pipe: '|', colon: ':',
}

type Anki = {
  separator?: Separator
  html?: boolean
  deck?: string
  tags: string[]
  /** 0-based columns that are not a card's sides. */
  meta: Set<number>
  tagsColumn?: number
}

type Row = { fields: string[]; line: number }

/** Anki's `#key:value` header lines, which come before the first card. */
function readAnkiHeader(lines: string[]): { anki: Anki | null; skip: number } {
  const anki: Anki = { tags: [], meta: new Set() }
  let skip = 0
  let known = false
  for (const line of lines) {
    const match = /^#([a-z ]+):(.*)$/i.exec(line.trim())
    if (!match) break
    skip += 1
    const key = match[1]!.trim().toLowerCase()
    const value = match[2]!.trim()
    if (key === 'separator') {
      const named = ANKI_SEPARATORS[value.toLowerCase()]
      anki.separator = named ?? (['\t', ',', ';', '|', ':', ' '].includes(value) ? (value as Separator) : undefined)
    } else if (key === 'html') {
      anki.html = value.toLowerCase() === 'true'
    } else if (key === 'deck') {
      anki.deck = value
    } else if (key === 'tags') {
      anki.tags = value.split(/\s+/).filter(Boolean)
    } else if (/^(tags|deck|notetype|guid) column$/.test(key)) {
      const column = Number(value) - 1
      if (Number.isInteger(column) && column >= 0) {
        anki.meta.add(column)
        if (key === 'tags column') anki.tagsColumn = column
      }
    } else if (key !== 'columns' && key !== 'notetype') {
      continue
    }
    known = true
  }
  return known ? { anki, skip } : { anki: null, skip: 0 }
}

/** The cards, split the way `layout` says, with the line each starts on. */
function rowsOf(text: string, layout: Layout): Row[] {
  return delimitedRows(text, layout.fields).filter((row) => row.fields.some((field) => field.trim()))
}

const isCard = (row: Row) => row.fields.length === 2 && row.fields.every((field) => field.trim())

const HEADER = /^(term|terms|front|question|word|prompt)$/i
const HEADER_BACK = /^(definition|definitions|back|answer|meaning)$/i

type Reading = { rows: Row[]; anki: Anki | null; share: number }

function read(text: string): Reading {
  const lines = text.split('\n')
  const { anki, skip } = readAnkiHeader(lines)
  const body = '\n'.repeat(skip) + lines.slice(skip).join('\n')
  if (anki) {
    const separator = anki.separator ?? sniffAnki(body)
    const rows = delimitedRows(body, separator)
      .filter((row) => row.fields.some((field) => field.trim()))
    return { rows, anki, share: 1 }
  }
  let best: Reading = { rows: [], anki: null, share: 0 }
  for (const layout of LAYOUTS) {
    const rows = rowsOf(body, layout)
    if (rows.length && HEADER.test(rows[0]!.fields[0]?.trim() ?? '') && HEADER_BACK.test(rows[0]!.fields[1]?.trim() ?? '')) {
      rows.shift()
    }
    if (!rows.length) continue
    const share = rows.filter(isCard).length / rows.length
    if (share > best.share + 1e-9) best = { rows, anki: null, share }
    if (share >= 0.9) break
  }
  return best
}

/** Anki without a `#separator:` line: the separator most rows split on. */
function sniffAnki(text: string): Separator {
  for (const separator of ['\t', ';', ','] as const) {
    const rows = delimitedRows(text, separator).filter((row) => row.fields.some((field) => field.trim()))
    if (rows.length && rows.filter((row) => row.fields.length >= 2).length / rows.length >= 0.9) return separator
  }
  return '\t'
}

const CLOZE = /\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/g

function card(row: Row, reading: Reading): ReaderQuestion | string {
  const anki = reading.anki
  const sides = row.fields.filter((_, index) => !anki?.meta.has(index))
  const [term = '', definition = ''] = sides
  if (!anki && !isCard(row)) {
    return row.fields.length < 2
      ? 'it has no definition: a card is a term and a definition, separated by a tab or a comma.'
      : `it has ${row.fields.length} parts, not a term and a definition.`
  }
  const blocks = (text: string): Blocks =>
    anki?.html === true ? htmlBlocks(text) : anki?.html === false ? plainBlocks(text) : richBlocks(text)
  const tags = [
    ...(anki?.tags ?? []),
    ...(anki?.tagsColumn !== undefined ? (row.fields[anki.tagsColumn] ?? '').split(/\s+/) : []),
  ].filter(Boolean)
  const base = { line: row.line, ...(tags.length ? { topics: tags } : {}) }
  const clozes = [...term.matchAll(CLOZE)]
  if (clozes.length) {
    const stem = blocks(term.replace(CLOZE, BLANK_MARK))
    if (clozes.length === 1) return { ...base, sourceType: 'Cloze', stem, kind: 'fill-in-blank', accepted: [clozes[0]![2]!] }
    return {
      ...base,
      sourceType: 'Cloze',
      stem,
      kind: 'fill-in-blanks',
      blanks: clozes.map((match, index) => ({ name: `Blank ${index + 1}`, accepted: [match[2]!] })),
    }
  }
  if (!term.trim()) return 'it has no term.'
  return {
    ...base,
    stem: blocks(term.trim()),
    kind: 'short-answer',
    ...(definition.trim() ? { suggestedAnswer: blocks(definition.trim()) } : {}),
  }
}

export function parseFlashcards(text: string): ParseResult {
  const reading = read(text)
  const questions: ReaderQuestion[] = []
  const issues: ImportIssue[] = []
  reading.rows.forEach((row, index) => {
    const parsed = card(row, reading)
    if (typeof parsed === 'string') {
      issues.push({
        severity: 'error',
        code: 'unreadable-question',
        message: `Question ${index + 1} (line ${row.line}): ${parsed}`,
        line: row.line,
        excerpt: excerpt(row.fields.join(' ')),
      })
    } else {
      questions.push({ ...parsed, number: index + 1 })
    }
  })
  const deck = reading.anki?.deck?.split('::').at(-1)?.trim()
  return { questions, issues, found: reading.rows.length, ...(deck ? { name: deck } : {}) }
}

/** Only Anki's header lines say a file is Anki's. */
function detectAnki(input: FormatInput): number {
  return readAnkiHeader(input.text().split('\n', 32)).anki ? 0.98 : 0
}

export const anki: FormatSpec = {
  id: 'anki',
  shape: 'text',
  detect: detectAnki,
  parse: (input) => parseFlashcards(input.text()),
}

export const quizlet: FormatSpec = {
  id: 'quizlet',
  shape: 'table',
  detect: () => 0,
  parse: (input) => parseFlashcards(input.text()),
}
