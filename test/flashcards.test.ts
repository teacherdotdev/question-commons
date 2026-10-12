import { describe, expect, test } from 'bun:test'
import { plainText, readQuestionFile, type Question } from '../src'
import { fixture, readAt } from './helpers'

const encode = (text: string) => new TextEncoder().encode(text)
const read = async (name: string, bytes: Uint8Array, format?: 'quizlet') => {
  const reading = await readQuestionFile({ name, bytes }, { readAt, format })
  return { reading, bank: reading.banks[0]!, questions: reading.banks.flatMap((bank) => bank.questions) }
}
const cards = (questions: Question[]) =>
  questions.map((question) => [plainText(question.stem), question.type === 'short-answer' ? plainText(question.suggestedAnswer!) : null])

describe('Quizlet export', () => {
  test('when chosen, reads the default export, each term asked with its definition as the suggested answer', async () => {
    const { reading, questions } = await read('biology.txt', fixture('flashcards/quizlet-tab.txt'), 'quizlet')
    expect(reading.format).toBe('quizlet')
    expect(cards(questions)).toEqual([
      ['photosynthesis', 'the process by which plants make food from light'],
      ['mitochondria', 'the powerhouse of the cell'],
      ['osmosis', 'diffusion of water through a membrane'],
      ['nucleus', 'the part of the cell that holds its DNA'],
    ])
    expect(reading.issues).toEqual([])
  })

  test('is never guessed: any two-column file looks like one (ADR-0006)', async () => {
    await expect(read('biology.txt', fixture('flashcards/quizlet-tab.txt'))).rejects.toThrow('No questions written in a format')
  })

  test('reads a comma between term and definition', async () => {
    const { questions } = await read('cards.txt', encode('cat,a small feline\ndog,a loyal canine\n'), 'quizlet')
    expect(cards(questions)).toEqual([['cat', 'a small feline'], ['dog', 'a loyal canine']])
  })

  test('leaves out a line that is not a card, saying which', async () => {
    const lines = Array.from({ length: 12 }, (_, index) => `term ${index}\tdefinition ${index}`)
    lines.splice(4, 0, 'a line with no definition')
    const { reading, questions } = await read('cards.txt', encode(lines.join('\n')), 'quizlet')
    expect(questions).toHaveLength(12)
    expect(reading.issues).toEqual([expect.objectContaining({
      message: 'Question 5 (line 5): it has no definition: a card is a term and a definition, separated by a tab or a comma.',
    })])
  })
})

describe('Anki export', () => {
  test('reads Anki’s export: the deck names the bank, HTML is kept, tags are topics, and a cloze is Fill in the Blank', async () => {
    const { reading, bank, questions } = await read('deck.txt', fixture('flashcards/anki-export.txt'))
    expect(reading.format).toBe('anki')
    expect(bank.name).toBe('Cells')
    expect(questions).toHaveLength(3)
    const [mitochondria, nucleus] = questions
    expect(plainText(mitochondria!.stem)).toBe('Mitochondria')
    expect(mitochondria?.type === 'short-answer' && mitochondria.suggestedAnswer![0]).toMatchObject({
      content: [{ text: 'The ' }, { text: 'powerhouse', marks: [{ type: 'strong' }] }, { text: ' of the cell' }],
    })
    expect(mitochondria!.topics).toEqual(['cells', 'energy'])
    expect(plainText(nucleus!.stem)).toBe('The _____ holds the cell\'s DNA.')
    expect(nucleus?.type === 'fill-in-the-blank' && nucleus.blanks).toEqual([{ accepted: ['nucleus'] }])
  })

  test('an Anki cloze note with several clozes is one Fill in the Blank question, its blanks in order', async () => {
    const { questions } = await read('deck.txt', encode('#separator:tab\n#html:false\nA {{c1::comet}} has a tail and an {{c2::asteroid}} does not.\t\n'))
    expect(questions).toHaveLength(1)
    expect(plainText(questions[0]!.stem)).toBe('A _____ has a tail and an _____ does not.')
    expect(questions[0]?.type === 'fill-in-the-blank' && questions[0].blanks).toEqual([{ accepted: ['comet'] }, { accepted: ['asteroid'] }])
  })
})
