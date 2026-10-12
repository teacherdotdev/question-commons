import { describe, expect, test } from 'bun:test'
import { plainText, readQuestionFile } from '../src'
import { fixture, readAt } from './helpers'

const encode = (text: string) => new TextEncoder().encode(text)
const read = async (name: string, bytes: Uint8Array) => {
  const reading = await readQuestionFile({ name, bytes }, { readAt })
  return { reading, questions: reading.banks.flatMap((bank) => bank.questions) }
}

describe('Respondus CSV', () => {
  test('reads each type, with right answers as a letter, a number, true or false, and a list', async () => {
    const { reading, questions } = await read('respondus.csv', fixture('respondus-csv/sample.csv'))
    expect(reading.format).toBe('respondus-csv')
    expect(questions.map((question) => question.type)).toEqual([
      'multiple-choice', 'true-false', 'multiple-answer', 'fill-in-the-blank', 'short-answer', 'multiple-choice', 'true-false',
    ])
    const [capital, sun, primes, water, essay, planets, moon] = questions
    expect(questions.map((question) => question.points)).toEqual([1, 1, 2, 1, 5, 1, 1])
    expect(capital?.type === 'multiple-choice' && capital.choices.map((choice) => [plainText(choice.content), choice.correct])).toEqual([
      ['London', false], ['Berlin', false], ['Paris', true], ['Madrid', false],
    ])
    expect(sun?.type === 'true-false' && sun.answer).toBe(true)
    expect(primes?.type === 'multiple-answer' && primes.choices.map((choice) => choice.correct)).toEqual([true, false, true, false])
    expect(plainText(water!.stem)).toBe('The chemical formula for water is _____.')
    expect(water?.type === 'fill-in-the-blank' && water.blanks).toEqual([{ accepted: ['H2O', 'H₂O'] }])
    expect(essay?.type === 'short-answer' && plainText(essay.suggestedAnswer!)).toBe('Rayleigh scattering of sunlight.')
    expect(plainText(planets!.stem)).toBe('Which planet is largest?')
    expect(moon?.type === 'true-false' && moon.answer).toBe(false)
    expect(reading.issues).toEqual([])
  })

  test('leaves out a row whose right answer names an empty choice', async () => {
    const { reading, questions } = await read('quiz.csv', encode('MC,,1,Pick one,D,Yes,No\nMC,,1,Pick another,A,Up,Down'))
    expect(questions).toHaveLength(1)
    expect(reading.issues).toEqual([expect.objectContaining({
      message: 'Question 1 (line 1): its correct answer “D” names choice 4, which is empty.',
    })])
  })

  test('keeps Points as written', async () => {
    const { questions } = await read('respondus.csv', encode('ES,Clouds,1.5,Describe a cloud.\nES,Rain,0,Describe rain.\nES,Snow,,Describe snow.\nES,Wind,3,Describe wind.'))
    expect(questions.map((question) => question.points)).toEqual([1.5, 0, undefined, 3])
  })
})

describe('Blackboard upload file (tab-delimited)', () => {
  const upload = [
    'MC\tWhat is 2 + 2?\t3\tincorrect\t4\tcorrect',
    'MA\tWhich are even?\t2\tcorrect\t3\tincorrect\t4\tcorrect',
    'TF\tThe sky is blue.\ttrue',
    'ESS\tDescribe the sea.\tIt is wide and salty.',
    'MAT\tMatch the pairs.\tcat\tmeow\tdog\twoof',
    'FIB\tThe opposite of hot is ____.\tcold',
    'FIB_PLUS\tA [noun] can [verb].\tverb\tfly\tsoar\t\tnoun\tbird',
    'NUM\tWhat is 7 x 6?\t42\t0.5',
    'ORD\tOrder these numbers.\t1\t2\t3',
    'EO\tYou like maths.\tyes/no',
    'FIL\tUpload your essay.',
    'OP\tHow do you feel?',
  ].join('\n')

  test('reads every Question Type the file carries, a Fill in Multiple Blanks putting each blank at its [name]', async () => {
    const { reading, questions } = await read('bb.txt', encode(upload))
    expect(reading.format).toBe('bb-tsv')
    expect(questions.map((question) => question.type)).toEqual([
      'multiple-choice', 'multiple-answer', 'true-false', 'short-answer', 'matching', 'fill-in-the-blank', 'fill-in-the-blank',
      'numeric', 'ordering',
    ])
    const [, , , , pairs, opposite, noun, number, order] = questions
    expect(pairs?.type === 'matching' && pairs.pairs.map((pair) => [plainText(pair.left!), plainText(pair.right!)])).toEqual([
      ['cat', 'meow'], ['dog', 'woof'],
    ])
    expect(plainText(opposite!.stem)).toBe('The opposite of hot is _____.')
    expect(plainText(noun!.stem)).toBe('A _____ can _____.')
    expect(noun?.type === 'fill-in-the-blank' && noun.blanks).toEqual([{ accepted: ['bird'] }, { accepted: ['fly', 'soar'] }])
    expect(number?.type === 'numeric' && number.answers).toEqual([{ value: '42', tolerance: '0.5' }])
    expect(order?.type === 'ordering' && order.items.map(plainText)).toEqual(['1', '2', '3'])
  })

  test('leaves out Either/Or and file response questions rather than turn them into short answers, and a survey question', async () => {
    const { reading } = await read('bb.txt', encode(upload))
    expect(reading.issues.map((issue) => [issue.line, issue.message])).toEqual([
      [10, 'Question 10 (line 10): Either/Or questions can’t be read, so it was left out.'],
      [11, 'Question 11 (line 11): file response questions can’t be read, so it was left out.'],
      [12, 'Question 12 (line 12): it is an opinion scale, a survey question with no answer, so it was left out.'],
    ])
  })

  test('is not mistaken for Respondus CSV or Quizlet', async () => {
    const { reading } = await read('bb.txt', encode('MC\tWhat is 2 + 2?\t3\tincorrect\t4\tcorrect\nTF\tThe sky is blue.\ttrue\n'))
    expect(reading.format).toBe('bb-tsv')
    const score = (format: string) => reading.candidates.find((candidate) => candidate.format === format)?.score ?? 0
    expect(score('respondus-csv')).toBeLessThan(0.5)
    expect(score('quizlet')).toBe(0)
  })
})
