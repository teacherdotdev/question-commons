import { describe, expect, test } from 'bun:test'
import JSZip from 'jszip'
import { FORMATS, plainText, readQuestionFile } from '../src'
import { readAt } from './helpers'

/**
 * Word documents built here, part by part, the way Word saves them: a
 * paragraph (`w:p`) of runs (`w:r`) of text (`w:t`), and lists that store
 * only a pointer (`w:numPr`) into `word/numbering.xml`.
 */

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

type Paragraph = string | { text: string; numId?: number; ilvl?: number; style?: string; runs?: string }

function paragraph(value: Paragraph): string {
  const { text, numId, ilvl, style, runs } = typeof value === 'string' ? { text: value } : value
  const numPr = numId !== undefined ? `<w:numPr><w:ilvl w:val="${ilvl ?? 0}"/><w:numId w:val="${numId}"/></w:numPr>` : ''
  const pStyle = style ? `<w:pStyle w:val="${style}"/>` : ''
  const pPr = numPr || pStyle ? `<w:pPr>${pStyle}${numPr}</w:pPr>` : ''
  const content = runs ?? (text ? `<w:r><w:t xml:space="preserve">${escape(text)}</w:t></w:r>` : '')
  return `<w:p>${pPr}${content}</w:p>`
}

const QUESTION_LIST = `
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl>
    <w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="lowerLetter"/><w:lvlText w:val="%2)"/></w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="1">
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val=""/></w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="2">
    <w:lvl w:ilvl="0"><w:start w:val="4"/><w:numFmt w:val="upperRoman"/><w:lvlText w:val="%1."/><w:suff w:val="space"/></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
  <w:num w:numId="3"><w:abstractNumId w:val="2"/></w:num>
  <w:num w:numId="4"><w:abstractNumId w:val="0"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="10"/></w:lvlOverride></w:num>
`

const STYLES = `
  <w:style w:type="paragraph" w:styleId="Question"><w:pPr><w:numPr><w:numId w:val="1"/></w:numPr></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Answer"><w:basedOn w:val="Question"/><w:pPr><w:numPr><w:ilvl w:val="1"/></w:numPr></w:pPr></w:style>
`

