import { describe, expect, test } from 'bun:test'
import { plainText, readQuestionFile } from '../src'
import { fixture, readAt } from './helpers'

const read = async (name: string, bytes: Uint8Array) => {
  const reading = await readQuestionFile({ name, bytes }, { readAt })
  return { reading, questions: reading.banks.flatMap((bank) => bank.questions) }
}

describe('Blackboard Test Generator text', () => {
  test('reads a tagged question', async () => {
    const { reading, questions } = await read('planets.txt', fixture('bb-generator/tagged-sample.txt'))
    expect(reading.format).toBe('bb-generator')
    expect(reading.issues).toEqual([])
    expect(questions).toEqual([
      expect.objectContaining({
        type: 'multiple-choice',
        choices: [
          { content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Venus' }] }], correct: false },
          { content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Earth' }] }], correct: false },
          { content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Mercury' }] }], correct: true },
          { content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Mars' }] }], correct: false },
        ],
      }),
    ])
  })

  test('reads numbered questions of every type it has, keeping several starred answers as Multiple Answer', async () => {
    const { reading, questions } = await read('numbered.txt', fixture('bb-generator/numbered-quiz.txt'))
    expect(reading.format).toBe('bb-generator')
    expect(reading.issues).toEqual([])
    expect(questions.map((question) => question.type)).toEqual([
      'multiple-answer', 'true-false', 'short-answer', 'fill-in-the-blank', 'matching', 'multiple-choice',
    ])
    const [primes, round, , ice, numbers] = questions
    expect(primes?.type === 'multiple-answer' && primes.choices.map((choice) => choice.correct)).toEqual([true, true, false, false])
    expect(round?.type === 'true-false' && round.answer).toBe(true)
    // The teacher's own underscores are where its one blank goes.
    expect(plainText(ice!.stem)).toBe('Ice melts at _____ degrees Celsius.')
    expect(JSON.stringify(ice!.stem)).toContain('"blank"')
    expect(ice?.type === 'fill-in-the-blank' && ice.blanks).toEqual([{ accepted: ['zero', '0'] }])
    expect(numbers?.type === 'matching' && numbers.pairs.map((pair) => [plainText(pair.left!), plainText(pair.right!)])).toEqual([
      ['1', 'one'], ['2', 'two'], ['3', 'three'],
    ])
    expect(questions.map((question) => question.provenance)).toEqual([
      { line: 1, number: 1 }, { line: 7, number: 2 }, { line: 10, number: 3 },
      { line: 12, number: 4 }, { line: 16, number: 5 }, { line: 21, number: 6 },
    ])
  })

  test('a question with no right answer is left out, named by its place in the whole file', async () => {
    const pasted = 'MC\nNo star here.\nyes\nno\n\nMA\nPick two.\n*one\n*two\nthree\n'
    const { reading, questions } = await read('pasted.txt', new TextEncoder().encode(pasted))
    expect(questions).toHaveLength(1)
    expect(reading.issues.map((issue) => [issue.code, issue.message.split(':')[0]])).toEqual([
      ['unreadable-question', 'Question 1 (line 1)'],
    ])
  })
})
