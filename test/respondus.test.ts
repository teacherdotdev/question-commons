import { describe, expect, test } from 'bun:test'
import { plainText, readQuestionFile } from '../src'
import { fixture, readAt } from './helpers'

const encode = (text: string) => new TextEncoder().encode(text)
const read = async (name: string, bytes: Uint8Array) => {
  const reading = await readQuestionFile({ name, bytes }, { readAt })
  return { reading, questions: reading.banks.flatMap((bank) => bank.questions) }
}

describe('Respondus Standard Format', () => {
  test('reads every Question Type its Type: lines give, with starred answers marking the right ones', async () => {
    const { reading, questions } = await read('light.txt', fixture('respondus/starred.txt'))
    expect(reading.format).toBe('respondus')
    expect(questions.map((question) => question.type)).toEqual([
      'multiple-choice', 'true-false', 'short-answer', 'fill-in-the-blank', 'matching', 'ordering', 'multiple-answer', 'fill-in-the-blank',
    ])
    const [prism, sound, sky, optics, scientists, rainbow, primary, light] = questions
    expect(questions.every((question) => question.points === 2)).toBe(true)
    expect(prism?.type === 'multiple-choice' && prism.choices.map((choice) => choice.correct)).toEqual([false, true, false])
    expect(sound?.type === 'true-false' && sound.answer).toBe(true)
    expect(sky?.type === 'short-answer' && plainText(sky.suggestedAnswer!)).toBe('Shorter wavelengths of sunlight scatter more in the air.')
    expect(optics?.type === 'fill-in-the-blank' && optics.blanks).toEqual([{ accepted: ['optics', 'Optics'] }])
    expect(scientists?.type === 'matching' && scientists.pairs.map((pair) => [plainText(pair.left!), plainText(pair.right!)])).toEqual([
      ['Newton', 'gravity'], ['Curie', 'radioactivity'],
    ])
    expect(rainbow?.type === 'ordering' && rainbow.items.map(plainText)).toEqual(['Red', 'Orange', 'Yellow'])
    expect(primary?.type === 'multiple-answer' && primary.choices.map((choice) => choice.correct)).toEqual([true, false, true])
    expect(plainText(light!.stem)).toBe('Light is a _____ wave and travels at about 300,000 _____ per second.')
    expect(light?.type === 'fill-in-the-blank' && light.blanks).toEqual([{ accepted: ['electromagnetic'] }, { accepted: ['km', 'kilometres'] }])

    // A type it cannot read, and a picture kept in a folder beside the file, are left out.
    expect(reading.issues.map((issue) => [issue.code, issue.line])).toEqual([
      ['unsupported-type', 42],
      ['picture-left-out', 45],
    ])
  })

  test('takes right answers from the Answers: list at the end, and leaves out a question it gives none for', async () => {
    const { reading, questions } = await read('key.txt', fixture('respondus/answer-key.txt'))
    expect(reading.format).toBe('respondus')
    expect(questions.map((question) => question.type)).toEqual(['multiple-choice', 'true-false'])
    const [prism, sound] = questions
    expect(prism?.type === 'multiple-choice' && prism.choices.map((choice) => choice.correct)).toEqual([false, true, false])
    expect(sound?.type === 'true-false' && sound.answer).toBe(true)
    expect(reading.issues.map((issue) => [issue.code, issue.line])).toEqual([['no-correct-answer', 10]])
  })

  test('a plain numbered file with no Respondus markers is left to the Blackboard Test Generator', async () => {
    const { reading } = await read('plain.txt', encode('1. What is 2 + 3?\na) 4\n*b) 5\n\n2. What is 2 + 2?\n*a) 4\nb) 5\n'))
    expect(reading.format).toBe('bb-generator')
  })

  test('one Respondus marker, a Points: line, is enough to read it as Respondus', async () => {
    const { reading, questions } = await read('points.txt', encode('Points: 2\n1. What is 2 + 3?\na) 4\n*b) 5\n2. What is 2 + 2?\n*a) 4\nb) 5\n'))
    expect(reading.format).toBe('respondus')
    expect(questions).toHaveLength(2)
    expect(reading.issues).toEqual([])
  })
})
