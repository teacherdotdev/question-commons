import { describe, expect, test } from 'bun:test'
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import schema from '../schema/question-bank-1.0.0.schema.json'
import { QUESTION_BANK_VERSION, readQuestionFile } from '../src'
import { fixture, readAt } from './helpers'

const root = fileURLToPath(new URL('./fixtures/', import.meta.url))

/** Samples that hold no questions, so have no bank to check. */
const EMPTY = ['google-forms/empty.headers.pdf', 'google-forms/empty.pdf']

/** Every sample file that is itself a Question File (not a README, not a folder's part). */
function sampleFiles(): string[] {
  const files: string[] = []
  const walk = (at: string) => {
    for (const name of readdirSync(at)) {
      const path = join(at, name)
      if (statSync(path).isDirectory()) {
        if (name !== 'canvas-export') walk(path)
      } else if (!/README|\.png$/i.test(name)) files.push(relative(root, path))
    }
  }
  walk(root)
  return files.filter((file) => !EMPTY.includes(file)).sort()
}

describe('the Question Bank schema', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false })
  addFormats(ajv)
  const validate = ajv.compile(schema)

  test('is the version every Question Bank names', () => {
    expect(schema.$id).toEndWith(`question-bank-${QUESTION_BANK_VERSION}.schema.json`)
  })

  test.each(sampleFiles())('every Question Bank read from %s follows it', async (path) => {
    // Quizlet is read only when asked for (ADR-0006).
    const format = path.includes('quizlet') ? 'quizlet' : undefined
    const reading = await readQuestionFile({ name: path.split('/').pop()!, bytes: fixture(path) }, { readAt, format })
    for (const bank of reading.banks) {
      const valid = validate(JSON.parse(JSON.stringify(bank)))
      expect(validate.errors ?? []).toEqual([])
      expect(valid).toBe(true)
    }
  })

  test('refuses a bank that does not follow it', () => {
    expect(validate({ format: 'question-commons/question-bank', version: '1.0.0', name: 'x', questions: [{ type: 'essay' }] })).toBe(false)
  })
})
