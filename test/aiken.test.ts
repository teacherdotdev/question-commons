import { describe, expect, test } from 'bun:test'
import { plainText, readQuestionFile } from '../src'
import { fixture, readAt } from './helpers'

describe('Aiken', () => {
  test('reads each question into one Question Bank named after the file, with where it came from', async () => {
    const reading = await readQuestionFile({ name: 'Unit 3 planets.txt', bytes: fixture('aiken/planets.txt') }, { readAt })

    expect(reading.format).toBe('aiken')
    expect(reading.issues).toEqual([])
    expect(reading.banks).toHaveLength(1)
    const bank = reading.banks[0]!
    expect(bank.format).toBe('teacherdotdev/question-bank')
    expect(bank.version).toBe('1.0.0')
    expect(bank.name).toBe('Unit 3 planets')
    expect(bank.provenance).toMatchObject({ format: 'aiken', formatLabel: 'Aiken', fileName: 'Unit 3 planets.txt', readAt })

    expect(bank.questions.map((question) => [question.type, plainText(question.stem)])).toEqual([
      ['multiple-choice', 'Which planet is closest to the Sun?'],
      ['multiple-choice', 'How many moons does Mars have?'],
    ])
    const [first, second] = bank.questions
    if (first?.type !== 'multiple-choice' || second?.type !== 'multiple-choice') throw new Error('not multiple choice')
    expect(first.choices.map((choice) => [plainText(choice.content), choice.correct])).toEqual([
      ['Venus', false], ['Mercury', true], ['Earth', false], ['Mars', false],
    ])
    expect(second.choices.map((choice) => choice.correct)).toEqual([false, false, true])
    expect(bank.questions.map((question) => question.provenance)).toEqual([
      { line: 1, number: 1 },
      { line: 8, number: 2 },
    ])
  })

  test('leaves out a question it cannot read, and does not report one it read exactly despite loose writing', async () => {
    const reading = await readQuestionFile({ name: 'lenient.txt', bytes: fixture('aiken/lenient.txt') }, { readAt })

    expect(reading.format).toBe('aiken')
    const questions = reading.banks[0]!.questions
    expect(questions.map((question) => plainText(question.stem))).toEqual(['Which planet is known as\nthe red planet?', 'What is 2 + 2?'])
    expect(questions.map((question) => question.provenance.number)).toEqual([1, 2])
    expect(reading.issues).toEqual([
      {
        code: 'unreadable-question',
        message: 'Question 3 (line 12): it has no ANSWER line. Put “ANSWER: ” and the correct letter on the line after its answers.',
        line: 12,
        excerpt: 'Which gas do plants absorb? A. Oxygen B. Carbon dioxide',
      },
      {
        code: 'unreadable-question',
        message: 'Question 4 (line 16): its ANSWER is E, but it has no answer E.',
        line: 16,
        excerpt: 'What is the largest ocean? A. Atlantic B. Pacific ANSWER: E',
      },
    ])
  })
})
