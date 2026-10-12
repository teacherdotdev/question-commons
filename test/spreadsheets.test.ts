import { describe, expect, test } from 'bun:test'
import { plainText, readQuestionFile, type Question } from '../src'
import { fixture, readAt } from './helpers'
import { xlsx } from './test-xlsx'

const encode = (text: string) => new TextEncoder().encode(text)
const read = async (name: string, bytes: Uint8Array) => {
  const reading = await readQuestionFile({ name, bytes }, { readAt })
  return { reading, questions: reading.banks.flatMap((bank) => bank.questions) }
}
const choices = (question: Question | undefined) =>
  question?.type === 'multiple-choice' || question?.type === 'multiple-answer'
    ? question.choices.map((choice) => [plainText(choice.content), choice.correct])
    : null

describe('Spreadsheet of questions', () => {
  test('reads a teacher’s table by its headers, whatever form the right answer takes', async () => {
    const { reading, questions } = await read('questions.csv', fixture('spreadsheet/questions.csv'))
    expect(reading.format).toBe('spreadsheet')
    expect(questions.map((question) => question.type)).toEqual([
      'multiple-choice', 'multiple-answer', 'true-false', 'fill-in-the-blank', 'multiple-choice',
    ])
    const [sum, even, water, ocean, gas] = questions
    expect(choices(sum)).toEqual([['3', false], ['4', true], ['5', false], ['6', false]])
    expect(sum!.topics).toEqual(['Arithmetic'])
    expect(even?.type === 'multiple-answer' && even.choices.map((choice) => choice.correct)).toEqual([true, false, true, false])
    expect(water?.type === 'true-false' && water.answer).toBe(true)
    expect(ocean?.type === 'fill-in-the-blank' && ocean.blanks).toEqual([{ accepted: ['Pacific'] }])
    expect(gas?.type === 'multiple-choice' && gas.choices.map((choice) => choice.correct)).toEqual([false, true, false])
    expect(reading.issues).toEqual([expect.objectContaining({
      message: 'Question 6 (line 7): its correct answer “3” is not one of its options, their letter or their number.',
    })])
  })

  test('reads an .xlsx whose options are the wrong answers, the right one apart', async () => {
    const bytes = await xlsx({
      rows: [
        ['My chemistry quiz'],
        ['Prompt', 'Correct Answer', 'Incorrect Answer 1', 'Incorrect Answer 2', 'Tags'],
        ['Symbol for gold?', 'Au', 'Ag', 'Gd', 'chemistry; elements'],
        ['Number of protons in carbon?', 6, 12, 8, 'chemistry'],
      ],
    })
    const { reading, questions } = await read('chem.xlsx', bytes)
    expect(reading.format).toBe('spreadsheet')
    expect(choices(questions[0])).toEqual([['Au', true], ['Ag', false], ['Gd', false]])
    expect(questions[0]!.topics).toEqual(['chemistry', 'elements'])
    expect(choices(questions[1])).toEqual([['6', true], ['12', false], ['8', false]])
  })

  test('reads a type column and numbered options, and leaves out a type it cannot read from a spreadsheet', async () => {
    const { reading, questions } = await read('quiz.csv', encode([
      'Question Text,Question Type,Choice 1,Choice 2,Choice 3,Answer',
      'Describe the water cycle.,Essay,,,,Evaporation then condensation then rain',
      'Pick the mammal.,MC,Shark,Whale,Trout,2',
      'Is ice cold?,T/F,,,,T',
      'Match these.,Matching,,,,',
    ].join('\n')))
    expect(questions.map((question) => question.type)).toEqual(['short-answer', 'multiple-choice', 'true-false'])
    expect(questions[0]?.type === 'short-answer' && plainText(questions[0].suggestedAnswer!)).toBe('Evaporation then condensation then rain')
    expect(reading.issues).toEqual([expect.objectContaining({
      message: 'Question 4 (line 5): “Matching” questions can’t be read from a spreadsheet, so it was left out.',
    })])
  })

  test('a table with no question column is not a spreadsheet of questions', async () => {
    await expect(read('grades.csv', encode('Name,Score,Grade\nAda,98,A\nBob,71,C\n'))).rejects.toThrow('No questions written in a format')
  })

  test('keeps a Points or Marks column as written', async () => {
    const { questions } = await read('quiz.csv', encode([
      'Question,Option A,Option B,Answer,Marks',
      'Pick the mammal.,Shark,Whale,B,2',
      'Pick the bird.,Robin,Trout,A,0.5',
      'Pick the fish.,Trout,Robin,A,',
    ].join('\n')))
    expect(questions.map((question) => question.points)).toEqual([2, 0.5, undefined])
  })
})

