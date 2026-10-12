import type { FormatSpec } from '../reader'
import { aiken } from './aiken'
import { gift } from './gift'

/**
 * Every Format, in the order that breaks a tie between them: a package
 * before plain text, a specific Format before a general one (ADR-0004).
 */
export const FORMATS: readonly FormatSpec[] = [aiken, gift]
