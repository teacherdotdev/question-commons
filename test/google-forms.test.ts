import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { QuestionFileError, readQuestionFile, type RichTextNode } from '../src'
import { FORMS, type Item } from '../scripts/google-forms/spec'
import { fixture, readAt } from './helpers'

const read = (key: string, variant = '') =>
  readQuestionFile({ name: `${key}${variant}.pdf`, bytes: fixture(`google-forms/${key}${variant}.pdf`) }, { readAt })

const VARIANTS = ['.headers', '.a4', '.scaled', '.nomargin', '.landscape']

const form = (key: string) => FORMS.find((spec) => spec.key === key)!

/** What an Import Issue quotes of a question: its text on one line, cut at 60 characters. */
const quoted = (title: string) => {
  const flat = title.replace(/\s+/g, ' ').trim()
  return flat.length > 60 ? `${flat.slice(0, 59)}…` : flat
}

/** A paragraph of plain text, its line breaks kept. */
const paragraph = (text: string): RichTextNode => ({
  type: 'paragraph',
  content: text.split('\n').flatMap((line, index): RichTextNode[] => [
    ...(index ? [{ type: 'hard-break' as const }] : []),
    ...(line ? [{ type: 'text' as const, text: line }] : []),
  ]),
})

/** A one-page PDF holding the given lines, written by hand, as any other
 *  program might write one. */
