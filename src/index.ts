import { FORMAT_LABELS } from './catalog'
import { FORMATS } from './formats'
import type { Picture, QuestionBank } from './question-bank'
import type { FormatId, FormatInput, FormatSpec, ZipFiles } from './reader'
import { decodeText } from './text'
import { unify, type ImportIssue } from './unify'
import { readZip, ZipLimitError } from './zip'

export * from './question-bank'
export type { FormatId } from './reader'
export type { ImportIssue } from './unify'
export { FORMAT_LABELS, QUESTION_FILE_EXTENSIONS, SUPPORTED_SOURCES, isQuestionFileName } from './catalog'
export { blocksText as plainText } from './rich-text'

/**
 * Reading a Question File into Question Banks with rules alone (ADR-0004):
 * the file is scored against every Format, read with the few that score
 * best, and the Reading that brings in the most wins. The other Formats it
 * could be are offered, so an app can let a teacher read it as another.
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

async function inputOf(name: string, bytes: Uint8Array): Promise<FormatInput> {
  let zip: ZipFiles | null
  try {
    zip = await readZip(bytes)
  } catch (reason) {
    if (reason instanceof ZipLimitError) throw new QuestionFileError(reason.message, 'unsafe-archive')
    zip = null
  }
  const text = zip ? '' : decodeText(bytes).text
  return { name, bytes, text: () => text, zip: async () => zip }
}

const MIN_CONFIDENCE = 0.5

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

async function candidatesFor(input: FormatInput): Promise<FormatCandidate[]> {
  const scored = await Promise.all(
    FORMATS.map(async (format) => {
      let score = 0
      try {
        score = await format.detect(input)
      } catch {
        score = 0
      }
      return { format: format.id, label: FORMAT_LABELS[format.id], score: Math.max(0, Math.min(1, score)) }
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
    const format = FORMATS.find(({ id }) => id === options.format)
    if (!format) throw new QuestionFileError('That format is not one this package reads.', 'not-recognized')
    const score = candidates.find((candidate) => candidate.format === format.id)?.score ?? 0
    best = await tryFormat(format, input, Math.max(score, 0.5), readAt)
    if (!best || !best.found) {
      const first = best?.issues[0]
      throw new QuestionFileError(
        `No questions could be read from this file as ${FORMAT_LABELS[format.id]}.` +
          (first ? ` The first problem: ${first.message}` : ''),
        'no-questions',
      )
    }
  } else {
    const trials = await Promise.all(
      candidates
        .filter(({ score }) => score >= 0.3)
        .slice(0, 3)
        .map((candidate) => tryFormat(FORMATS.find(({ id }) => id === candidate.format)!, input, candidate.score, readAt)),
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
      throw new QuestionFileError(
        `No questions written in a format this package knows were found in “${file.name}”.`,
        'not-recognized',
      )
    }
  }

  return {
    banks: best.banks,
    issues: best.issues,
    pictures: best.pictures,
    format: best.format.id,
    candidates: candidates.length ? candidates : [{ format: best.format.id, label: FORMAT_LABELS[best.format.id], score: best.confidence }],
  }
}
