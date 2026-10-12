import type { FormatSpec } from '../reader'
import { aiken } from './aiken'
import { bbGenerator } from './bb-generator'
import { bbPackage } from './bb-package'
import { bbTsv } from './bb-tsv'
import { blooket } from './blooket'
import { d2lCsv } from './d2l-csv'
import { flashcards } from './flashcards'
import { gift } from './gift'
import { kahoot } from './kahoot'
import { moodleXml } from './moodle-xml'
import { qti } from './qti'
import { respondus } from './respondus'
import { respondusCsv } from './respondus-csv'
import { spreadsheet } from './spreadsheet'
import { text2qti } from './text2qti'

/**
 * Every Format, in the order that breaks a tie between them: a package
 * before plain text, a specific Format before a general one (ADR-0004).
 */
export const FORMATS: readonly FormatSpec[] = [
  bbPackage,
  qti,
  moodleXml,
  bbTsv,
  d2lCsv,
  respondusCsv,
  blooket,
  kahoot,
  bbGenerator,
  respondus,
  aiken,
  text2qti,
  gift,
  spreadsheet,
  flashcards,
]
