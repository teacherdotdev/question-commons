import type { FormatId } from './reader'

/**
 * The unified form every Question File is read into (ADR-0001). A Question
 * Bank is plain JSON-ready data with no identity or storage of its own: an
 * app that keeps one gives it both. Pictures are not inside it; a Reading
 * carries them beside its banks, and rich text names them by key.
 */

export const QUESTION_BANK_FORMAT = 'question-commons/question-bank'
export const QUESTION_BANK_VERSION = '1.0.0'

/** The package that did the reading, recorded in every bank's Provenance. Kept
 *  in step with package.json by a test, so a version bump cannot miss it. */
export const READER = { name: '@teacherdotdev/question-commons', version: '0.3.1' } as const

export type RichTextMark =
  | { type: 'strong' | 'emphasis' | 'inline-code' | 'strike' | 'subscript' | 'superscript' }
  | { type: 'link'; href: string; title?: string }

/**
 * One node of rich text. Math is LaTeX in `source`; a picture is a
 * `block-image` whose `asset` is a key into the Reading's pictures; a
 * `blank` marks where a Fill in the Blank question's blank stands.
 */
export type RichTextNode = {
  type:
    | 'paragraph'
    | 'heading'
    | 'blockquote'
    | 'bullet-list'
    | 'ordered-list'
    | 'list-item'
    | 'code-block'
    | 'rule'
    | 'table'
    | 'table-row'
    | 'table-cell'
    | 'text'
    | 'hard-break'
    | 'inline-math'
    | 'block-image'
    | 'blank'
  content?: RichTextNode[]
  text?: string
  marks?: RichTextMark[]
  level?: number
  start?: number
  language?: string
  source?: string
  header?: boolean
  asset?: string
  alt?: string
}

export type RichText = RichTextNode[]

/** A picture exactly as the file carried it (ADR-0001): its bytes and type. */
export type Picture = { bytes: Uint8Array; mimeType: string }

/** Text values kept under the names the file gave them (ADR-0005). */
export type Extras = Record<string, string>

export type QuestionProvenance = {
  /** The 1-based line or row the question starts on, when the file has lines. */
  line?: number
  /** Its 1-based place among every question in the file, counting those left out. */
  number: number
}

export type BankProvenance = {
  format: FormatId
  formatLabel: string
  fileName: string
  /** When it was read, as an ISO 8601 time. */
  readAt: string
  reader: { name: string; version: string }
}

export type Choice = { content: RichText; correct: boolean }

export type Blank = {
  /** Every answer accepted in this blank. */
  accepted: string[]
  /** Picked from a list rather than written; `accepted` is the right pick. */
  dropdown?: boolean
}

type QuestionBase = {
  stem: RichText
  explanation?: RichText
  topics?: string[]
  /** The points the file gives the whole question, as it wrote them. */
  points?: number
  extras?: Extras
  provenance: QuestionProvenance
}

export type Question = QuestionBase &
  (
    | { type: 'multiple-choice'; choices: Choice[] }
    | { type: 'multiple-answer'; choices: Choice[] }
    | { type: 'true-false'; answer: boolean }
    /** `left` is what a student matches and `right` its answer; a pair with
     *  no left is a distractor, one with no right an unmatched item. */
    | { type: 'matching'; pairs: { left: RichText | null; right: RichText | null }[] }
    /** Blanks in the order the stem's `blank` nodes stand. A stem with no
     *  `blank` node is one whose file did not say where its blank goes. */
    | { type: 'fill-in-the-blank'; blanks: Blank[] }
    | { type: 'short-answer'; suggestedAnswer?: RichText }
    | { type: 'numeric'; answers: { value: string; tolerance?: string }[] }
    /** Items in their correct order. */
    | { type: 'ordering'; items: RichText[] }
  )

export type QuestionType = Question['type']

export type QuestionBank = {
  format: typeof QUESTION_BANK_FORMAT
  version: typeof QUESTION_BANK_VERSION
  name: string
  description?: string
  author?: string
  license?: string
  extras?: Extras
  provenance: BankProvenance
  questions: Question[]
}