async function docx(paragraphs: (Paragraph | { table: Paragraph[][] })[], numbering = QUESTION_LIST, styles = STYLES) {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
  const body = paragraphs.map((each) =>
    typeof each === 'object' && 'table' in each
      ? `<w:tbl>${each.table.map((row) => `<w:tr>${row.map((cell) => `<w:tc>${paragraph(cell)}</w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>`
      : paragraph(each),
  ).join('')
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${body}<w:sectPr/></w:body></w:document>`)
  zip.file('word/numbering.xml', `<?xml version="1.0" encoding="UTF-8"?><w:numbering ${W}>${numbering}</w:numbering>`)
  zip.file('word/styles.xml', `<?xml version="1.0" encoding="UTF-8"?><w:styles ${W}>${styles}</w:styles>`)
  return zip.generateAsync({ type: 'uint8array' })
}

const read = async (name: string, bytes: Uint8Array) => {
  const reading = await readQuestionFile({ name, bytes }, { readAt })
  return { reading, questions: reading.banks.flatMap((bank) => bank.questions) }
}

const picture = '<w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"/></w:drawing></w:r>'

describe('Word documents written in a text Format', () => {
  test('reads the tagged format typed into Word as the Blackboard Test Generator’s', async () => {
    const bytes = await docx(['MC', 'Which planet is closest to the Sun?', 'Venus', 'Earth', '*Mercury', 'Mars', '', 'TF', 'The Sun is a planet.', '*F'])
    const { reading, questions } = await read('planets.docx', bytes)
    expect(reading.format).toBe('bb-generator')
    expect(reading.issues).toEqual([])
    expect(questions.map((question) => question.type)).toEqual(['multiple-choice', 'true-false'])
    expect(questions[0]?.type === 'multiple-choice' && questions[0].choices.map((choice) => [plainText(choice.content), choice.correct])).toEqual([
      ['Venus', false], ['Earth', false], ['Mercury', true], ['Mars', false],
    ])
    expect(questions[1]?.type === 'true-false' && questions[1].answer).toBe(false)
  })

  test('counts Word’s automatic numbering back in, so an auto-numbered Respondus list reads as typed', async () => {
    const bytes = await docx([
      { text: 'Who determined the exact speed of light?', numId: 1 },
      { text: 'Albert Einstein', numId: 1, ilvl: 1 },
      { text: 'Albert Michelson', numId: 1, ilvl: 1 },
      { text: 'Thomas Edison', numId: 1, ilvl: 1 },
      '',
      { text: 'Which is a noble gas?', numId: 1 },
      { text: 'Oxygen', numId: 1, ilvl: 1 },
      { text: 'Neon', numId: 1, ilvl: 1 },
      '',
      'Answers:',
      { text: 'B', numId: 4 },
      { text: 'B', numId: 4 },
    ], QUESTION_LIST.replace('<w:startOverride w:val="10"/>', '<w:startOverride w:val="1"/>'))
    const { reading, questions } = await read('respondus.docx', bytes)
    expect(reading.format).toBe('respondus')
    expect(questions.map((question) => question.type === 'multiple-choice' && question.choices.map((choice) => choice.correct))).toEqual([
      [false, true, false],
      [false, true],
    ])
  })

  test('numbering from paragraph styles reads as typed numbers and letters', async () => {
    const bytes = await docx([
      { text: 'What is 2 + 2?', style: 'Question' },
      { text: '3', style: 'Answer' },
      { text: '4', style: 'Answer' },
      '',
      { text: 'What is 3 + 3?', style: 'Question' },
      { text: '6', style: 'Answer' },
      { text: '7', style: 'Answer' },
      '',
      'Answers:',
      '1. B',
      '2. A',
    ])
    const { reading, questions } = await read('styles.docx', bytes)
    expect(reading.format).toBe('respondus')
    expect(questions.map((question) => plainText(question.stem))).toEqual(['What is 2 + 2?', 'What is 3 + 3?'])
    expect(questions.map((question) => question.type === 'multiple-choice' && question.choices.map((choice) => choice.correct))).toEqual([
      [false, true], [true, false],
    ])
  })

  test('leaves out a question with a picture in it, which Word keeps apart from its text', async () => {
    const bytes = await docx([
      'MC', { text: '', runs: '<w:r><w:t>Which planet is shown?</w:t></w:r>' + picture }, 'Venus', '*Mars', '',
      'MC', 'Which planet is largest?', 'Venus', '*Jupiter',
    ])
    const { reading, questions } = await read('planets.docx', bytes)
    expect(questions.map((question) => plainText(question.stem))).toEqual(['Which planet is largest?'])
    expect(reading.issues.map((issue) => [issue.code, issue.line])).toEqual([['picture-missing', 1]])
  })

  test('a Word document with no questions in a known Format says so in Word’s terms', async () => {
    const bytes = await docx(['Dear parents,', '', 'The field trip is on Friday.'])
    await expect(readQuestionFile({ name: 'letter.docx', bytes })).rejects.toThrow(
      'No questions written in a format this package knows were found in this Word document.',
    )
  })

  test('a broken document is not recognised, never a crash', async () => {
    const zip = new JSZip()
    zip.file('word/document.xml', '<w:document><w:body><w:p>')
    await expect(readQuestionFile({ name: 'broken.docx', bytes: await zip.generateAsync({ type: 'uint8array' }) })).rejects.toThrow('Word document')
  })

  test('is offered only to Formats that read Text', async () => {
    const bytes = await docx(['What is 2 + 2?', 'A. 3', 'B. 4', 'ANSWER: B'])
    const reading = await readQuestionFile({ name: 'quiz.docx', bytes }, { readAt })
    expect(reading.format).toBe('aiken')
    const shapes = new Set(reading.candidates.map((candidate) => FORMATS.find((format) => format.id === candidate.format)!.shape))
    expect([...shapes]).toEqual(['text'])
  })
})
