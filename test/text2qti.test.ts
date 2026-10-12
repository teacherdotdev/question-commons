import { describe, expect, test } from 'bun:test'
import { plainText, readQuestionFile } from '../src'
import { fixture, readAt } from './helpers'

const encode = (text: string) => new TextEncoder().encode(text)
const read = async (name: string, bytes: Uint8Array) => {
  const reading = await readQuestionFile({ name, bytes }, { readAt })
  return { reading, bank: reading.banks[0]!, questions: reading.banks.flatMap((bank) => bank.questions) }
}

describe('text2qti', () => {
  test('reads every example in text2qti’s README, keeping each Question Type and the quiz’s title', async () => {
    const { reading, bank, questions } = await read('quiz.txt', fixture('text2qti/readme-examples.txt'))
    expect(reading.format).toBe('text2qti')
    expect(bank.name).toBe('Addition')
    expect(bank.description).toBe('Checking addition.')
    expect(questions.map((question) => question.type)).toEqual([
      'multiple-choice', 'multiple-answer', 'numeric', 'numeric', 'numeric', 'fill-in-the-blank', 'short-answer',
      'multiple-choice', 'short-answer',
    ])
    const [addition, dinosaurs, root2, root3, five, santa, essay, wrapped, solution] = questions
    expect(questions.map((question) => question.points)).toEqual([2, ...questions.slice(1).map(() => undefined)])

    expect(plainText(addition!.stem)).toBe('What is 2+3?')
    expect(plainText(addition!.explanation!)).toBe('General question feedback.')
    expect(addition?.type === 'multiple-choice' && addition.choices.map((choice) => [plainText(choice.content), choice.correct])).toEqual([
      ['6', false], ['1', false], ['5', true],
    ])
    expect(dinosaurs?.type === 'multiple-answer' && dinosaurs.choices.map((choice) => choice.correct)).toEqual([false, true, true, false])

    expect(root2?.type === 'numeric' && root2.answers).toEqual([{ value: '1.4142', tolerance: '0.0001' }])
    // A range is its middle and how far either side, as GIFT gives one.
    expect(root3?.type === 'numeric' && root3.answers).toEqual([{ value: '1.2599', tolerance: '0.0001' }])
    expect(five?.type === 'numeric' && five.answers).toEqual([{ value: '5' }])
    expect(santa?.type === 'fill-in-the-blank' && santa.blanks).toEqual([
      { accepted: ['Santa', 'Santa Claus', 'Father Christmas', 'Saint Nicholas', 'Saint Nick'] },
    ])
    expect(plainText(essay!.stem)).toBe('Write an essay.')
    expect(plainText(essay!.explanation!)).toBe('General question feedback.')

    expect(plainText(wrapped!.stem)).toBe(
      'A question paragraph that is long enough to wrap onto a second line. The second line must be indented to match up with the start of the paragraph text on the first line.\nAnother paragraph.',
    )
    expect(solution?.type === 'short-answer' && plainText(solution.suggestedAnswer!)).toBe(
      'This is important information about what the essay should cover.\nThis will only appear in the solutions, and can be as long or short as you wish.',
    )

    // A file upload is not a short answer, so it is left out rather than changed into one.
    expect(reading.issues.map((issue) => [issue.code, issue.line])).toEqual([['file-upload', 43]])
  })

  test('brings in every question in a group, keeps Markdown and math, and leaves out code it would have to run', async () => {
    const { reading, questions } = await read('groups.txt', fixture('text2qti/group-and-code.txt'))
    expect(reading.format).toBe('text2qti')
    expect(questions.map((question) => question.type)).toEqual(['true-false', 'true-false', 'multiple-choice'])
    expect(reading.issues.map((issue) => issue.code)).toEqual(['code-block-not-run'])
    const newton = questions[2]!
    expect(newton.stem).toEqual([{
      type: 'paragraph',
      content: [
        { type: 'text', text: 'What does ' },
        { type: 'text', text: 'Newton\'s second law', marks: [{ type: 'strong' }] },
        { type: 'text', text: ' say, with ' },
        { type: 'inline-math', source: 'F' },
        { type: 'text', text: ' in ' },
        { type: 'text', text: 'newtons', marks: [{ type: 'emphasis' }] },
        { type: 'text', text: '?' },
      ],
    }])
  })

  test('a question with no correct choice is left out, and says how to mark one', async () => {
    const { reading, questions } = await read('quiz.txt', encode('Quiz title: T\n\n1.  What is 2+3?\na)  6\nb)  5\n\n2.  Which?\n[*] this\n[ ] that\n'))
    expect(questions).toHaveLength(1)
    expect(reading.issues.find((issue) => issue.code === 'no-correct-answer')?.message).toBe(
      'Question 1 (line 3): no choice is marked correct. Put * directly before the correct choice’s letter, e.g. “*c) 5”.',
    )
  })

  test('a plain numbered file with no text2qti markers is left to the Blackboard Test Generator', async () => {
    const { reading } = await read('plain.txt', encode('1.  What is 2+3?\na)  6\nb)  1\n*c) 5\n'))
    expect(reading.format).toBe('bb-generator')
  })

  test('keeps the points each question is given, as written, a group’s unless a question gives its own', async () => {
    const { questions } = await read('quiz.txt', encode([
      'Quiz title: Rivers', '', 'GROUP', 'pick: 1', 'points per question: 3',
      '1.  Which river is longest?', '*a)  The Nile', 'b)  The Thames', '',
      'Points: 1', '2.  Which river is shortest?', 'a)  The Nile', '*b)  The Thames', 'END_GROUP', '',
      'Points: 1.5', '3.  Describe a river.', '____',
    ].join('\n')))
    expect(questions.map((question) => question.points)).toEqual([3, 1, 1.5])
  })
})
