import { describe, expect, test } from 'bun:test'
import { plainText, readQuestionFile, type Question } from '../src'
import { readAt } from './helpers'

const encode = (text: string) => new TextEncoder().encode(text)
const read = async (name: string, text: string) => readQuestionFile({ name, bytes: encode(text) }, { readAt })
const choices = (question: Question | undefined) =>
  question?.type === 'multiple-choice' ? question.choices.map((choice) => [plainText(choice.content), choice.correct]) : null

describe('Class Gauntlet spreadsheet', () => {
  test('reads Class Gauntlet’s export back as its sets, each a Question Bank with its subject and grade', async () => {
    const exported = '﻿' + [
      'set title,subject,grade,question,A,B,C,D,answer,explanation',
      'Fractions,Math,5,What is 1/2 + 1/4?,3/4,2/6,1/8,,A,Make the denominators match.',
      'Fractions,Math,5,Which is larger: 2/3 or 3/5?,2/3,3/5,,,A,',
      'Planets,Science,,Which planet is closest to the Sun?,Venus,Earth,Mercury,Mars,C,Mercury orbits closest.',
    ].join('\n') + '\n'
    const reading = await read('all question sets.csv', exported)
    expect(reading.format).toBe('class-gauntlet')
    expect(reading.issues).toEqual([])
    expect(reading.banks.map((bank) => [bank.name, bank.extras, bank.questions.length])).toEqual([
      ['Fractions', { subject: 'Math', grade: '5' }, 2],
      ['Planets', { subject: 'Science' }, 1],
    ])
    const [half, larger] = reading.banks[0]!.questions
    expect(choices(half)).toEqual([['3/4', true], ['2/6', false], ['1/8', false]])
    expect(plainText(half!.explanation!)).toBe('Make the denominators match.')
    expect(larger!.explanation).toBeUndefined()
    expect(choices(reading.banks[1]!.questions[0])).toEqual([['Venus', false], ['Earth', false], ['Mercury', true], ['Mars', false]])
    // Each question is numbered by its place in the whole file.
    expect(reading.banks.flatMap((bank) => bank.questions.map((question) => question.provenance))).toEqual([
      { line: 2, number: 1 }, { line: 3, number: 2 }, { line: 4, number: 3 },
    ])
  })

  test('reads a topics column, split on commas, and names banks by bank title', async () => {
    const reading = await read('banks.csv', [
      'bank title,subject,grade,question,A,B,C,D,answer,explanation,topics',
      'History,,,When did World War II end?,1945,1918,,,A,,"World War II, dates"',
      'History,,,Who was the first U.S. president?,Washington,Lincoln,,,A,,',
    ].join('\n'))
    expect(reading.banks.map((bank) => bank.name)).toEqual(['History'])
    expect(reading.banks[0]!.questions.map((question) => question.topics)).toEqual([['World War II', 'dates'], undefined])
  })

  test('reads the original project’s layout: choices as a list and a right answer counted from zero', async () => {
    const reading = await read('sets.csv', [
      'set title,subject,grade,question,choices,correct,explanation',
      'Grade 7 Math Review,Math,7,"−6 + 14 = ?","[""8"",""−8"",""20""]",0,Start at −6 and count up 14.',
      'Spelling,English,,Which is spelled right?,"[""recieve"",""receive""]",1,',
    ].join('\n'))
    expect(reading.format).toBe('class-gauntlet')
    expect(reading.banks.map((bank) => bank.name)).toEqual(['Grade 7 Math Review', 'Spelling'])
    expect(choices(reading.banks[0]!.questions[0])).toEqual([['8', true], ['−8', false], ['20', false]])
    expect(choices(reading.banks[1]!.questions[0])).toEqual([['recieve', false], ['receive', true]])
  })

  test('leaves out a row whose answer matches no choice', async () => {
    const reading = await read('sets.csv', [
      'set title,subject,grade,question,A,B,C,D,answer,explanation',
      'Quiz,,,What is 2 + 2?,3,4,,,E,',
      'Quiz,,,What is 3 + 3?,6,7,,,A,',
    ].join('\n'))
    expect(reading.banks[0]!.questions).toHaveLength(1)
    expect(reading.issues.map((issue) => [issue.line, issue.message])).toEqual([
      [2, 'Question 1 (line 2): its answer “E” is not one of its choices. Use a letter like B.'],
    ])
  })
})

describe('Class Gauntlet’s template', () => {
  test('with no set title is one bank, named after the file, each explanation kept', async () => {
    const reading = await read('Times tables.csv', [
      'question,A,B,C,D,answer,explanation',
      'What is 7 × 8?,54,56,64,,B,Seven eights are fifty-six.',
      'A synonym for “happy” is…,joyful,angry,tired,,A,',
    ].join('\n'))
    expect(reading.format).toBe('class-gauntlet')
    expect(reading.banks.map((bank) => [bank.name, bank.extras])).toEqual([['Times tables', undefined]])
    const [product, synonym] = reading.banks[0]!.questions
    expect(choices(product)).toEqual([['54', false], ['56', true], ['64', false]])
    expect(plainText(product!.explanation!)).toBe('Seven eights are fifty-six.')
    expect(synonym!.explanation).toBeUndefined()
  })

  test('pasted from a spreadsheet as tab-separated cells, the answer written out as its text', async () => {
    const reading = await read('Pasted questions.txt', 'Question\tA\tB\tC\tAnswer\nCapital of France?\tParis\tRome\tOslo\tparis\n')
    expect(reading.format).toBe('class-gauntlet')
    expect(choices(reading.banks[0]!.questions[0])).toEqual([['Paris', true], ['Rome', false], ['Oslo', false]])
  })
})
