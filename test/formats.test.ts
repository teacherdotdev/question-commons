import { expect, test } from 'bun:test'
import { FORMATS, QUESTION_FILE_EXTENSIONS } from '../src'

// The agreed list (ADR-0006): each Format is one originator's layout, read
// from one Shape, and says which file types it arrives as.
test('every Format names its originator and the one Shape it reads', () => {
  expect(FORMATS.map((format) => [format.id, format.originator, format.shape])).toEqual([
    ['bb-package', 'Blackboard', 'package'],
    ['qti-package', 'IMS QTI', 'package'],
    ['google-forms-print', 'Google Forms', 'pdf'],
    ['bb-xml', 'Blackboard', 'xml'],
    ['qti-xml', 'IMS QTI', 'xml'],
    ['moodle-xml', 'Moodle', 'xml'],
    ['bb-tsv', 'Blackboard', 'table'],
    ['d2l-csv', 'Brightspace (D2L)', 'table'],
    ['respondus-csv', 'Respondus', 'table'],
    ['blooket', 'Blooket', 'table'],
    ['class-gauntlet', 'Class Gauntlet', 'table'],
    ['kahoot', 'Kahoot', 'table'],
    ['quizlet', 'Quizlet', 'table'],
    ['bb-generator', 'Blackboard Test Generator', 'text'],
    ['respondus', 'Respondus', 'text'],
    ['aiken', 'Moodle', 'text'],
    ['text2qti', 'text2qti', 'text'],
    ['gift', 'Moodle', 'text'],
    ['anki', 'Anki', 'text'],
  ])
})

test('every Format says the file types it arrives as, and a file picker takes them all', () => {
  const kahoot = FORMATS.find((format) => format.id === 'kahoot')!
  expect(kahoot.label).toBe('Kahoot spreadsheet')
  expect(kahoot.fileTypes).toEqual(['.xlsx', '.csv'])
  for (const format of FORMATS) {
    expect(format.fileTypes.length).toBeGreaterThan(0)
    for (const type of format.fileTypes) expect(QUESTION_FILE_EXTENSIONS).toContain(type)
  }
  expect(QUESTION_FILE_EXTENSIONS).toContain('.docx')
  expect(FORMATS.find((format) => format.id === 'google-forms-print')).toMatchObject({ label: 'Google Forms printout', fileTypes: ['.pdf'] })
})
