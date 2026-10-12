import { describe, expect, test } from 'bun:test'
import JSZip from 'jszip'
import { plainText, readQuestionFile, type Question } from '../src'
import { fixture, readAt } from './helpers'

const encode = (text: string) => new TextEncoder().encode(text)
const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
  (character) => character.charCodeAt(0),
)
const read = async (name: string, bytes: Uint8Array) => {
  const reading = await readQuestionFile({ name, bytes }, { readAt })
  return { reading, bank: reading.banks[0]!, questions: reading.banks.flatMap((bank) => bank.questions) }
}
async function zip(files: Record<string, Uint8Array | string>) {
  const archive = new JSZip()
  for (const [path, content] of Object.entries(files)) archive.file(path, content)
  return archive.generateAsync({ type: 'uint8array' })
}
const manifest = (resources: string) => `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="man00001" xmlns:bb="http://www.blackboard.com/content-packaging/">
  <organizations default="toc00001"><organization identifier="toc00001"/></organizations>
  <resources>${resources}</resources>
</manifest>`
const choices = (question: Question | undefined) =>
  question?.type === 'multiple-choice' || question?.type === 'multiple-answer'
    ? question.choices.map((choice) => [plainText(choice.content), choice.correct])
    : null

describe('Blackboard 5 pool, as the Blackboard Test Generator downloads one', () => {
  test('reads every question type in it, on its own or in a package under any name', async () => {
    const dat = fixture('bb-package/bb5-pool.dat')
    for (const { name, bytes } of [
      { name: 'res00001.dat', bytes: dat },
      {
        name: 'pool.zip',
        bytes: await zip({
          'imsmanifest.xml': manifest('<resource bb:file="chapter-two.dat" bb:title="Chapter 2" identifier="res00007" type="assessment/x-bb-pool" xml:base="res00007"/>'),
          'chapter-two.dat': dat,
        }),
      },
    ]) {
      const { reading, bank, questions } = await read(name, bytes)
      expect(reading.format).toBe(name.endsWith('.dat') ? 'bb-xml' : 'bb-package')
      expect(bank.name).toBe('Number facts')
      expect(bank.description).toBe('Small number questions.')
      expect(questions.map((question) => question.type)).toEqual([
        'multiple-answer', 'multiple-choice', 'true-false', 'short-answer', 'fill-in-the-blank', 'matching', 'ordering',
      ])
      const [even, sum, prime, essay, four, words, order] = questions
      expect(choices(even)).toEqual([['2', true], ['3', false], ['4', true]])
      expect(choices(sum)).toEqual([['4', false], ['5', true], ['6', false]])
      expect(prime?.type === 'true-false' && prime.answer).toBe(true)
      expect(essay?.type === 'short-answer' && plainText(essay.suggestedAnswer!)).toBe('It has exactly two factors.')
      expect(plainText(four!.stem)).toBe('Two plus two equals _____.')
      expect(four?.type === 'fill-in-the-blank' && four.blanks).toEqual([{ accepted: ['four', '4'] }])
      expect(words?.type === 'matching' && words.pairs.map((pair) => [pair.left && plainText(pair.left), plainText(pair.right!)])).toEqual([
        ['1', 'one'], ['3', 'three'], [null, 'seven'],
      ])
      expect(order?.type === 'ordering' && order.items.map(plainText)).toEqual(['1', '5', '10'])
      expect(reading.issues.map((issue) => [issue.code, issue.message])).toEqual([
        ['unsupported-type', 'Question 8: “hotspot” questions can’t be read, so it was left out.'],
      ])
    }
  })
})

