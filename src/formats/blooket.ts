import { plainBlocks } from '../rich-text'
import { excerpt } from '../text'
import type { FormatInput, FormatSpec, ImportIssue, ParseResult, ReaderQuestion } from '../reader'
import { isBlankRow, readSheet, type SheetRow } from './sheet'

/**
 * Blooket's spreadsheet import template, as a CSV or Excel file: a title row,
 * then a header of `Question #`, `Question Text`, `Answer 1` to `Answer 4`,
 * `Time Limit (sec)` and `Correct Answer(s)`, each header often followed by
 * a note such as “(Optional)”. One question per row below it; the template
 * numbers rows it leaves empty, and those are not questions.
 *
 * The correct answers are answer numbers, such as `2` or `3,4`; several make
 * Multiple Answer. Two answers, True and False, make True/False, as Kahoot's.
 */

const HEADER_ROWS = 10

type Header = { line: number; question: number; answers: { column: number; number: number }[]; correct: number }

/** "Answer 3\n(Optional)" → "answer 3". */
const label = (value: string) =>
  value.replace(/\([^)]*\)/g, ' ').toLowerCase().replace(/[^a-z0-9#]+/g, ' ').trim()

export function blooketHeader(rows: SheetRow[]): Header | null {
  for (const row of rows.slice(0, HEADER_ROWS)) {
    const labels = row.fields.map(label)
    const number = labels.findIndex((text) => text === 'question #')
    const question = labels.findIndex((text) => text === 'question text')
    const correct = labels.findIndex((text) => /^correct answers?\b/.test(text))
    const answers = labels.flatMap((text, column) => {
      const each = /^answer (\d)$/.exec(text)?.[1]
      return each ? [{ column, number: Number(each) }] : []
    })
    if (number >= 0 && question >= 0 && correct >= 0 && answers.some((answer) => answer.number === 1)) {
      return { line: row.line, question, answers, correct }
    }
  }
  return null
}

const TRUE_FALSE = /^(true|false)$/i

function parseRow(row: SheetRow, header: Header): ReaderQuestion | string {
  const field = (index: number) => (row.fields[index] ?? '').trim()
  const answers = header.answers.map((answer) => ({ ...answer, text: field(answer.column) })).filter((answer) => answer.text)
  if (answers.length < 2) return `a Blooket question needs at least two answers, and this one has ${answers.length === 1 ? 'one' : 'none'}.`
  const given = field(header.correct)
  const numbers = given.split(/[\s,;]+/).filter(Boolean).map(Number)
  if (!numbers.length) return 'it gives no correct answer number.'
  if (numbers.some((number) => !Number.isInteger(number))) {
    return `its correct answer “${excerpt(given, 20)}” is not an answer number such as 1 or 3,4.`
  }
  const empty = numbers.find((number) => !answers.some((answer) => answer.number === number))
  if (empty !== undefined) return `its correct answer is answer ${empty}, which is empty.`
  const base = { line: row.line, stem: plainBlocks(field(header.question)) }
  if (answers.length === 2 && numbers.length === 1 && answers.every((answer) => TRUE_FALSE.test(answer.text))) {
    return { ...base, kind: 'true-false', answer: answers.find((answer) => answer.number === numbers[0])!.text.toLowerCase() === 'true' }
  }
  const choices = answers.map((answer) => ({ content: plainBlocks(answer.text), correct: numbers.includes(answer.number) }))
  return numbers.length > 1 ? { ...base, kind: 'multiple-answer', choices } : { ...base, kind: 'multiple-choice', choices }
}

export function parseBlooketRows(rows: SheetRow[]): ParseResult {
  const header = blooketHeader(rows)
  if (!header) return { questions: [], issues: [], found: 0 }
  const questions: ReaderQuestion[] = []
  const issues: ImportIssue[] = []
  let found = 0
  for (const row of rows) {
    if (row.line <= header.line || isBlankRow(row)) continue
    const content = [header.question, header.correct, ...header.answers.map((answer) => answer.column)]
    if (content.every((index) => !(row.fields[index] ?? '').trim())) continue
    found += 1
    const parsed = parseRow(row, header)
    if (typeof parsed === 'string') {
      issues.push({
        severity: 'error',
        code: 'unreadable-question',
        message: `Question ${found} (line ${row.line}): ${parsed}`,
        line: row.line,
        excerpt: excerpt(row.fields[header.question] ?? ''),
      })
    } else {
      questions.push({ ...parsed, number: found })
    }
  }
  return { questions, issues, found }
}

async function detect(input: FormatInput): Promise<number> {
  const rows = (await readSheet(input))?.rows
  return rows && blooketHeader(rows) ? 0.95 : 0
}

export const blooket: FormatSpec = {
  id: 'blooket',
  detect,
  parse: async (input) => parseBlooketRows((await readSheet(input))?.rows ?? []),
}