function plainPdf(lines: string[]): Uint8Array {
  const text = lines.map((line, index) => `BT /F1 12 Tf 72 ${720 - index * 16} Td (${line}) Tj ET`).join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = objects.map((body, index) => {
    const offset = pdf.length
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
    return offset
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  pdf += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(pdf)
}

describe('A Google Forms printout', () => {
  test('is read as one bank named by the form’s title, with its description', async () => {
    const reading = await read('mc-basic')
    expect(reading.format).toBe('google-forms-print')
    expect(reading.banks.map((bank) => [bank.name, bank.description])).toEqual([[form('mc-basic').title, form('mc-basic').description]])
    expect(reading.banks[0]!.provenance.formatLabel).toBe('Google Forms printout')
  })

  test('keeps the description’s line breaks and blank lines, and its title’s symbols', async () => {
    const [bank] = (await read('tricky-text')).banks
    expect(bank!.name).toBe('Tricky Text — Ünïcödé & Symbols')
    expect(bank!.description).toBe('Line one of the description.\nLine two, after a break.\n\nA paragraph after a blank line.')
    expect(bank!.description).toBe(form('tricky-text').description!)
  })

  test('names an untitled form as its printout does, and gives no description where the form has none', async () => {
    // The form's title is empty; the printout calls it “Untitled form” (fixtures.json).
    expect((await read('untitled')).banks.map((bank) => [bank.name, bank.description])).toEqual([['Untitled form', undefined]])
    expect((await read('feedback')).banks.map((bank) => [bank.name, bank.description])).toEqual([[form('feedback').title, undefined]])
  })
})

describe('An empty form’s printout', () => {
  test('is known for what it is, and says it has no questions', async () => {
    const reading = read('empty')
    await expect(reading).rejects.toBeInstanceOf(QuestionFileError)
    await expect(reading).rejects.toMatchObject({
      code: 'no-questions',
      message: 'No questions were found in “empty.pdf”, a Google Forms printout.',
    })
  })
})

describe('A printout’s questions', () => {
  test('leave out every choice question, since a printout shows no answer key', async () => {
    const reading = await read('mc-basic')
    expect(reading.banks[0]!.questions).toEqual([])
    expect(reading.issues).toEqual(
      form('mc-basic').items.map((item, index) => ({
        code: 'no-answer-key',
        message: `Question ${index + 1}: Google Forms printouts don’t show which answer is right, so this multiple choice question was left out.`,
        excerpt: item.title,
      })),
    )
  })

  test('bring in short answer and paragraph questions as Short Answer, and leave out every other kind, naming it', async () => {
    const reading = await read('all-types')
    const [short, paragraphQuestion] = reading.banks[0]!.questions
    expect(reading.banks[0]!.questions).toHaveLength(2)
    expect(short).toMatchObject({ type: 'short-answer', stem: [paragraph('Short answer: name the closest star to Earth.')], provenance: { number: 4 } })
    // Its help text follows the title as a paragraph of its own.
    expect(paragraphQuestion).toMatchObject({
      type: 'short-answer',
      stem: [paragraph('Paragraph: explain why the sky is blue.'), paragraph('Two or three sentences.')],
      provenance: { number: 5 },
    })
    for (const question of reading.banks[0]!.questions) {
      expect(question).not.toHaveProperty('suggestedAnswer')
      expect(question.provenance).not.toHaveProperty('line')
    }
    const answerKey = (number: number, kind: string) =>
      ['no-answer-key', `Question ${number}: Google Forms printouts don’t show which answer is right, so this ${kind} question was left out.`]
    const unsupported = (number: number, kind: string) => ['unsupported-type', `Question ${number}: ${kind} questions can’t be read, so it was left out.`]
    expect(reading.issues.map((issue) => [issue.code, issue.message])).toEqual([
      answerKey(1, 'multiple choice'),
      answerKey(2, 'checkbox'),
      answerKey(3, 'dropdown'),
      unsupported(6, 'linear scale'),
      unsupported(7, 'multiple choice grid'),
      unsupported(8, 'checkbox grid'),
      unsupported(9, 'date'),
      unsupported(10, 'time'),
      unsupported(11, 'date and time'),
      unsupported(12, 'duration'),
    ])
    const titles = form('all-types').items.map((item) => item.title)
    expect(reading.issues.map((issue) => issue.excerpt)).toEqual(titles.filter((_, index) => index !== 3 && index !== 4).map(quoted))
  })
})

/**
 * What ADR-0007 says each form's printout gives, from the form as it was
 * built: its numbered questions are every item but sections, page breaks,
 * pictures and videos; short answer and paragraph questions come in, every
 * other kind is left out, saying why.
 */
const KINDS: Record<string, string> = {
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
const NOT_QUESTIONS = ['section', 'page', 'image', 'video']

function expected(key: string) {
  const spec = form(key)
  const questions = spec.items.filter((item) => !NOT_QUESTIONS.includes(item.type))
  const kept = questions.flatMap((item, index) =>
    item.type === 'short' || item.type === 'paragraph'
      ? [{ number: index + 1, stem: [paragraph(item.title), ...(item.help ? [paragraph(item.help)] : [])] }]
      : [],
  )
  const issues = questions.flatMap((item: Item, index) => {
    if (item.type === 'short' || item.type === 'paragraph') return []
    const choice = ['mc', 'checkbox', 'dropdown'].includes(item.type)
    return [{
      code: choice ? 'no-answer-key' : 'unsupported-type',
      message: choice
        ? `Question ${index + 1}: Google Forms printouts don’t show which answer is right, so this ${KINDS[item.type]} question was left out.`
        : `Question ${index + 1}: ${KINDS[item.type]} questions can’t be read, so it was left out.`,
      ...(item.title ? { excerpt: quoted(item.title) } : {}),
    }]
  })
  return { name: spec.title || 'Untitled form', description: spec.description, kept, issues }
}

const summary = (reading: Awaited<ReturnType<typeof read>>) => ({
  name: reading.banks[0]!.name,
  description: reading.banks[0]!.description,
  kept: reading.banks[0]!.questions.map((question) => ({ number: question.provenance.number, stem: question.stem })),
  issues: reading.issues,
})

const WITH_QUESTIONS = FORMS.filter((spec) => spec.items.length).map((spec) => spec.key)

describe('A printout across many pages', () => {
  test('gives each of a long quiz’s 60 questions once, numbered 1 to 60 in order', async () => {
    const { issues } = await read('long-quiz', '.headers')
    expect(issues.map((issue) => issue.message.match(/^Question (\d+):/)?.[1])).toEqual(Array.from({ length: 60 }, (_, index) => String(index + 1)))
    expect(issues[6]!.excerpt).toBe('Question 7: Photosynthesis takes place mostly in the leaves…')
    expect(issues[59]!.excerpt).toBe('What is 60 × 3?')
  })

  test('keeps a question longer than a page as one, and the question after it as the next', async () => {
    // Its passage runs from page 2 to page 3, and its choices on past it.
    const { issues } = await read('huge-stem', '.headers')
    expect(issues.map((issue) => [issue.message.slice(0, 11), issue.excerpt])).toEqual([
      ['Question 1:', 'Read the passage. Photosynthesis takes place mostly in the …'],
      ['Question 2:', 'A short question after the long one: what gas do plants rel…'],
    ])
  })

  test('reads a question whose choices go on to the next page as one question', async () => {
    // Question 3's first choice is on page 1 and the others on page 2.
    const { issues } = await read('tricky-text')
    expect(issues.slice(2, 4).map((issue) => issue.excerpt)).toEqual(['Which emoji is a planet? 🌍🌙⭐', 'Which word is Arabic for “book”?'])
  })
})

describe('A printout’s text', () => {
  test('comes through as the form has it: symbols, emoji, accents, quotes, dashes and addresses', async () => {
    const { issues } = await read('tricky-text', '.headers')
    expect(issues.map((issue) => issue.excerpt)).toEqual([
      'Which is equal to √16 + 2³?',
      'Pick the inequality that is true: π ≥ 3.14 or π ≤ 3?',
      'Which emoji is a planet? 🌍🌙⭐',
      'Which word is Arabic for “book”?',
      'Which word is Hebrew for “peace”?',
      'Options that look like numbering',
      'Which statement is right?',
      'A question with a line break in it?',
      'Answer: is this a trick question? Correct answer: maybe',
      'Visit https://example.com/quiz?q=1&a=2 — what does q equal?',
      '“Smart quotes”, ‘apostrophes’ and — dashes – work?',
      'Trailing and inner spaces?',
      'Accents: café, naïve, façade. Which is French for “coffee”?',
      'What is 1/2 + 1/4?',
    ])
  })

  test('leaves out a required question’s asterisk, and the dropdown badge', async () => {
    const reading = await read('points-and-required')
    expect(reading.banks[0]!.questions.map((question) => question.stem)).toEqual([[paragraph('Short answer worth 5, required.')]])
    expect(reading.issues.map((issue) => issue.excerpt)).toContain('Worth one point, required.')
    expect((await read('all-types')).issues[2]!.excerpt).toBe('Dropdown: what is the capital of France?')
  })
})

describe('Short answer questions with tricky text', () => {
  const stems = async (key: string, variant = '') =>
    (await read(key, variant)).banks[0]!.questions.map((question) => question.stem)

  test('come in whole, exactly as the form has them', async () => {
    const photosynthesis =
      'Photosynthesis takes place mostly in the leaves, where chloroplasts capture light energy and use it to turn carbon dioxide and water into glucose and oxygen. ' +
      'The light-dependent reactions happen in the thylakoid membranes, and the Calvin cycle happens in the stroma.'
    expect(await stems('short-answers-tricky')).toEqual([
      // Right-to-left words read in the order they were written.
      [paragraph('Translate كتاب (Arabic) and שלום (Hebrew) into English.')],
      [paragraph('Which planet is shown? 🌍 🪐 🌙'), paragraph('Answer with one word 🙂')],
      [paragraph('Spacing:   three   spaces   between   words.')],
      [
        paragraph('Explain the dash — and the en dash – in “quotes”.'),
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'First line of help.' },
            { type: 'hard-break' },
            { type: 'text', text: 'Second line of help.' },
            { type: 'hard-break' },
            { type: 'hard-break' },
            { type: 'text', text: 'A paragraph after a blank line.' },
          ],
        },
      ],
      [{ type: 'paragraph', content: [{ type: 'text', text: 'A title with a manual' }, { type: 'hard-break' }, { type: 'text', text: 'line break in it.' }] }],
      [paragraph('Math: if f(x) = x² − 3x + 2 ≥ 0, for which x is √(x) ≤ π?')],
      // Wrapped over eight printed lines, with the required asterisk at the end of the first.
      [paragraph(`A long question that wraps over several printed lines: ${photosynthesis} ${photosynthesis} Name the cycle.`)],
      // Wrapped after “up-to-”.
      [paragraph('Describe a state-of-the-art, well-thought-out, self-contained, second-to-none, up-to-date, one-of-a-kind, never-before-seen experiment-design-and-analysis-process in detail.')],
      // The address is too long for a line, so it breaks mid-word.
      [paragraph('Open https://example.com/a/very/long/path/that/keeps/going/and/going/until/it/must/wrap/somewhere/on/the/printed/page?with=query&and=more and say what it shows.')],
      [paragraph('1. A title that itself starts with a number.')],
      [paragraph('Answer: what does “Mark only one oval.” mean?')],
      [paragraph('Café, naïve, façade, jalapeño, Æsir, Øresund, Ångström, Straße, İstanbul, Đà Nẵng.')],
    ])
  })

  test('keep a long description’s paragraphs, blank line and list-like lines', async () => {
    const photosynthesis =
      'Photosynthesis takes place mostly in the leaves, where chloroplasts capture light energy and use it to turn carbon dioxide and water into glucose and oxygen. ' +
      'The light-dependent reactions happen in the thylakoid membranes, and the Calvin cycle happens in the stroma.'
    const [bank] = (await read('long-description')).banks
    expect(bank!.description).toBe(
      `${[photosynthesis, photosynthesis, photosynthesis, photosynthesis].join(' ')}\n` +
        `Second paragraph: ${[photosynthesis, photosynthesis, photosynthesis].join(' ')}\n` +
        '\nThird paragraph after a blank line, with a list:\n1. first\n2. second\n- a dash item',
    )
    expect(bank!.description).toBe(form('long-description').description!)
  })

  test('keep “Name: ____” lines in a description', async () => {
    expect((await read('teacher-mix')).banks[0]!.description).toBe('Name: ____________  Period: ____\nAnswer every question. Show your work where asked.')
  })
})

