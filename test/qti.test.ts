import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'
import { plainText, readQuestionFile, type Question } from '../src'
import { readAt } from './helpers'

const fixtures = fileURLToPath(new URL('./fixtures/qti/', import.meta.url))
const fixture = (path: string) => new Uint8Array(readFileSync(join(fixtures, path)))
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

/** A fixture folder zipped, the way Canvas downloads it. */
function folder(path: string) {
  const files: Record<string, Uint8Array> = {}
  const walk = (at: string) => {
    for (const name of readdirSync(join(fixtures, path, at))) {
      const relative = at ? `${at}/${name}` : name
      if (statSync(join(fixtures, path, relative)).isDirectory()) walk(relative)
      else files[relative] = fixture(`${path}/${relative}`)
    }
  }
  walk('')
  return zip(files)
}

const choices = (question: Question | undefined) =>
  question?.type === 'multiple-choice' || question?.type === 'multiple-answer'
    ? question.choices.map((choice) => [plainText(choice.content), choice.correct])
    : null

describe('Canvas classic quiz export', () => {
  test('reads every question type once, with the picture the package carries', async () => {
    const { reading, bank, questions } = await read('unit-1-science-quiz-export.zip', await folder('canvas-export'))
    expect(reading.format).toBe('qti')
    expect(bank.name).toBe('Unit 1 Science Quiz')
    expect(questions.map((question) => question.type)).toEqual([
      'multiple-choice', 'true-false', 'fill-in-the-blank', 'fill-in-the-blank', 'multiple-answer', 'fill-in-the-blank',
      'matching', 'numeric', 'short-answer',
    ])
    const [choice, trueFalse, shortAnswer, roses, mammals, boils, matching, gravity, essay] = questions
    expect(questions.map((question) => question.points)).toEqual(questions.map(() => 1))

    expect(plainText(choice!.stem)).toBe('Which gas do plants take in?')
    expect(choices(choice)).toEqual([['Oxygen', false], ['Carbon dioxide', true], ['Helium', false]])
    const picture = choice!.stem.find((node) => node.type === 'block-image')
    expect(Object.keys(reading.pictures)).toEqual([picture!.asset!])
    expect(reading.pictures[picture!.asset!]!.mimeType).toBe('image/png')

    expect(trueFalse?.type === 'true-false' && trueFalse.answer).toBe(false)
    expect(shortAnswer?.type === 'fill-in-the-blank' && shortAnswer.blanks).toEqual([{ accepted: ['Au', 'au'] }])
    expect(plainText(roses!.stem)).toBe('Roses are _____, violets are _____.')
    expect(roses?.type === 'fill-in-the-blank' && roses.blanks).toEqual([{ accepted: ['red', 'crimson'] }, { accepted: ['blue'] }])
    expect(choices(mammals)).toEqual([['Whale', true], ['Shark', false], ['Bat', true]])
    expect(plainText(boils!.stem)).toBe('Water boils at _____ degrees Celsius.')
    expect(boils?.type === 'fill-in-the-blank' && boils.blanks).toEqual([{ accepted: ['100'], dropdown: true }])
    expect(matching?.type === 'matching' && matching.pairs.map((pair) => [pair.left && plainText(pair.left), plainText(pair.right!)])).toEqual([
      ['France', 'Paris'], ['Japan', 'Tokyo'], [null, 'Lima'],
    ])
    expect(gravity?.type === 'numeric' && gravity.answers).toEqual([{ value: '9.81', tolerance: '0.01' }])
    expect(plainText(essay!.stem)).toBe('Describe the water cycle.')

    expect(reading.issues.map((issue) => [issue.code, issue.message])).toEqual([
      ['file-upload', 'Question 10: it asks for a file upload, which no Question Type holds, so it was left out.'],
      ['not-a-question', '“Read the passage below before answering.” is text between questions, not a question, so it was left out.'],
      ['unsupported-type', 'Question 11: “calculated_question” questions can’t be read, so it was left out.'],
    ])
  })

  test('the quiz alone, as a bare .xml, leaves out the question whose picture is in the package', async () => {
    const { reading, questions } = await read('g8f3c2a.xml', fixture('canvas-export/g8f3c2a/g8f3c2a.xml'))
    expect(reading.format).toBe('qti')
    expect(questions).toHaveLength(8)
    expect(reading.issues.find((issue) => issue.code === 'picture-missing')?.message).toStartWith('Question 1:')
  })
})

