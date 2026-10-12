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
})
