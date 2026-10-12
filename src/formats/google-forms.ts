import type { PdfPage, PdfRun } from '../pdf'
import type { Blocks, FormatInput, FormatSpec, ImportIssue, ParseResult, ReaderQuestion } from '../reader'
import { plainBlocks } from '../rich-text'
import { excerpt } from '../text'

/**
 * A Google Forms printout: the PDF a teacher saves from the form editor's
 * More → Print (ADR-0007). It shows the form as a respondent sees it: its
 * title and description, then each question numbered, with its title, help
 * text, an instruction such as “Mark only one oval.” and its choices.
 * Sections, page breaks, pictures and videos print between them unnumbered.
 *
 * A printout never shows which answer is right, so multiple choice,
 * checkbox and dropdown questions are left out; short answer and paragraph
 * questions come in as Short Answer. Scales, grids, dates and times are
 * left out too.
 *
 * Everything is read from where the text stands on the page. The form ends
 * at Google's note that it didn't write it; Chrome's own header and footer,
 * printed in the page margins, are no part of it.
 */

const ENDORSEMENT = 'This content is neither created nor endorsed by Google.'
const REQUIRED_NOTE = '* Indicates required question'
const ONE_OVAL = 'Mark only one oval.'
const ONE_PER_ROW = 'Mark only one oval per row.'
const CHECK_ALL = 'Check all that apply.'
const EXAMPLE = /^Example: /
const NUMBER = /^(\d+)\.$/
/** Chrome prints its header and footer (the date, the form's title and
 *  address, page numbers) in small type in the page's margin: by default
 *  0.4 inches, where the form itself never prints. */
const MARGIN = 28.8
const chromeMargin = (run: PdfRun, page: PdfPage) => run.size < 8 && (run.y < MARGIN || run.y > page.height - MARGIN)

type Line = { page: PdfPage; pageIndex: number; y: number; runs: PdfRun[] }

// The printout keeps a run of spaces by printing every other one as a
// no-break space, as a web page must; each was a space in the form.
const lineText = (runs: PdfRun[]) => runs.map((run) => run.text).join('').replaceAll('\u00a0', ' ')
const left = (line: Line) => line.runs[0]!.x
const right = (runs: PdfRun[]) => Math.max(...runs.map((run) => run.x + run.width))
const sizeOf = (runs: PdfRun[]) => Math.max(...runs.map((run) => run.size))
/** A required question's asterisk or a dropdown's badge: set apart from the
 *  text, out at the right of the line. */
const isMark = (run: PdfRun) => ['*', 'Dropdown'].includes(run.text.trim())
const near = (a: number, b: number) => Math.abs(a - b) < 2
const sameSize = (a: number, b: number) => Math.abs(a - b) < 0.5

/** Every line of text on every page, top to bottom. */
function pageLines(pages: PdfPage[]): Line[] {
  return pages.flatMap((page, pageIndex) => {
    const runs = page.runs
      .filter((run) => !chromeMargin(run, page))
      .sort((a, b) => a.y - b.y || a.x - b.x)
    const lines: Line[] = []
    for (const run of runs) {
      const line = lines.at(-1)
      if (line && Math.abs(line.y - run.y) < 1) line.runs.push(run)
      else lines.push({ page, pageIndex, y: run.y, runs: [run] })
    }
    // Spaces between words in other fonts, as between emoji, are runs of
    // their own; a line never starts with one.
    for (const line of lines) {
      line.runs.sort((a, b) => a.x - b.x)
      while (line.runs.length && !line.runs[0]!.text.trim()) line.runs.shift()
    }
    return lines.filter((line) => line.runs.length)
  })
}

/** The form's lines, up to Google's note that it didn't write them. */
function formLines(pages: PdfPage[]): Line[] | null {
  const lines = pageLines(pages)
  const end = lines.findIndex((line) => lineText(line.runs).trim() === ENDORSEMENT)
  return end < 0 ? null : lines.slice(0, end)
}

/** A line's text, and where it had to end if not at the passage's edge. */
type Part = { runs: PdfRun[]; line: Line; edge?: number }

const parts = (lines: Line[]): Part[] => lines.map((line) => ({ runs: line.runs, line }))

/**
 * Lines of one passage joined as they were written. A wider gap than a
 * line's is a blank line. A form's description draws the space a line was
 * wrapped at, so a line ending in a space was wrapped and any other was
 * broken by its writer. A question's title and help text don't: there, the
 * next line starts a line of its own when its first word would have fitted
 * after the line, and otherwise the line was wrapped at a space. Either way
 * a line wrapped after a hyphen or a slash, inside a web address, or in a
 * word too long for a line had no space there.
 */