describe('QTI 2.1 and 2.2 items', () => {
  test('a bare item whose picture is not in it comes back with no questions, saying why', async () => {
    const { reading, questions } = await read('choice.xml', fixture('qti21-choice.xml'))
    expect(reading.format).toBe('qti')
    expect(questions).toEqual([])
    expect(reading.issues.map((issue) => issue.code)).toEqual(['picture-missing'])
  })

  test('matching, text entry and ordering', async () => {
    const match = await read('match.xml', fixture('qti21-match.xml'))
    const [matching] = match.questions
    expect(plainText(matching!.stem)).toBe('Match each book to its author.')
    expect(matching?.type === 'matching' && matching.pairs.slice(0, 2).map((pair) => [plainText(pair.left!), plainText(pair.right!)])).toEqual([
      ['Hamlet', 'William Shakespeare'], ['Emma', 'Jane Austen'],
    ])
    expect(matching?.type === 'matching' && matching.pairs.some((pair) => pair.right && plainText(pair.right) === 'Charles Dickens')).toBe(true)

    const entry = await read('entry.xml', fixture('qti21-text-entry.xml'))
    expect(plainText(entry.questions[0]!.stem)).toBe('The capital of Canada is _____.')
    expect(entry.questions[0]?.type === 'fill-in-the-blank' && entry.questions[0].blanks).toEqual([{ accepted: ['Ottawa'] }])

    const order = await read('order.xml', fixture('qti21-order.xml'))
    expect(order.questions[0]?.type === 'ordering' && order.questions[0].items.map(plainText)).toEqual([
      'Ask a question', 'Test the hypothesis', 'Draw a conclusion',
    ])
  })

  test('a package: its test names the bank, and pictures come from inside it', async () => {
    const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1" identifier="MANIFEST-1">
  <organizations/>
  <resources>
    <resource identifier="test" type="imsqti_test_xmlv2p1" href="test.xml"><file href="test.xml"/></resource>
    <resource identifier="choice" type="imsqti_item_xmlv2p1" href="items/choice.xml"><file href="items/choice.xml"/><file href="items/images/sign.png"/></resource>
    <resource identifier="match" type="imsqti_item_xmlv2p1" href="items/match.xml"><file href="items/match.xml"/></resource>
  </resources>
</manifest>`
    const testXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="t1" title="English reading check">
  <testPart identifier="p1" navigationMode="linear" submissionMode="individual">
    <assessmentSection identifier="s1" title="Section" visible="true">
      <assessmentItemRef identifier="choice" href="items/choice.xml"/>
      <assessmentItemRef identifier="match" href="items/match.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`
    const { reading, bank, questions } = await read('reading-check.zip', await zip({
      'imsmanifest.xml': manifest,
      'test.xml': testXml,
      'items/choice.xml': fixture('qti21-choice.xml'),
      'items/match.xml': fixture('qti21-match.xml'),
      'items/images/sign.png': PNG,
    }))
    expect(reading.format).toBe('qti')
    expect(bank.name).toBe('English reading check')
    expect(questions.map((question) => question.type)).toEqual(['multiple-choice', 'matching'])
    expect(Object.keys(reading.pictures)).toHaveLength(1)
    expect(reading.issues).toEqual([])
  })
})

