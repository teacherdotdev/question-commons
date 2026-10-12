import { FORMATS } from '../catalog'
import type { FormatSpec } from '../reader'
import { aiken } from './aiken'
import { bbGenerator } from './bb-generator'
import { bbPackage, bbXml } from './bb-package'
import { bbTsv } from './bb-tsv'
import { blooket } from './blooket'
import { classGauntlet } from './class-gauntlet'
import { d2lCsv } from './d2l-csv'
import { anki, quizlet } from './flashcards'
import { gift } from './gift'
import { kahoot } from './kahoot'
import { moodleXml } from './moodle-xml'
import { qtiPackage, qtiXml } from './qti'
import { respondus } from './respondus'
import { respondusCsv } from './respondus-csv'
import { text2qti } from './text2qti'

const readers = [
  aiken, anki, bbGenerator, bbPackage, bbTsv, bbXml, blooket, classGauntlet, d2lCsv, gift, kahoot, moodleXml,
  qtiPackage, qtiXml, quizlet, respondus, respondusCsv, text2qti,
]

/** Every Format's reader, in the catalogue's order, which breaks a tie between them (ADR-0004). */
export const READERS: readonly FormatSpec[] = FORMATS.map(({ id }) => readers.find((reader) => reader.id === id)!)
