import { describe, expect, test } from 'bun:test'
import { plainText, readQuestionFile, type Question } from '../src'
import { fixture, readAt } from './helpers'

const encode = (text: string) => new TextEncoder().encode(text)

async function read(name: string, bytes: Uint8Array) {
  const reading = await readQuestionFile({ name, bytes }, { readAt })
  return { reading, questions: reading.banks.flatMap((bank) => bank.questions) }
}

function as<T extends Question['type']>(question: Question | undefined, type: T): Extract<Question, { type: T }> {
  if (question?.type !== type) throw new Error(`expected ${type}, got ${question?.type}`)
  return question as Extract<Question, { type: T }>
}

const blanksIn = (question: Question) => JSON.stringify(question.stem).split('"blank"').length - 1

describe('Moodle GIFT', () => {
  test('reads every Question Type GIFT carries, exactly as written', async () => {
    const { reading, questions } = await read('science-review.gift', fixture('gift/science-review.gift'))
    expect(reading.format).toBe('gift')
    const byTitle = (stem: string) => questions.find((question) => plainText(question.stem).startsWith(stem))

    const tf = as(byTitle('Water boils'), 'true-false')
    expect(tf.answer).toBe(true)
    expect(plainText(tf.explanation!)).toBe('At sea level, yes.')
    expect(tf.topics).toEqual(['review'])

    expect(as(byTitle('Which gas'), 'multiple-choice').choices.map((choice) => [plainText(choice.content), choice.correct])).toEqual([
      ['carbon dioxide', true], ['oxygen', false], ['nitrogen', false],
    ])

    const spider = as(byTitle('A spider'), 'fill-in-the-blank')
    expect(plainText(spider.stem)).toBe('A spider has _____ legs.')
    expect(blanksIn(spider)).toBe(1)
    expect(spider.blanks).toEqual([{ accepted: ['eight', '8'] }])

    // Accepted answers with nowhere marked in the sentence: still Fill in the Blank, with no blank placed.
    const mars = as(byTitle('Which planet'), 'fill-in-the-blank')
    expect(blanksIn(mars)).toBe(0)
    expect(mars.blanks).toEqual([{ accepted: ['Mars', 'the red planet'] }])

    expect(as(byTitle('Match each'), 'matching').pairs.map((pair) => [plainText(pair.left!), plainText(pair.right!)])).toEqual([
      ['cat', 'fish'], ['cow', 'grass'], ['bird', 'seeds'],
    ])

    expect(as(byTitle('How many days'), 'numeric').answers).toEqual([{ value: '366', tolerance: '0' }])
    expect(as(byTitle('Name a number'), 'numeric').answers).toEqual([{ value: '3', tolerance: '2' }])
    expect(byTitle('Explain how')?.type).toBe('short-answer')

    // Several right answers stay Multiple Answer; nothing is folded into Multiple Choice.
    expect(as(byTitle('Which of these'), 'multiple-answer').choices.map((choice) => choice.correct)).toEqual([true, true, false])

    expect(as(byTitle('Which answer equals'), 'multiple-choice').choices.map((choice) => plainText(choice.content))).toEqual([
      '= 2 + 2', '= 2 + 3', '= 2 + 4',
    ])
    expect(byTitle('The Moon')?.topics).toEqual(['space'])
  })

  test('leaves out a question whose picture the file cannot carry, and reports the description it skipped', async () => {
    const { reading, questions } = await read('science-review.gift', fixture('gift/science-review.gift'))
    expect(questions.some((question) => plainText(question.stem).startsWith('What is shown'))).toBe(false)
    expect(questions).toHaveLength(11)
    expect(reading.issues.map((issue) => [issue.code, issue.line])).toEqual([
      ['picture-missing', 34],
      ['description-skipped', 37],
    ])
  })

  test('a broken question is left out with its line, and the rest still come in', async () => {
    const { reading, questions } = await read('q.gift', encode('::A:: One? {=1 ~2\n\n::B:: Two? {#two}\n\n::C:: Three? {=3 ~4}\n'))
    expect(questions).toHaveLength(1)
    expect(reading.issues.map((issue) => issue.message)).toEqual([
      'Question 1 (line 1): its answers start with “{” but never end with “}”.',
      'Question 2 (line 3): its numerical answer “two” is not a number, a number:tolerance, or a range such as 1..5.',
    ])
  })

  test('[html] text keeps its formatting, and general feedback is the explanation', async () => {
    const { questions } = await read('q.gift', encode('::Q:: [html]<p>What is <b>2 + 2</b>?</p> { =4 ~3 ~5 ####Count on your fingers. }\n\n::R:: Sky colour? {=blue ~green}'))
    expect(plainText(questions[0]!.stem)).toBe('What is 2 + 2?')
    expect(JSON.stringify(questions[0]!.stem)).toContain('strong')
    expect(plainText(questions[0]!.explanation!)).toBe('Count on your fingers.')
  })
})
