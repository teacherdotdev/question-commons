import { describe, expect, test } from 'bun:test'
import { plainText, type RichText } from '../src'

const text = (value: string, marks?: RichText[number]['marks']) => ({ type: 'text' as const, text: value, ...(marks ? { marks } : {}) })
const paragraph = (...content: RichText) => ({ type: 'paragraph' as const, content })

describe('plainText', () => {
  test('drops marks and keeps their words', () => {
    expect(plainText([paragraph(text('Which is '), text('largest', [{ type: 'strong' }]), text('?'))])).toBe('Which is largest?')
  })

  test('puts each paragraph, line break and list item on its own line', () => {
    expect(plainText([
      paragraph(text('First line'), { type: 'hard-break' }, text('second line')),
      { type: 'bullet-list', content: [
        { type: 'list-item', content: [paragraph(text('one'))] },
        { type: 'list-item', content: [paragraph(text('two'))] },
      ] },
    ])).toBe('First line\nsecond line\none\ntwo')
  })

  test('keeps math as its LaTeX and shows a blank as a line', () => {
    expect(plainText([paragraph(text('Solve '), { type: 'inline-math', source: '\\frac{1}{2}x = 3' }, text(': x = '), { type: 'blank' })]))
      .toBe('Solve \\frac{1}{2}x = 3: x = _____')
  })

  test('a picture has no text', () => {
    expect(plainText([paragraph(text('What is shown?')), { type: 'block-image', asset: 'cell.png', alt: 'a cell' }])).toBe('What is shown?')
  })
})
