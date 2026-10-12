import { plainBlocks } from '../rich-text'
import { excerpt } from '../text'
import { bankNameFromFile } from '../unify'
import type { FormatInput, FormatSpec, ImportIssue, ParseResult, ReaderQuestion } from '../reader'
import { isBlankRow, readSheet, type SheetRow } from './sheet'

/**
 * Class Gauntlet's question sets, as it exports them, as its template lays
 * them out, or as the open-source project it grew from wrote them.
 *
 * Its template: `question, A, B, C, D, answer, explanation`, D and the
 * explanation optional, the answer a letter or the right choice's own text.
 * Teachers paste it from a spreadsheet as tab-separated cells, too. Its
 * export adds `set title, subject, grade` to every row, so a file holds
 * several sets; each becomes a Question Bank with its subject and grade as
 * Extras (ADR-0005). Without a set title, the file is one bank named after
 * it.
 *
 * The original project's: `set title, The original project's: `set title,
 * subject, grade, question, choices, correct, explanation`, the choices a
 * JSON list and the right one counted from zero. Every question is Multiple
 * Choice with two to four choices.
 */

const HEADER_ROWS = 5

type Header = {
  line: number
  title: number
  subject: number
  grade: number
  question: number
  explanation: number
  letters: number[]
  answer: number
  choices: number
  correct: number
}

/** "Answer 3 (Optional)" → "answer 3". */
const label = (value: string) => value.replace(/\([^)]*\)/g, ' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

export function gauntletHeader(rows: SheetRow[]): Header | null {
  for (const row of rows.slice(0, HEADER_ROWS)) {
    const labels = row.fields.map(label)
    const at = (name: string) => labels.indexOf(name)
    const header = {
      line: row.line,
      title: at('set title'),
      subject: at('subject'),
      grade: at('grade'),
      question: at('question'),
      explanation: at('explanation'),
      letters: ['a', 'b', 'c', 'd'].map(at),
      answer: at('answer'),
      choices: at('choices'),
      correct: at('correct'),
    }
    const lettered = header.letters[0]! >= 0 && header.letters[1]! >= 0 && header.answer >= 0
    const listed = header.choices >= 0 && header.correct >= 0
    if (header.question >= 0 && (lettered || (listed && header.title >= 0))) return header
  }
  return null
}

function parseRow(row: SheetRow, header: Header): { question: ReaderQuestion } | { error: string } {
  const cell = (index: number) => (index >= 0 ? (row.fields[index] ?? '').trim() : '')
  let choices: string[]
  let correct: number
  if (header.choices >= 0) {
    try {
      const parsed: unknown = JSON.parse(cell(header.choices))
      choices = Array.isArray(parsed) ? parsed.map((choice) => String(choice).trim()) : []
    } catch {
      return { error: 'its choices are not a list such as ["8","-8","20"].' }
    }
    const key = cell(header.correct)
    correct = /^\d+$/.test(key) ? Number(key) : -1
    if (correct < 0 || correct >= choices.length) return { error: `its correct answer “${excerpt(key, 10)}” is not the place of one of its choices, counted from 0.` }
  } else {
    choices = header.letters.map(cell)
    while (choices.length > 2 && choices.at(-1) === '') choices.pop()
    const key = cell(header.answer)
    correct = /^[a-d]$/i.test(key)
      ? key.toUpperCase().charCodeAt(0) - 65
      : choices.findIndex((choice) => choice !== '' && choice.toLowerCase() === key.toLowerCase())
    if (correct < 0 || correct >= choices.length || !choices[correct]) {
      return { error: `its answer “${excerpt(key, 10)}” is not one of its choices. Use a letter like B.` }
    }
  }
  if (choices.length < 2 || choices.some((choice) => !choice)) return { error: 'it needs two to four choices, with none empty.' }
  const explanation = cell(header.explanation)
  return {
    question: {
      kind: 'multiple-choice',
      line: row.line,
      stem: plainBlocks(cell(header.question)),
      choices: choices.map((choice, index) => ({ content: plainBlocks(choice), correct: index === correct })),
      ...(explanation ? { explanation: plainBlocks(explanation) } : {}),
    },
  }
}

export function parseGauntletRows(rows: SheetRow[], fileName: string): ParseResult {
  const header = gauntletHeader(rows)
  if (!header) return { questions: [], issues: [], found: 0 }
  const banks = new Map<string, { name: string; extras: Record<string, string>; questions: ReaderQuestion[] }>()
  const issues: ImportIssue[] = []
  let found = 0
  for (const row of rows) {
    if (row.line <= header.line || isBlankRow(row)) continue
    const cell = (index: number) => (index >= 0 ? (row.fields[index] ?? '').trim() : '')
    if (!cell(header.question)) continue
    found += 1
    const parsed = parseRow(row, header)
    if ('error' in parsed) {
      issues.push({
        severity: 'error',
        code: 'unreadable-question',
        message: `Question ${found} (line ${row.line}): ${parsed.error}`,
        line: row.line,
        excerpt: excerpt(cell(header.question)),
      })
      continue
    }
    const name = cell(header.title) || bankNameFromFile(fileName)
    const bank = banks.get(name) ?? { name, extras: { subject: cell(header.subject), grade: cell(header.grade) }, questions: [] }
    bank.questions.push({ ...parsed.question, number: found })
    banks.set(name, bank)
  }
  const questions = [...banks.values()].flatMap((bank) => bank.questions)
  // Its template names no set: one bank, named after the file.
  if (header.title < 0) return { questions, issues, found }
  return { questions, banks: [...banks.values()], issues, found }
}

async function detect(input: FormatInput): Promise<number> {
  const rows = (await readSheet(input))?.rows
  return rows && gauntletHeader(rows) ? 0.95 : 0
}

export const classGauntlet: FormatSpec = {
  id: 'class-gauntlet',
  shape: 'table',
  detect,
  parse: async (input) => parseGauntletRows((await readSheet(input))?.rows ?? [], input.name),
}
