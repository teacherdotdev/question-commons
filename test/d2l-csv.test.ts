import { describe, expect, test } from 'bun:test'
import { plainText, readQuestionFile } from '../src'
import { fixture, readAt } from './helpers'

const encode = (text: string) => new TextEncoder().encode(text)
const read = async (name: string, bytes: Uint8Array) => {
  const reading = await readQuestionFile({ name, bytes }, { readAt })
  return { reading, questions: reading.banks.flatMap((bank) => bank.questions) }
}

describe('Brightspace (D2L) question CSV', () => {
  test('reads one question of each type it has, with its Points and its feedback as the explanation', async () => {
    const { reading, questions } = await read('rocks.csv', fixture('d2l-csv/every-type.csv'))
    expect(reading.format).toBe('d2l-csv')
    expect(questions.map((question) => question.type)).toEqual([
      'short-answer', 'fill-in-the-blank', 'matching', 'multiple-choice', 'true-false', 'multiple-answer', 'ordering',
    ])
    const [essay, symbol, layers, lava, earthquakes, igneous, order] = questions
    expect(questions.map((question) => question.points)).toEqual([3, 1, 2, 1, undefined, undefined, undefined])
    expect(essay?.type === 'short-answer' && plainText(essay.suggestedAnswer!)).toBe('Magma rises through cracks in the crust.')
    expect(plainText(essay!.explanation!)).toBe('Mention magma and the crust.')
    expect(symbol?.type === 'fill-in-the-blank' && symbol.blanks).toEqual([{ accepted: ['H2O', 'h2o'] }])
    // Matches pair with their choices by number, whatever their order.
    expect(layers?.type === 'matching' && layers.pairs.map((pair) => [plainText(pair.left!), plainText(pair.right!)])).toEqual([
      ['Crust', 'Outside'], ['Core', 'Centre'],
    ])
    expect(lava?.type === 'multiple-choice' && lava.choices.map((choice) => choice.correct)).toEqual([false, true, false])
    expect(earthquakes?.type === 'true-false' && earthquakes.answer).toBe(false)
    expect(igneous?.type === 'multiple-answer' && igneous.choices.map((choice) => choice.correct)).toEqual([true, false, true])
    expect(order?.type === 'ordering' && order.items.map(plainText)).toEqual(['Crust', 'Mantle', 'Core'])
  })

  test('leaves out a question whose picture is a separate file, one whose answer is a regular expression, and a type it cannot read', async () => {
    const { reading } = await read('rocks.csv', fixture('d2l-csv/every-type.csv'))
    expect(reading.issues.map((issue) => [issue.code, issue.line])).toEqual([
      ['picture-not-imported', 41],
      ['regular-expression', 46],
      ['unreadable-question', 49],
    ])
    expect(reading.issues[2]!.message).toBe('Question 10 (line 49): “LK” is not a Brightspace question type that can be read.')
  })

  test('reads HTML question text, and a right answer weighted below 100', async () => {
    const { questions } = await read('quiz.csv', encode([
      'NewQuestion,MC,,,',
      'QuestionText,<p>Which is <strong>largest</strong>?</p>,HTML,,',
      'Option,0,Mars,,',
      'Option,90,Jupiter,,',
      'Option,40,Saturn,,',
      '',
      'newquestion,MC',
      'QuestionText,Plain text with <brackets>',
      'Option,100,Yes',
      'Option,0,No',
    ].join('\n')))
    expect(plainText(questions[0]!.stem)).toBe('Which is largest?')
    expect(questions[0]!.stem[0]).toMatchObject({ content: [{ text: 'Which is ' }, { text: 'largest', marks: [{ type: 'strong' }] }, { text: '?' }] })
    expect(questions[0]?.type === 'multiple-choice' && questions[0].choices.map((choice) => choice.correct)).toEqual([false, true, false])
    expect(plainText(questions[1]!.stem)).toBe('Plain text with <brackets>')
  })
})
