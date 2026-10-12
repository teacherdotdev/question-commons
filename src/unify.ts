import { FORMAT_LABELS } from './catalog'
import {
  QUESTION_BANK_FORMAT,
  QUESTION_BANK_VERSION,
  READER,
  type Question,
  type QuestionBank,
  type RichText,
  type RichTextNode,
} from './question-bank'
import { BLANK_MARK, type FormatId, type ImportIssue as ReaderIssue, type ParseResult, type ReaderQuestion } from './reader'
import { blocksText, isBlank } from './rich-text'
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

const leaveOut = (code: string, message: string): Unified => ({ code, message })

/** A blank's place in the stem: a `blank` node in a Fill in the Blank
 *  question, and the line a student sees anywhere else. */
function placeBlanks(blocks: RichText, asBlank: boolean): RichText {
  const walk = (node: RichTextNode): RichTextNode[] => {
    if (node.type === 'text' && node.text?.includes(BLANK_MARK)) {
      if (!asBlank) return [{ ...node, text: node.text.replaceAll(BLANK_MARK, '_____') }]
      return node.text.split(BLANK_MARK).flatMap((text, index) => [
        ...(index > 0 ? [{ type: 'blank' } as RichTextNode] : []),
        ...(text ? [{ ...node, text }] : []),
      ])
    }
    return [node.content ? { ...node, content: node.content.flatMap(walk) } : node]
  }
  return blocks.flatMap(walk)
}

function unifyQuestion(question: ReaderQuestion, number: number): Unified {
  const fillIn = question.kind === 'fill-in-blank' || question.kind === 'fill-in-blanks'
  if (question.kind !== 'matching' && isBlank(question.stem)) {
    return leaveOut('empty-stem', 'it has no question text, so it was left out.')
  }
  const topics = question.topics?.map((topic) => topic.trim()).filter(Boolean)
  const base = {
    stem: placeBlanks(question.stem, fillIn),
    ...(question.explanation && !isBlank(question.explanation) ? { explanation: question.explanation } : {}),
    ...(topics?.length ? { topics: [...new Set(topics)] } : {}),
    ...(question.points !== undefined ? { points: question.points } : {}),
    provenance: { ...(question.line ? { line: question.line } : {}), number },
  }
  const noRightAnswer = () => leaveOut('no-correct-answer', 'no answer is marked right, so it was left out.')
  switch (question.kind) {
    case 'multiple-choice':
    case 'multiple-answer':
      if (!question.choices.some((choice) => choice.correct)) return noRightAnswer()
      return { question: { ...base, type: question.kind, choices: question.choices } }
    case 'true-false':
      if (question.answer === null) return leaveOut('no-correct-answer', 'it does not say whether it is true or false, so it was left out.')
      return { question: { ...base, type: 'true-false', answer: question.answer } }
    case 'matching':
      return { question: { ...base, type: 'matching', pairs: question.pairs } }
    case 'short-answer':
      return {
        question: {
          ...base,
          type: 'short-answer',
          ...(question.suggestedAnswer && !isBlank(question.suggestedAnswer) ? { suggestedAnswer: question.suggestedAnswer } : {}),
        },
      }
    case 'fill-in-blank':
    case 'fill-in-blanks': {
      const blanks = question.kind === 'fill-in-blank'
        ? [{ accepted: question.accepted, dropdown: question.dropdown }]
        : question.blanks
      if (blanks.some((blank) => !blank.accepted.some((answer) => answer.trim()))) {
        return leaveOut('no-accepted-answer', 'a blank has no accepted answer, so it was left out.')
      }
      return {
        question: {
          ...base,
          type: 'fill-in-the-blank',
          blanks: blanks.map((blank) => ({ accepted: blank.accepted, ...(blank.dropdown ? { dropdown: true } : {}) })),
        },
      }
    }
    case 'numeric':
      if (!question.answers.length) return leaveOut('no-accepted-answer', 'it gives no numeric answer, so it was left out.')
      return { question: { ...base, type: 'numeric', answers: question.answers } }
    case 'ordering':
      return { question: { ...base, type: 'ordering', items: question.items } }
  }
}