describe('A printout with over a hundred questions', () => {
  test('gives all 120, numbered 1 to 120: every third a short answer that comes in, the rest left out', async () => {
    const reading = await read('hundred-plus')
    const shortAnswers = Array.from({ length: 40 }, (_, index) => 3 * index + 1)
    expect(reading.banks[0]!.questions.map((question) => [question.provenance.number, question.stem])).toEqual(
      shortAnswers.map((number) => [number, [paragraph(`Short answer ${number}: what is ${number} + ${number}?`)]]),
    )
    const choices = Array.from({ length: 120 }, (_, index) => index + 1).filter((number) => !shortAnswers.includes(number))
    expect(reading.issues.map((issue) => [issue.code, issue.message.match(/^Question (\d+):/)![1], issue.excerpt])).toEqual(
      choices.map((number) => ['no-answer-key', String(number), `Choice ${number}: what is ${number} − 1?`]),
    )
  })
})

describe('Titles that start with a number', () => {
  test('of sections, pictures and page breaks are not questions; a question titled “12” is one', async () => {
    const reading = await read('numbered-titles')
    expect(reading.banks.map((bank) => [bank.name, bank.description])).toEqual([['2024 Final Review', '3 parts, 45 minutes.']])
    expect(reading.issues).toEqual([])
    expect(reading.banks[0]!.questions.map((question) => [question.provenance.number, question.stem])).toEqual([
      [1, [paragraph('What year is it?')]],
      [2, [paragraph('How many parts does the diagram show?')]],
      [3, [paragraph('4.5 is a number. Is it a question number?')]],
      [4, [paragraph('12')]],
    ])
  })
})

