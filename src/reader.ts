import type { RichText } from './question-bank'

/**
 * What every Format's reader hands back, before `unify` turns it into
 * Question Banks. Internal to the package; apps see only the unified form.
 *
 * A parser is a pure function of the file's bytes. The same file always gives
 * the same Questions and the same problems, and nothing is sent anywhere.
 */

export type FormatId =
  | 'bb-generator'
  | 'bb-tsv'
  | 'bb-package'
  | 'qti'
  | 'moodle-xml'
  | 'gift'
  | 'aiken'
  | 'respondus'
  | 'text2qti'
  | 'd2l-csv'
  | 'respondus-csv'
  | 'kahoot'
  | 'blooket'
  | 'spreadsheet'
  | 'flashcards'

/** Blocks of rich text, as a Question Bank Record's documents hold them. */
export type Blocks = RichText

/**
 * One question as its Format meant it, before `unify` gives it its Question
 * Type and Provenance.
 */
export type ReaderQuestion = {
  /** 1-based line (or row) the question starts on, when the format has lines. */
  line?: number
  /** Its 1-based place among every question in the file, counting those left
   *  out, so a note about it names the question the teacher would count to.
   *  Without one, its place among those that came in. */
  number?: number
  /** The type as the source spelled it, such as `MA` or `Fill in the Blank`,
   *  for messages. */
  sourceType?: string
  topics?: string[]
  /** The points the source gives the whole question, as it wrote them. A
   *  positive whole number becomes its Points; any other is dropped, since
   *  Points are positive whole numbers (ADR-0042). A Matching set's are the
   *  set's. */
  points?: number
  stem: Blocks
  /** What the file says about the question as a whole, such as general feedback. */
  explanation?: Blocks
} & (
  | { kind: 'multiple-choice'; choices: ReaderChoice[] }
  /** Several choices may be correct: a student picks all that apply. */
  | { kind: 'multiple-answer'; choices: ReaderChoice[] }
  | { kind: 'true-false'; answer: boolean | null }
  /** `left` is the item a student matches, `right` its answer. A pair with no
   *  left is a distractor answer; one with no right is an unmatched item. */
  | { kind: 'matching'; pairs: { left: Blocks | null; right: Blocks | null }[] }
  /** An essay or short answer, with its model answer if the source gave one. */
  | { kind: 'short-answer'; suggestedAnswer?: Blocks }
  /** Every accepted answer to a fill-in-the-blank or short-answer question.
   *  Its stem marks where the blank goes with `BLANK_MARK`, when the source
   *  says; `dropdown` is a blank a student picked from a list, whose
   *  `accepted` is its correct choice. */
  | { kind: 'fill-in-blank'; accepted: string[]; dropdown?: boolean }
  /** Several named blanks, each with its accepted answers, in the order the
   *  stem's `BLANK_MARK`s stand. */
  | { kind: 'fill-in-blanks'; blanks: ReaderBlank[] }
  | { kind: 'numeric'; answers: { value: string; tolerance?: string }[] }
  /** Items in their correct order. */
  | { kind: 'ordering'; items: Blocks[] }
)

export type ReaderChoice = { content: Blocks; correct: boolean }

/** One blank of a several-blank question. `dropdown` is one a student picked
 *  from a list, whose `accepted` is its correct choice. */
export type ReaderBlank = { name: string; accepted: string[]; dropdown?: boolean }

/**
 * Where a blank stands in a parser's stem text: one per blank, in order.
 * `record.ts` turns each into a Blank holding that blank's answers, so a
 * teacher's own underscores are never mistaken for one. A Unicode
 * noncharacter, which no file means as text; a question that ends up some
 * other kind prints it as `_____`.
 */
export const BLANK_MARK = '\uFDD0'

/** Where a Word picture or equation stood, which text cannot hold: a question
 *  with either is left out (ADR-0003). Noncharacters, like `BLANK_MARK`. */
export const PICTURE_MARK = '\uFDD1'
export const MATH_MARK = '\uFDD2'

export type IssueSeverity = 'error' | 'warning' | 'info'

/**
 * Something about the file a teacher should know. An `error` means a question
 * was left out; a `warning` means it came in changed; `info` is a note.
 */
export type ImportIssue = {
  severity: IssueSeverity
  /** Stable, for tests and for grouping. */
  code: string
  message: string
  line?: number
  /** A short quotation of the source, to find the question by. */
  excerpt?: string
}

/** A picture a package format carries, before it becomes a Media Asset. */
export type ReaderImage = { bytes: Uint8Array; mimeType: string }

export type ParseResult = {
  questions: ReaderQuestion[]
  issues: ImportIssue[]
  /** How many questions the file held, including those left out. */
  found: number
  /** A bank name the file itself gives, such as a pool's title. */
  name?: string
  description?: string
  /** Pictures by the key an image node's `asset` names until they are
   *  turned into Media Assets. */
  images?: Map<string, ReaderImage>
}

/** A file as a parser sees it. `text` is decoded once, for text formats. */
export type FormatInput = {
  name: string
  bytes: Uint8Array
  text: () => string
  /** The files of a ZIP (a .zip, .docx or .xlsx), by path. */
  zip: () => Promise<ZipFiles | null>
}

export type ZipFiles = Map<string, Uint8Array>

export type FormatSpec = {
  /** Its name for a teacher is in `catalog.ts`, kept apart so a drop zone
   *  can list formats without loading their parsers. */
  id: FormatId
  /** How likely this file is in the format, from 0 to 1. It looks, never
   *  parses in full; parsing confirms. */
  detect: (input: FormatInput) => Promise<number> | number
  parse: (input: FormatInput) => Promise<ParseResult> | ParseResult
}