function joinLines(lines: Part[], edge: number, drawsWrapSpaces = false): string {
  const gaps = lines.slice(1).flatMap(({ line }, index) =>
    line.pageIndex === lines[index]!.line.pageIndex ? [line.y - lines[index]!.line.y] : [],
  )
  let text = ''
  lines.forEach(({ runs, line }, index) => {
    const content = lineText(runs)
    const before = lines[index - 1]
    if (!before) {
      text = content
      return
    }
    const size = sizeOf(runs)
    // Across a page break, the gap says nothing.
    const breaks = before.line.pageIndex === line.pageIndex
      ? Math.max(1, Math.round((line.y - before.line.y) / Math.min(...gaps, size * 1.5)))
      : 1
    const end = right(before.runs)
    const fits = end + size * 0.25 + firstWordWidth(runs) <= (before.edge ?? edge)
    const brokenWord = !lineText(before.runs).includes(' ') && end > edge - 2 * size
    const address = /(?:^|\s)(?:\w+:\/\/|www\.)\S*$/.test(text)
    const joinsUp = text.endsWith(' ') || (!fits && (/[-‐/]$/.test(text) || brokenWord || address))
    const between = breaks > 1 ? '\n'.repeat(breaks) : joinsUp ? '' : fits || drawsWrapSpaces ? '\n' : ' '
    text += between + content
  })
  return text
}

/** How far a line's first word reaches, from where the line starts. */
function firstWordWidth(runs: PdfRun[]): number {
  const start = runs[0]!.x
  for (const run of runs) {
    for (const glyph of run.glyphs) if (glyph.text === ' ' && glyph.x > start) return glyph.x - start
  }
  return right(runs) - start
}

type Kind = 'short' | 'mc' | 'checkbox' | 'dropdown' | 'scale' | 'grid' | 'checkgrid' | 'date' | 'time' | 'datetime' | 'duration'

const KIND_NAMES: Record<Exclude<Kind, 'short'>, string> = {
  mc: 'multiple choice',
  checkbox: 'checkbox',
  dropdown: 'dropdown',
  scale: 'linear scale',
  grid: 'multiple choice grid',
  checkgrid: 'checkbox grid',
  date: 'date',
  time: 'time',
  datetime: 'date and time',
  duration: 'duration',
}

const isInstruction = (text: string) => [ONE_OVAL, ONE_PER_ROW, CHECK_ALL].includes(text) || EXAMPLE.test(text)

/** Runs set apart along a line, as a scale's numbers or a grid's column
 *  headings are, where choices stand one to a line. */
const spreadOut = (runs: PdfRun[]) =>
  runs.length > 1 && runs.every((run, index) => index === 0 || run.x - right([runs[index - 1]!]) > run.size)

/** What a date or time question's example shows: `January 7, 2019`,
 *  `8:30 AM`, both, or `4:03:32 (4 hours, 3 minutes, 32 seconds)`. */
function exampleKind(text: string): Kind {
  if (/\d+:\d+:\d+/.test(text)) return 'duration'
  if (/\d{4}/.test(text)) return /\d:\d\d/.test(text) ? 'datetime' : 'date'
  return 'time'
}

type Printed = { number: number; title: string; help: string; kind: Kind }

/** One numbered question: its title, help text, then the instruction that
 *  says what kind it is and whatever a respondent answers in. A question
 *  with no instruction is answered on blank lines: short answer or
 *  paragraph. */
function readQuestion(number: number, first: Line, lines: Line[], titleX: number, edge: number): Printed {
  let dropdown = false
  const firstRuns = first.runs.slice(1).filter((run) => {
    // The badge a dropdown question shows at the right of its title.
    const badge = run.text.trim() === 'Dropdown' && run.x > first.page.width / 2
    if (badge) dropdown = true
    return !badge
  })
  const all = [{ runs: firstRuns, line: first }, ...parts(lines)].filter(({ runs }) => runs.length)
  const titleSize = firstRuns.length ? sizeOf(firstRuns) : 0
  const title: Part[] = []
  const help: Part[] = []
  let index = 0
  for (; index < all.length; index += 1) {
    const part = all[index]!
    if (!near(part.runs[0]!.x, titleX) || isInstruction(lineText(part.runs).trim())) break
    if (!help.length && sameSize(sizeOf(part.runs), titleSize)) title.push(part)
    else help.push(part)
  }
  // A required question's title has an asterisk at the right of its first
  // line, which that line's text stops short of.
  const starred = title.findIndex(({ runs }) => isMark(runs.at(-1)!) && runs.length > 1)
  if (starred >= 0) {
    const { runs } = title[starred]!
    const star = runs.at(-1)!
    title[starred] = { ...title[starred]!, runs: runs.slice(0, -1), edge: star.x - star.size / 2 }
  }

  const instruction = all[index] && near(all[index]!.runs[0]!.x, titleX) ? lineText(all[index]!.runs).trim() : ''
  const next = all[index + 1]?.runs ?? []
  const kind: Kind =
    instruction === ONE_PER_ROW ? 'grid'
    : instruction === CHECK_ALL ? (spreadOut(next) ? 'checkgrid' : 'checkbox')
    : instruction === ONE_OVAL ? (dropdown ? 'dropdown' : spreadOut(next) && next.every((run) => /^\d+$/.test(run.text.trim())) ? 'scale' : 'mc')
    : EXAMPLE.test(instruction) ? exampleKind(instruction)
    : 'short'
  return { number, title: title.length ? joinLines(title, edge) : '', help: help.length ? joinLines(help, edge) : '', kind }
}