/** Kahoot's template: a title and instructions, then the header on row 8. */
const kahootTemplate = (rows: (string | number | null)[][]) =>
  xlsx({
    name: 'Sheet1',
    rows: [
      [null, 'Quiz template'],
      { row: 2, cells: [null, 'Add questions, at least two answer alternatives, time limit and choose correct answers (at least one).'] },
      {
        row: 8,
        cells: [
          null,
          'Question - max 120 characters',
          'Answer 1 - max 75 characters',
          'Answer 2 - max 75 characters',
          'Answer 3 - max 75 characters',
          'Answer 4 - max 75 characters',
          'Time limit (sec) – 5, 10, 20, 30, 60, 90, 120, or 240 secs',
          'Correct answer(s) - choose at least one',
        ],
      },
      ...rows.map((cells, index) => ({ row: 9 + index, cells })),
    ],
  })

describe('Kahoot spreadsheet', () => {
  test('reads Kahoot’s template: numbered right answers, one or several', async () => {
    const bytes = await kahootTemplate([
      [1, 'What is the capital of France?', 'London', 'Paris', 'Rome', 'Berlin', 20, 2],
      [2, 'Which are prime?', '2', '4', '5', null, 30, '1,3'],
      [3, 'The earth is flat.', 'True', 'False', null, null, 10, 2],
      [4, 'Only one answer?', 'Yes', null, null, null, 20, 1],
      [5, null, null, null, null, null, null, null],
    ])
    const { reading, questions } = await read('kahoot.xlsx', bytes)
    expect(reading.format).toBe('kahoot')
    expect(questions.map((question) => question.type)).toEqual(['multiple-choice', 'multiple-answer', 'true-false'])
    const [capital, prime, flat] = questions
    expect(plainText(capital!.stem)).toBe('What is the capital of France?')
    expect(choices(capital)).toEqual([['London', false], ['Paris', true], ['Rome', false], ['Berlin', false]])
    expect(choices(prime)).toEqual([['2', true], ['4', false], ['5', true]])
    expect(flat?.type === 'true-false' && flat.answer).toBe(false)
    expect(reading.issues).toEqual([expect.objectContaining({
      message: 'Question 4 (line 12): Kahoot questions need at least two answers, and this one has one.',
    })])
  })

  test('reads the same columns saved as a CSV', async () => {
    const { reading, questions } = await read('kahoot.csv', encode([
      'Kahoot quiz,,,,,,',
      'Question,Answer 1,Answer 2,Answer 3,Answer 4,Time limit,Correct answer(s)',
      'Largest planet?,Mars,Jupiter,,,20,2',
    ].join('\n')))
    expect(reading.format).toBe('kahoot')
    expect(choices(questions[0])).toEqual([['Mars', false], ['Jupiter', true]])
  })
})

const blooketTemplate = [
  '"Blooket\nImport Template",,,,,,,',
  'Question #,Question Text,Answer 1,Answer 2,"Answer 3\n(Optional)","Answer 4\n(Optional)","Time Limit (sec)\n(Max: 300 seconds)","Correct Answer(s)\n(Only include Answer #)"',
  '1,What is 2 + 2?,3,4,5,,20,2',
  '2,Pick a prime,4,6,7,9,20,"3,4"',
  '3,,,,,,20,',
].join('\n')

describe('Blooket spreadsheet', () => {
  test('reads Blooket’s template: the question text, not its number, with one or several right answers', async () => {
    const { reading, questions } = await read('Fractions.csv', encode(blooketTemplate))
    expect(reading.format).toBe('blooket')
    expect(reading.banks[0]!.name).toBe('Fractions')
    expect(reading.banks[0]!.provenance.formatLabel).toBe('Blooket spreadsheet')
    expect(questions.map((question) => [question.type, plainText(question.stem)])).toEqual([
      ['multiple-choice', 'What is 2 + 2?'],
      ['multiple-answer', 'Pick a prime'],
    ])
    expect(choices(questions[0])).toEqual([['3', false], ['4', true], ['5', false]])
    expect(choices(questions[1])).toEqual([['4', false], ['6', false], ['7', true], ['9', true]])
    // The template's numbered but empty rows are not questions.
    expect(reading.issues).toEqual([])
  })

  test('is not mistaken for Kahoot, whose template also numbers its rows', async () => {
    const { reading } = await read('blooket.csv', encode(blooketTemplate))
    expect(reading.candidates[0]!.format).toBe('blooket')
    expect(reading.candidates.find((candidate) => candidate.format === 'kahoot')?.score ?? 0).toBeLessThan(0.5)
  })
})
