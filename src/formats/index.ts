import type { FormatSpec } from '../reader'
import { aiken } from './aiken'
import { bbGenerator } from './bb-generator'
import { blooket } from './blooket'
import { flashcards } from './flashcards'
import { gift } from './gift'
import { kahoot } from './kahoot'
import { respondus } from './respondus'
import { spreadsheet } from './spreadsheet'
import { text2qti } from './text2qti'

/**
 * Every Format, in the order that breaks a tie between them: a package
 * before plain text, a specific Format before a general one (ADR-0004).
 */
export const FORMATS: readonly FormatSpec[] = [
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
