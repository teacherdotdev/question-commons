import { formatInfo } from './catalog'
import { READERS } from './formats'
import type { Picture, QuestionBank } from './question-bank'
import type { FormatId, FormatInput, FormatSpec, Shape, ZipFiles } from './reader'
import { isPdf, pdfPages } from './pdf'
import { decodeText } from './text'
import { unify, type ImportIssue } from './unify'
import { wordText } from './formats/docx'
import { readZip, zipFile, ZipLimitError } from './zip'

export * from './question-bank'
export type { FormatId, Shape } from './reader'
export type { ImportIssue } from './unify'
export { FORMATS, QUESTION_FILE_EXTENSIONS, isQuestionFileName, type FormatInfo } from './catalog'
export { blocksText as plainText } from './rich-text'

/**
 * Reading a Question File into Question Banks with rules alone (ADR-0004),
 * in two steps (ADR-0006). The file is set into every Shape it fits — a Word
 * document is Text, an Excel workbook a Table — and then scored against
 * every Format of those Shapes and read with the few that score best. The
 * Reading that brings in the most wins. The other Formats it could be are
 * offered, so an app can let a teacher read it as another.
 */

export type FormatCandidate = { format: FormatId; label: string; score: number }

export type Reading = {
  banks: QuestionBank[]
  issues: ImportIssue[]
  /** The pictures its questions show, as the file carried them, by the key
   *  a `block-image` names in their rich text. */
  pictures: Record<string, Picture>
  /** The Format the file was read as. */
  format: FormatId
  /** Every Format the file could be, best first, for reading it as another. */
  candidates: FormatCandidate[]
}

export type ReadOptions = {
  /** Read the file as this Format, whatever it looks like. */
  format?: FormatId
  /** When it was read, recorded in each bank's Provenance. Defaults to now. */
  readAt?: string
}

/** Why a file could not be read as questions, in words a teacher can act on. */
export class QuestionFileError extends Error {
  constructor(
    message: string,
    readonly code: 'not-recognized' | 'no-questions' | 'unsafe-archive',
  ) {
    super(message)
    this.name = 'QuestionFileError'
  }
}

type Input = FormatInput & { word: boolean; shapes: Shape[] }

const looksLikeXml = (text: string) => /^\s*</.test(text)

async function inputOf(name: string, bytes: Uint8Array): Promise<Input> {
  const pdf = () => pdfPages(bytes)
  // A PDF is its printed pages, and nothing else.
  if (isPdf(bytes)) return { name, bytes, word: false, shapes: ['pdf'], text: () => '', zip: async () => null, pdf }
  let zip: ZipFiles | null
  try {
    zip = await readZip(bytes)
  } catch (reason) {
    if (reason instanceof ZipLimitError) throw new QuestionFileError(reason.message, 'unsafe-archive')
    zip = null
  }
  // A Word document is read as its text, as if typed into a text file.
  const word = Boolean(zip && zipFile(zip, 'word/document.xml'))
  const text = zip ? (word ? await wordText(zip) : '') : decodeText(bytes).text
  // A workbook is a Table and any other archive a Package. Text that isn't
  // XML may be a Table as well, as tab-separated cells are.
  const shapes: Shape[] = word
    ? ['text']
    : zip
      ? [zipFile(zip, 'xl/workbook.xml') ? 'table' : 'package']
      : looksLikeXml(text)
        ? ['xml']
        : ['text', 'table']
  return { name, bytes, word, shapes, text: () => text, zip: async () => (word ? null : zip), pdf }
}

const MIN_CONFIDENCE = 0.5
/** A Format's mark is unmistakable in a file that scores this. */
const PLAINLY = 0.9

type Trial = {
  format: FormatSpec
  banks: QuestionBank[]
  issues: ImportIssue[]
  pictures: Record<string, Picture>
  /** How many questions the file held in this Format, including those left out. */
  found: number
  score: number
  confidence: number
}

