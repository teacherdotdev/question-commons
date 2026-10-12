import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

describe('the built release', () => {
  test('loads by its package name in plain Node, with its types and schema, and reads a file', () => {
    const build = Bun.spawnSync(['bun', 'run', 'build'], { cwd: root })
    expect(build.exitCode).toBe(0)
    expect(existsSync(`${root}/dist/index.d.ts`)).toBe(true)

    const script = `
      import { readQuestionFile } from '@teacherdotdev/question-banks'
      import schema from '@teacherdotdev/question-banks/schema.json' with { type: 'json' }
      const bytes = new TextEncoder().encode('What is 2 + 2?\\nA. 3\\nB. 4\\nANSWER: B\\n')
      const reading = await readQuestionFile({ name: 'q.txt', bytes })
      console.log(JSON.stringify([reading.format, reading.banks[0].questions.length, schema.title]))
    `
    const node = Bun.spawnSync(['node', '--input-type=module', '-e', script], { cwd: root })
    expect(node.stderr.toString()).toBe('')
    expect(JSON.parse(node.stdout.toString())).toEqual(['aiken', 1, 'Question Bank 1.0.0'])
  }, 60_000)
})