describe('QTI points', () => {
  const qti12 = (items: string) => encode(`<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2">
  <assessment ident="a1" title="Weather"><section ident="root_section">${items}</section></assessment>
</questestinterop>`)
  const essay = (ident: string, wording: string, extra: string) => `
      <item ident="${ident}" title="Question">${extra}
        <presentation>
          <material><mattext>${wording}</mattext></material>
          <response_str ident="r" rcardinality="Single"><render_fib rows="5"/></response_str>
        </presentation>
      </item>`

  test('a QTI 1.2 item keeps its weighting or SCORE maximum as written', async () => {
    const { questions } = await read('weather.xml', qti12([
      essay('i1', 'Describe a storm.', '<itemmetadata><qtimetadata><qtimetadatafield><fieldlabel>qmd_weighting</fieldlabel><fieldentry>2</fieldentry></qtimetadatafield></qtimetadata></itemmetadata>'),
      essay('i2', 'Describe fog.', '<resprocessing><outcomes><decvar varname="SCORE" vartype="Decimal" minvalue="0" maxvalue="3"/></outcomes></resprocessing>'),
      essay('i3', 'Describe hail.', '<resprocessing><outcomes><decvar varname="SCORE" vartype="Decimal" minvalue="0" maxvalue="1.5"/></outcomes></resprocessing>'),
      essay('i4', 'Describe sleet.', ''),
    ].join('')))
    expect(questions.map((question) => question.points)).toEqual([2, 3, 1.5, undefined])
  })

  test('a Canvas item’s points_possible is its points, never its SCORE percentage', async () => {
    const canvas = (points: string) => `<itemmetadata><qtimetadata>
          <qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>essay_question</fieldentry></qtimetadatafield>
          <qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>${points}</fieldentry></qtimetadatafield>
        </qtimetadata></itemmetadata>
        <resprocessing><outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes></resprocessing>`
    const { questions } = await read('weather.xml', qti12([
      essay('i1', 'Describe a storm.', canvas('4.0')),
      essay('i2', 'Describe fog.', canvas('0.5')),
    ].join('')))
    expect(questions.map((question) => question.points)).toEqual([4, 0.5])
  })
})

describe('QTI 3.0 items', () => {
  test('a multiple-response choice item', async () => {
    const { questions } = await read('primes.xml', fixture('qti30-choice.xml'))
    expect(plainText(questions[0]!.stem)).toBe('Which of these numbers are prime?\nSelect all that apply.')
    expect(choices(questions[0])).toEqual([['2', true], ['4', false], ['7', true]])
  })

  test('a text entry and a drop-down in one sentence', async () => {
    const { questions } = await read('rivers.xml', fixture('qti30-text-entry.xml'))
    expect(plainText(questions[0]!.stem)).toBe('London stands on the _____, and Paris on the _____.')
    expect(questions[0]?.type === 'fill-in-the-blank' && questions[0].blanks).toEqual([
      { accepted: ['Thames', 'River Thames'] }, { accepted: ['Seine'], dropdown: true },
    ])
  })
})

describe('QTI safety', () => {
  test('Moodle XML is not QTI', async () => {
    const reading = await readQuestionFile({ name: 'quiz.xml', bytes: encode('<?xml version="1.0"?><quiz><question type="essay"><questiontext><text>Why?</text></questiontext></question></quiz>') }).catch(() => null)
    expect(reading?.format ?? null).not.toBe('qti')
  })

  test('an external entity is never expanded, and a script does not survive', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE questestinterop [ <!ENTITY secret SYSTEM "file:///etc/passwd"> ]>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2">
  <assessment ident="a1" title="Hostile">
    <section ident="root_section">
      <item ident="i1" title="Question">
        <presentation>
          <material><mattext texttype="text/html">&lt;p&gt;Why &amp;secret;?&lt;script&gt;alert(1)&lt;/script&gt;&lt;/p&gt;</mattext></material>
          <response_str ident="response1" rcardinality="Single"><render_fib/></response_str>
        </presentation>
      </item>
      <item ident="i2" title="Question">
        <presentation><material><mattext>Say &secret;</mattext></material><response_str ident="r" rcardinality="Single"><render_fib/></response_str></presentation>
      </item>
    </section>
  </assessment>
</questestinterop>`
    const { reading, questions } = await read('hostile.xml', encode(xml))
    expect(reading.format).toBe('qti')
    expect(questions).toHaveLength(2)
    const json = JSON.stringify(questions)
    expect(json).not.toContain('root:')
    expect(json).not.toContain('alert')
    expect(plainText(questions[0]!.stem)).toBe('Why &secret;?')
  })
})