async function tryFormat(format: FormatSpec, input: FormatInput, score: number, readAt: string): Promise<Trial | null> {
  try {
    const result = await format.parse(input)
    const { banks, issues, pictures } = unify(result, { format: format.id, fileName: input.name, readAt })
    const imported = banks.reduce((sum, bank) => sum + bank.questions.length, 0)
    const found = Math.max(result.found, imported)
    const share = found ? imported / found : 0
    return { format, banks, issues, pictures, found, score, confidence: imported ? 0.5 * score + 0.5 * share : 0 }
  } catch {
    return null
  }
}

const readersFor = (input: Input) => READERS.filter((reader) => input.shapes.includes(reader.shape))

async function candidatesFor(input: Input): Promise<FormatCandidate[]> {
  const scored = await Promise.all(
    readersFor(input).map(async (format) => {
      let score = 0
      try {
        score = await format.detect(input)
      } catch {
        score = 0
      }
      return { format: format.id, label: formatInfo(format.id).label, score: Math.max(0, Math.min(1, score)) }
    }),
  )
  // Stable: Formats listed first win a tie.
  return scored.filter((candidate) => candidate.score > 0).sort((a, b) => b.score - a.score)
}

export async function readQuestionFile(
  file: { name: string; bytes: Uint8Array },
  options: ReadOptions = {},
): Promise<Reading> {
  const readAt = options.readAt ?? new Date().toISOString()
  const input = await inputOf(file.name, file.bytes)
  const candidates = await candidatesFor(input)

  let best: Trial | null = null
  if (options.format) {
    const format = READERS.find(({ id }) => id === options.format)
    if (!format) throw new QuestionFileError('That format is not one this package reads.', 'not-recognized')
    if (!input.shapes.includes(format.shape)) {
      throw new QuestionFileError(`This file can’t be read as ${formatInfo(format.id).label}.`, 'no-questions')
    }
    const score = candidates.find((candidate) => candidate.format === format.id)?.score ?? 0
    best = await tryFormat(format, input, Math.max(score, 0.5), readAt)
    if (!best || !best.found) {
      const first = best?.issues[0]
      throw new QuestionFileError(
        `No questions could be read from this file as ${formatInfo(format.id).label}.` +
          (first ? ` The first problem: ${first.message}` : ''),
        'no-questions',
      )
    }
  } else {
    const trials = await Promise.all(
      candidates
        .filter(({ score }) => score >= 0.3)
        .slice(0, 3)
        .map((candidate) => tryFormat(READERS.find(({ id }) => id === candidate.format)!, input, candidate.score, readAt)),
    )
    for (const trial of trials) {
      if (trial && (!best || trial.confidence > best.confidence + 1e-9)) best = trial
    }
    // A file plainly in a Format whose every question was left out is still
    // that Format's Reading: its Import Issues say why nothing came in.
    if (!best || best.confidence < MIN_CONFIDENCE) {
      best = trials.find((trial) => trial && trial.found > 0 && trial.score >= MIN_CONFIDENCE) ?? best
    }
    if (!best || (best.confidence < MIN_CONFIDENCE && !(best.found > 0 && best.score >= MIN_CONFIDENCE))) {
      // A file plainly in a Format, such as an empty form's printout, that
      // holds no questions at all.
      const empty = trials.find((trial) => trial && trial.score >= PLAINLY && !trial.found)
      if (empty) {
        throw new QuestionFileError(`No questions were found in “${file.name}”, a ${formatInfo(empty.format.id).label}.`, 'no-questions')
      }
      throw new QuestionFileError(
        input.word
          ? 'No questions written in a format this package knows were found in this Word document.'
          : `No questions written in a format this package knows were found in “${file.name}”.`,
        'not-recognized',
      )
    }
  }

  return {
    banks: best.banks,
    issues: best.issues,
    pictures: best.pictures,
    format: best.format.id,
    candidates: candidates.length ? candidates : [{ format: best.format.id, label: formatInfo(best.format.id).label, score: best.confidence }],
  }
}