describe('Blackboard QTI pool and test export', () => {
  const pool = () => fixture('bb-package/qti-pool.dat')
  const exportZip = () => zip({
    'imsmanifest.xml': manifest('<resource bb:file="res00001.dat" bb:title="Astronomy basics" identifier="res00001" type="assessment/x-bb-qti-pool" xml:base="res00001"/>'),
    '.bb-package-info': 'cx.package.info.version=6.0\n',
    'res00001.dat': pool(),
    'csfiles/home_dir/Pictures__xid-4060800_1/mars__xid-4060915_1.png': PNG,
  })

  test('reads every question type Blackboard exports, with the picture from its csfiles', async () => {
    const { reading, bank, questions } = await read('ExportFile_ASTRO101.zip', await exportZip())
    expect(reading.format).toBe('bb-package')
    expect(bank.name).toBe('Astronomy basics')
    expect(questions.map((question) => question.type)).toEqual([
      'multiple-choice', 'multiple-answer', 'true-false', 'short-answer', 'matching',
      'fill-in-the-blank', 'numeric', 'ordering', 'fill-in-the-blank',
    ])
    const [planet, primes, , essay, , water, pi, order, roses] = questions
    expect(questions.map((question) => question.points)).toEqual(questions.map(() => 10))
    expect(choices(planet)).toEqual([['Venus', false], ['Mars', true], ['Jupiter', false]])
    const picture = planet!.stem.find((node) => node.type === 'block-image')
    expect(picture?.alt).toBe('A red planet')
    expect(Object.keys(reading.pictures)).toEqual([picture!.asset!])
    expect(choices(primes)?.map(([, correct]) => correct)).toEqual([true, false, true, false])
    expect(essay?.type === 'short-answer' && plainText(essay.suggestedAnswer!)).toBe('The tilt of its axis.')
    expect(plainText(water!.stem)).toBe('Water is made of hydrogen and _____.')
    expect(water?.type === 'fill-in-the-blank' && water.blanks).toEqual([{ accepted: ['oxygen', 'O'] }])
    expect(pi?.type === 'numeric' && pi.answers).toEqual([{ value: '3.14', tolerance: '0.01' }])
    expect(order?.type === 'ordering' && order.items.map(plainText)).toEqual(['Mercury', 'Earth', 'Mars'])
    expect(plainText(roses!.stem)).toBe('Roses are _____ and violets are _____.')
    expect(roses?.type === 'fill-in-the-blank' && roses.blanks).toEqual([{ accepted: ['red', 'crimson'] }, { accepted: ['blue'] }])
    expect(reading.issues.map((issue) => issue.message)).toEqual([
      'Question 10: “Hot Spot” questions can’t be read, so it was left out.',
    ])
  })

  test('a Random Block brings in its pool’s questions once, and the picture missing from this export leaves its question out', async () => {
    const midterm = `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop>
  <assessment title="Midterm">
    <assessmentmetadata><bbmd_assessmenttype>Test</bbmd_assessmenttype></assessmentmetadata>
    <section>
      <sectionmetadata><bbmd_sectiontype>Subsection</bbmd_sectiontype></sectionmetadata>
      <section title="Random Block">
        <sectionmetadata><bbmd_sectiontype>Random Block</bbmd_sectiontype></sectionmetadata>
        <selection_ordering>
          <selection><sourcebank_ref>res00001</sourcebank_ref><selection_number>3</selection_number></selection>
        </selection_ordering>
      </section>
    </section>
  </assessment>
</questestinterop>`
    const { reading, bank, questions } = await read('midterm.zip', await zip({
      'imsmanifest.xml': manifest(
        '<resource bb:file="res00002.dat" bb:title="Midterm" identifier="res00002" type="assessment/x-bb-qti-test" xml:base="res00002"/>' +
        '<resource bb:file="res00001.dat" bb:title="Astronomy basics" identifier="res00001" type="assessment/x-bb-qti-pool" xml:base="res00001"/>',
      ),
      'res00002.dat': midterm,
      'res00001.dat': pool(),
    }))
    expect(reading.format).toBe('bb-package')
    expect(bank.name).toBe('midterm')
    expect(questions).toHaveLength(8)
    expect(new Set(questions.map((question) => plainText(question.stem))).size).toBe(8)
    expect(questions[0]!.topics).toEqual(['Astronomy basics'])
    expect(reading.issues.find((issue) => issue.code === 'picture-missing')?.message).toStartWith('Question 1:')
  })

  test('a Blackboard export and a bare pool .dat go to Blackboard’s reader, not QTI’s', async () => {
    const { reading } = await read('export.zip', await exportZip())
    expect(reading.candidates[0]!.format).toBe('bb-package')
    expect(reading.candidates.find((candidate) => candidate.format === 'qti-package')?.score ?? 0).toBeLessThan(0.3)
    const dat = await read('res00001.dat', pool())
    expect(dat.reading.format).toBe('bb-xml')
  })
})

describe('Blackboard files that try something', () => {
  test('an external entity is never expanded, and a script or event handler does not survive', async () => {
    const dat = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE POOL [ <!ENTITY secret SYSTEM "file:///etc/passwd"> ]>
<POOL>
  <TITLE value="Hostile" />
  <QUESTIONLIST><QUESTION id="q1" class="QUESTION_ESSAY" /></QUESTIONLIST>
  <QUESTION_ESSAY id="q1"><BODY><TEXT>&lt;p&gt;Tell me &amp;secret; please.&lt;script&gt;alert(1)&lt;/script&gt;&lt;a href="javascript:alert(3)"&gt;here&lt;/a&gt;&lt;/p&gt;</TEXT></BODY></QUESTION_ESSAY>
</POOL>`
    const { questions } = await read('hostile.dat', encode(dat))
    const json = JSON.stringify(questions)
    expect(plainText(questions[0]!.stem)).toBe('Tell me &secret; please.here')
    expect(json).not.toContain('root:')
    expect(json).not.toContain('alert')
    expect(json).not.toContain('javascript')
  })

  test('a .dat that is not well-formed is reported rather than failing quietly', async () => {
    const archive = await zip({
      'imsmanifest.xml': manifest('<resource bb:file="res00001.dat" identifier="res00001" type="assessment/x-bb-qti-pool"/>'),
      'res00001.dat': '<questestinterop><assessment title="Broken"><section><item>',
    })
    await expect(readQuestionFile({ name: 'broken.zip', bytes: archive }, { format: 'bb-package' })).rejects.toThrow(/not well-formed/)
  })
})
