import { FORMAT_LABELS } from './catalog'
import {
  QUESTION_BANK_FORMAT,
  QUESTION_BANK_VERSION,
  READER,
  type Question,
  type QuestionBank,
} from './question-bank'
import type { FormatId, ImportIssue as ReaderIssue, ParseResult, ReaderQuestion } from './reader'
import { blocksText } from './rich-text'
import { excerpt } from './text'

/**
 * A question, or a part of a Question File, that was left out of a Reading
 * (ADR-0003). `code` is stable, for grouping and counting; `message` is in a
 * teacher's words.
 */
export type ImportIssue = {
  code: string
  message: string
  line?: number
  /** A short quotation of the file, to find the question by. */
  excerpt?: string
}

export type UnifyContext = { format: FormatId; fileName: string; readAt: string }

const EXTENSION = /\.[^./]+$/

/** A bank name from a file name: `Chapter_3 quiz.txt` → `Chapter 3 quiz`. */
export function bankNameFromFile(name: string): string {
  const base = name.replace(/^.*[\\/]/, '').replace(EXTENSION, '').replace(/_+/g, ' ').trim()
  return base || 'Imported questions'
}

/** Only what was left out is an Import Issue; nothing else is reported. */
const leftOut = (issue: ReaderIssue): ImportIssue | null =>
  issue.severity === 'error'
    ? {
        code: issue.code,
        message: issue.message,
        ...(issue.line !== undefined ? { line: issue.line } : {}),
        ...(issue.excerpt ? { excerpt: issue.excerpt } : {}),
      }
    : null

/** One Format's reading of a file, as Question Banks and what was left out. */
export function unify(result: ParseResult, context: UnifyContext): { banks: QuestionBank[]; issues: ImportIssue[] } {
  const issues = result.issues.map(leftOut).filter((issue) => issue !== null)
  const questions: Question[] = []
  result.questions.forEach((question, index) => {
    const number = question.number ?? index + 1
    const unified = unifyQuestion(question, number)
    if ('question' in unified) questions.push(unified.question)
    else {
      const place = question.line ? `Question ${number} (line ${question.line})` : `Question ${number}`
      issues.push({
        code: unified.code,
        message: `${place}: ${unified.message}`,
        ...(question.line ? { line: question.line } : {}),
        excerpt: excerpt(blocksText(question.stem)),
      })
    }
  })
  const bank: QuestionBank = {
    format: QUESTION_BANK_FORMAT,
    version: QUESTION_BANK_VERSION,
    name: result.name?.trim() || bankNameFromFile(context.fileName),
    ...(result.description?.trim() ? { description: result.description.trim() } : {}),
    provenance: {
      format: context.format,
      formatLabel: FORMAT_LABELS[context.format],
      fileName: context.fileName,
      readAt: context.readAt,
      reader: { ...READER },
    },
    questions,
  }
  return { banks: [bank], issues }
}

type Unified = { question: Question } | { code: string; message: string }

function unifyQuestion(question: ReaderQuestion, number: number): Unified {
  const base = {
    stem: question.stem,
    provenance: { ...(question.line ? { line: question.line } : {}), number },
  }
  switch (question.kind) {
    case 'multiple-choice':
      return { question: { ...base, type: 'multiple-choice', choices: question.choices } }
    default:
      return { code: 'unsupported-question', message: 'this kind of question can’t be read yet, so it was left out.' }
  }
}
