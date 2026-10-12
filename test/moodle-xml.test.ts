import { describe, expect, test } from 'bun:test'
import { plainText, readQuestionFile } from '../src'
import { fixture, readAt } from './helpers'

const encode = (text: string) => new TextEncoder().encode(text)
const quiz = (questions: string) => encode(`<?xml version="1.0" encoding="UTF-8"?>\n<quiz>\n${questions}\n</quiz>`)
const read = async (name: string, bytes: Uint8Array) => {
  const reading = await readQuestionFile({ name, bytes }, { readAt })
  return { reading, questions: reading.banks.flatMap((bank) => bank.questions) }
}

describe('Moodle XML', () => {
  test('reads an export with every core type, its categories, tags and the picture it carries', async () => {
    const { reading, questions } = await read('questions.xml', fixture('moodle-xml/every-type.xml'))
    expect(reading.format).toBe('moodle-xml')
    expect(questions.map((question) => question.type)).toEqual([
      'multiple-choice', 'multiple-answer', 'true-false', 'fill-in-the-blank', 'matching', 'short-answer', 'numeric', 'ordering',
    ])
    const [cell, primes, sun, capital, matching, essay, pi, ordering] = questions
    expect(questions.map((question) => question.points)).toEqual([1, 1, 1, undefined, undefined, undefined, undefined, undefined])
    expect(plainText(cell!.stem)).toBe('Which organelle makes ATP?')
    expect(cell?.type === 'multiple-choice' && cell.choices.map((choice) => [plainText(choice.content), choice.correct])).toEqual([
      ['Nucleus', false], ['Mitochondrion', true], ['Ribosome', false],
    ])
    expect(cell!.topics).toEqual(['Chapter 1', 'energy'])

    // The picture comes as the file carried it, named from the stem.
    const keys = Object.keys(reading.pictures)
    expect(keys).toHaveLength(1)
    expect(reading.pictures[keys[0]!]!.mimeType).toBe('image/png')
    expect(JSON.stringify(cell!.stem)).toContain(`"asset":"${keys[0]}"`)

    expect(primes?.type === 'multiple-answer' && primes.choices.map((choice) => choice.correct)).toEqual([true, true, false])
    expect(sun?.type === 'true-false' && sun.answer).toBe(false)
    expect(capital?.type === 'fill-in-the-blank' && capital.blanks).toEqual([{ accepted: ['Paris', 'paris, France'] }])
    expect(matching?.type === 'matching' && matching.pairs.map((pair) => [pair.left && plainText(pair.left), plainText(pair.right!)])).toEqual([
      ['Canada', 'Ottawa'], ['Italy', 'Rome'], [null, 'Sydney'],
    ])
    expect(essay?.type === 'short-answer' && plainText(essay.suggestedAnswer!)).toBe('Light energy becomes chemical energy.')
    expect(essay!.topics).toEqual(['Chapter 2'])
    expect(pi?.type === 'numeric' && pi.answers).toEqual([{ value: '3.14', tolerance: '0.01' }])
    expect(ordering?.type === 'ordering' && ordering.items.map(plainText)).toEqual(['Mercury', 'Venus', 'Earth'])

    // A cloze whose blank is a number would need the number turned into text, so it is left out.
    expect(reading.issues.map((issue) => [issue.code, issue.line])).toEqual([
      ['numeric-blank', 202],
      ['description-skipped', 212],
      ['unsupported-type', 222],
    ])
  })

  test('reads a Moodle 1.9 picture, and leaves out a question whose picture is only a web address', async () => {
    const { reading, questions } = await read('old.xml', fixture('moodle-xml/legacy-image.xml'))
    expect(questions).toHaveLength(1)
    expect(Object.keys(reading.pictures)).toHaveLength(1)
    expect(reading.issues.map((issue) => issue.code)).toEqual(['picture-missing'])
  })

  test('its general feedback is the explanation, and the answer worth most is right when none is worth 100', async () => {
    const { questions } = await read('q.xml', quiz(`
      <question type="multichoice">
        <questiontext format="plain_text"><text>Pick the best.</text></questiontext>
        <generalfeedback format="plain_text"><text>Best beats good.</text></generalfeedback>
        <single>true</single>
        <answer fraction="50"><text>Good</text></answer>
        <answer fraction="90"><text>Best</text></answer>
        <answer fraction="0"><text>Bad</text></answer>
      </question>`))
    expect(questions[0]?.type === 'multiple-choice' && questions[0].choices.map((choice) => choice.correct)).toEqual([false, true, false])
    expect(plainText(questions[0]!.explanation!)).toBe('Best beats good.')
  })

  test('a text without HTML markup keeps its angle brackets when it says it is plain text', async () => {
    const { questions } = await read('q.xml', quiz(`
      <question type="essay"><questiontext format="plain_text"><text>Is 3 &lt;b&gt; 2?</text></questiontext></question>`))
    expect(plainText(questions[0]!.stem)).toBe('Is 3 <b> 2?')
  })

  test('keeps <defaultgrade> as written, a Matching set’s for the set', async () => {
    const { questions } = await read('q.xml', quiz(`
      <question type="essay"><questiontext format="html"><text>Describe the water cycle.</text></questiontext><defaultgrade>4.0000000</defaultgrade></question>
      <question type="essay"><questiontext format="html"><text>Describe a cloud.</text></questiontext><defaultgrade>0.5000000</defaultgrade></question>
      <question type="matching">
        <questiontext format="html"><text>Match each animal to its home.</text></questiontext>
        <defaultgrade>3</defaultgrade>
        <subquestion format="html"><text>Bee</text><answer><text>Hive</text></answer></subquestion>
        <subquestion format="html"><text>Fox</text><answer><text>Den</text></answer></subquestion>
      </question>`))
    expect(questions.map((question) => [question.type, question.points])).toEqual([['short-answer', 4], ['short-answer', 0.5], ['matching', 3]])
  })

  test('a file that is not well formed is not read as Moodle XML', async () => {
    await expect(read('bad.xml', encode('<quiz><question type="essay">'))).rejects.toThrow()
  })
})
