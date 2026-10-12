import type { FormatId, Shape } from './reader'

/**
 * What a teacher and an app are told about the Formats this package reads,
 * kept apart from the parsers so a drop zone can name them without loading
 * them.
 */

export type FormatInfo = {
  id: FormatId
  /** The Format as a teacher knows it. */
  label: string
  /** The tool that writes the layout, or defines and imports it (ADR-0006). */
  originator: string
  /** The one Shape it reads. */
  shape: Shape
  /** The file types it arrives as, most usual first. */
  fileTypes: readonly string[]
}

/**
 * Every Format, in the order that breaks a tie between them: a package
 * before a single file, a specific Format before a general one (ADR-0004).
 */
export const FORMATS: readonly FormatInfo[] = [
  { id: 'bb-package', label: 'Blackboard pool or test export', originator: 'Blackboard', shape: 'package', fileTypes: ['.zip'] },
  { id: 'qti-package', label: 'QTI package (Canvas, Brightspace, Blackboard and others)', originator: 'IMS QTI', shape: 'package', fileTypes: ['.zip', '.imscc'] },
  { id: 'google-forms-print', label: 'Google Forms printout', originator: 'Google Forms', shape: 'pdf', fileTypes: ['.pdf'] },
  { id: 'bb-xml', label: 'Blackboard pool file', originator: 'Blackboard', shape: 'xml', fileTypes: ['.dat', '.xml'] },
  { id: 'qti-xml', label: 'QTI XML (Canvas, Brightspace, Blackboard and others)', originator: 'IMS QTI', shape: 'xml', fileTypes: ['.xml', '.qti'] },
  { id: 'moodle-xml', label: 'Moodle XML', originator: 'Moodle', shape: 'xml', fileTypes: ['.xml'] },
  { id: 'bb-tsv', label: 'Blackboard upload file (tab-delimited)', originator: 'Blackboard', shape: 'table', fileTypes: ['.txt', '.tsv', '.tab'] },
  { id: 'd2l-csv', label: 'Brightspace (D2L) question CSV', originator: 'Brightspace (D2L)', shape: 'table', fileTypes: ['.csv'] },
  { id: 'respondus-csv', label: 'Respondus CSV', originator: 'Respondus', shape: 'table', fileTypes: ['.csv', '.txt'] },
  { id: 'blooket', label: 'Blooket spreadsheet', originator: 'Blooket', shape: 'table', fileTypes: ['.csv', '.xlsx'] },
  { id: 'class-gauntlet', label: 'Class Gauntlet spreadsheet', originator: 'Class Gauntlet', shape: 'table', fileTypes: ['.csv', '.tsv', '.txt', '.xlsx'] },
  { id: 'kahoot', label: 'Kahoot spreadsheet', originator: 'Kahoot', shape: 'table', fileTypes: ['.xlsx', '.csv'] },
  { id: 'quizlet', label: 'Quizlet export', originator: 'Quizlet', shape: 'table', fileTypes: ['.txt'] },
  { id: 'bb-generator', label: 'Blackboard Test Generator text', originator: 'Blackboard Test Generator', shape: 'text', fileTypes: ['.txt', '.text', '.docx'] },
  { id: 'respondus', label: 'Respondus Standard text', originator: 'Respondus', shape: 'text', fileTypes: ['.txt', '.docx'] },
  { id: 'aiken', label: 'Aiken', originator: 'Moodle', shape: 'text', fileTypes: ['.txt', '.aiken', '.docx'] },
  { id: 'text2qti', label: 'text2qti', originator: 'text2qti', shape: 'text', fileTypes: ['.txt', '.md'] },
  { id: 'gift', label: 'Moodle GIFT', originator: 'Moodle', shape: 'text', fileTypes: ['.gift', '.txt', '.docx'] },
  { id: 'anki', label: 'Anki export', originator: 'Anki', shape: 'text', fileTypes: ['.txt'] },
]

export const formatInfo = (id: FormatId): FormatInfo => FORMATS.find((format) => format.id === id)!

/** The file names a Question File is saved under: every Format's file types. */
export const QUESTION_FILE_EXTENSIONS: readonly string[] = [...new Set(FORMATS.flatMap((format) => format.fileTypes))]

export function isQuestionFileName(name: string): boolean {
  const lower = name.toLowerCase()
  return QUESTION_FILE_EXTENSIONS.some((extension) => lower.endsWith(extension))
}