type Form = { title: string; description: string; questions: Printed[] }

function readForm(pages: PdfPage[]): Form | null {
  const lines = formLines(pages)
  if (!lines?.length) return null

  // The form's title, in the largest type, and its description below it.
  const titleSize = Math.max(...lines.map((line) => sizeOf(line.runs)))
  let index = 0
  const header: Line[] = []
  while (index < lines.length && sameSize(sizeOf(lines[index]!.runs), titleSize)) header.push(lines[index++]!)
  if (!header.length) return null
  const headerX = left(header[0]!)
  const description: Line[] = []
  for (; index < lines.length; index += 1) {
    const line = lines[index]!
    if (lineText(line.runs).trim() === REQUIRED_NOTE) continue
    if (!near(left(line), headerX)) break
    description.push(line)
  }

  // A question runs from its number to the next item: the next number, or
  // anything printed left of its title, as a section's title or a picture's
  // is, whatever pages it crosses.
  const rest = lines.slice(index)
  const numberX = Math.min(...rest.map(left))
  // Where the form's text ends on the right, so wrapped lines can be told
  // from broken ones: as far right as any of its lines reaches. That is
  // short of the true edge by less than a word where text was wrapped, and
  // where none was, every line's next word fitted.
  const cardEdge = Math.max(...lines.map((line) => right(line.runs.filter((run) => !isMark(run)))))
  const questions: Printed[] = []
  let current: { number: number; first: Line; titleX: number; lines: Line[] } | null = null
  const finish = () => {
    if (current) questions.push(readQuestion(current.number, current.first, current.lines, current.titleX, cardEdge))
    current = null
  }
  for (const line of rest) {
    const number = Number(NUMBER.exec(line.runs[0]!.text.trim())?.[1])
    if (number === questions.length + (current ? 2 : 1) && near(left(line), numberX)) {
      finish()
      current = { number, first: line, titleX: line.runs[1]?.x ?? Number.NaN, lines: [] }
      continue
    }
    if (!current) continue
    // An untitled question's instruction stands where its title would.
    if (Number.isNaN(current.titleX)) current.titleX = left(line)
    if (left(line) < current.titleX - 2) finish()
    else current.lines.push(line)
  }
  finish()

  return {
    title: joinLines(parts(header), cardEdge),
    description: description.length ? joinLines(parts(description), cardEdge, true) : '',
    questions,
  }
}

async function parse(input: FormatInput): Promise<ParseResult> {
  const pages = await input.pdf()
  const form = pages && readForm(pages)
  if (!form) return { questions: [], issues: [], found: 0 }
  const questions: ReaderQuestion[] = []
  const issues: ImportIssue[] = []
  for (const { number, title, help, kind } of form.questions) {
    if (kind === 'short') {
      const stem: Blocks = [...plainBlocks(title), ...(help ? plainBlocks(help) : [])]
      questions.push({ kind: 'short-answer', number, stem })
      continue
    }
    const choice = kind === 'mc' || kind === 'checkbox' || kind === 'dropdown'
    issues.push({
      severity: 'error',
      code: choice ? 'no-answer-key' : 'unsupported-type',
      message: choice
        ? `Question ${number}: Google Forms printouts don’t show which answer is right, so this ${KIND_NAMES[kind]} question was left out.`
        : `Question ${number}: ${KIND_NAMES[kind]} questions can’t be read, so it was left out.`,
      ...(title.trim() ? { excerpt: excerpt(title) } : {}),
    })
  }
  return { questions, issues, found: form.questions.length, name: form.title, description: form.description }
}

async function detect(input: FormatInput): Promise<number> {
  const pages = await input.pdf()
  return pages && formLines(pages) ? 0.98 : 0
}

export const googleFormsPrint: FormatSpec = { id: 'google-forms-print', shape: 'pdf', detect, parse }