describe('Every fixture printout', () => {
  test.each(WITH_QUESTIONS)('%s gives the form’s questions in order, each kept or left out as ADR-0007 says', async (key) => {
    const reading = await read(key)
    expect(reading.banks).toHaveLength(1)
    expect(summary(reading)).toEqual(expected(key))
  })

  // The same form printed other ways: with Chrome's header (the date and
  // title) and footer (the form's address and page numbers), on A4, scaled
  // to 70%, with no margins at all, and in landscape. Each moves the form on
  // its pages and breaks it across them in other places.
  const variants = FORMS.flatMap((spec) =>
    VARIANTS.filter((variant) => existsSync(new URL(`./fixtures/google-forms/${spec.key}${variant}.pdf`, import.meta.url)))
      .map((variant) => [spec.key, variant] as const),
  )
  test.each(variants)('%s reads the same printed as %s', async (key, variant) => {
    const outcome = (variant: string) =>
      read(key, variant).then(
        ({ banks, issues }) => ({ banks: banks.map((bank) => ({ ...bank, provenance: { ...bank.provenance, fileName: '' } })), issues }),
        (error: QuestionFileError) => ({ error: error.code, message: error.message.replace(variant, '') }),
      )
    expect(await outcome(variant)).toEqual(await outcome(''))
  })
})

describe('A PDF that is not a Google Forms printout', () => {
  test('is not recognised, even with a line a printout would hold', async () => {
    const bytes = plainPdf(['Chapter 3 review', '1. What is 2 + 2?', 'Mark only one oval.', 'A. 3', 'B. 4'])
    const reading = readQuestionFile({ name: 'review.pdf', bytes }, { readAt })
    await expect(reading).rejects.toBeInstanceOf(QuestionFileError)
    await expect(reading).rejects.toMatchObject({ code: 'not-recognized' })
  })
})
