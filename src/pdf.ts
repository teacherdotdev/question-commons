/**
 * A PDF's pages as the text printed on them: runs of text, each where it
 * stands on the page. Read through `unpdf` (Mozilla's PDF.js), loaded only
 * when a file is a PDF.
 *
 * Text is taken glyph by glyph from what each page draws, not from PDF.js's
 * own text extraction, which guesses at spaces from the gaps between glyphs:
 * an emoji drawn narrower than the room it takes would gain a space. Here a
 * space is one only where the PDF draws a space.
 */

/** One stretch of text drawn in one font on one baseline. Coordinates are in
 *  points from the page's top left; `y` is the baseline. Its glyphs are in
 *  the order they stand on the page, left to right; `text` is in reading
 *  order, so right-to-left words read as they were written. */
export type PdfRun = {
  text: string
  x: number
  y: number
  width: number
  /** The font size, in points. */
  size: number
  font: string
  glyphs: { text: string; x: number; width: number }[]
}

export type PdfPage = { width: number; height: number; runs: PdfRun[] }

export const isPdf = (bytes: Uint8Array) =>
  bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d

type Matrix = [number, number, number, number, number, number]

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]

/** `m` then `n`, as PDF composes matrices. */
const times = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[1] * n[2],
  m[0] * n[1] + m[1] * n[3],
  m[2] * n[0] + m[3] * n[2],
  m[2] * n[1] + m[3] * n[3],
  m[4] * n[0] + m[5] * n[2] + n[4],
  m[4] * n[1] + m[5] * n[3] + n[5],
]

const translate = (x: number, y: number): Matrix => [1, 0, 0, 1, x, y]

type Glyph = { unicode: string; width: number; isSpace?: boolean } | number | null

const cache = new WeakMap<Uint8Array, Promise<PdfPage[] | null>>()

/** The pages of a PDF, or `null` for a file that isn't one or can't be read.
 *  Read once per file. */
export function pdfPages(bytes: Uint8Array): Promise<PdfPage[] | null> {
  let pages = cache.get(bytes)
  if (!pages) {
    pages = isPdf(bytes) ? readPages(bytes).catch(() => null) : Promise.resolve(null)
    cache.set(bytes, pages)
  }
  return pages
}

async function readPages(bytes: Uint8Array): Promise<PdfPage[]> {
  const { getDocumentProxy, getResolvedPDFJS } = await import('unpdf')
  const { OPS } = (await getResolvedPDFJS()) as unknown as { OPS: Record<string, number> }
  // PDF.js takes the bytes it is given, so it is given a copy.
  const document = await getDocumentProxy(bytes.slice())
  const pages: PdfPage[] = []
  try {
    for (let number = 1; number <= document.numPages; number += 1) {
      const page = await document.getPage(number)
      const [left, bottom, right, top] = page.view as [number, number, number, number]
      const operators = await page.getOperatorList()
      const fontMatrix = (name: string): number => {
        try {
          const matrix = (page.commonObjs.get(name) as { fontMatrix?: number[] } | undefined)?.fontMatrix
          return matrix?.[0] ?? 0.001
        } catch {
          return 0.001
        }
      }
      const runs = drawnRuns(operators.fnArray, operators.argsArray, OPS, fontMatrix)
      // From PDF space (origin bottom left) to the page's top left.
      for (const run of runs) {
        run.x -= left
        run.y = top - run.y
        for (const glyph of run.glyphs) glyph.x -= left
      }
      pages.push({ width: right - left, height: top - bottom, runs })
      page.cleanup()
    }
  } finally {
    await document.loadingTask.destroy()
  }
  return pages
}

/** Follows a page's drawing operators, keeping where each glyph lands. */
function drawnRuns(
  fns: number[],
  args: unknown[][],
  OPS: Record<string, number>,
  fontMatrix: (name: string) => number,
): PdfRun[] {
  const runs: PdfRun[] = []
  const stack: { ctm: Matrix; state: TextState }[] = []
  type TextState = { font: string; size: number; scale: number; charSpacing: number; wordSpacing: number; hScale: number; leading: number; rise: number }
  let ctm = IDENTITY
  let state: TextState = { font: '', size: 0, scale: 0.001, charSpacing: 0, wordSpacing: 0, hScale: 1, leading: 0, rise: 0 }
  let line = IDENTITY
  let matrix = IDENTITY
  let current: PdfRun | null = null

  const nextLine = (x: number, y: number) => {
    line = times(translate(x, y), line)
    matrix = line
  }

  const show = (glyphs: Glyph[]) => {
    for (const glyph of glyphs) {
      if (glyph === null) continue
      if (typeof glyph === 'number') {
        matrix = times(translate((-glyph / 1000) * state.size * state.hScale, 0), matrix)
        continue
      }
      const advance = (glyph.width * state.scale * state.size + state.charSpacing + (glyph.isSpace ? state.wordSpacing : 0)) * state.hScale
      const at = times(times(translate(0, state.rise), matrix), ctm)
      const end = times(times(translate(advance, state.rise), matrix), ctm)
      const x = at[4]
      const y = at[5]
      const width = Math.hypot(end[4] - at[4], end[5] - at[5])
      const size = Math.abs(state.size * Math.hypot(at[2], at[3]))
      matrix = times(translate(advance, 0), matrix)
      if (!glyph.unicode) continue
      // A glyph continues the run when it stands where the run ends, in the
      // same font, on the same baseline.
      const last = current?.glyphs.at(-1)
      const joins =
        current &&
        last &&
        current.font === state.font &&
        Math.abs(current.y - y) < 0.5 &&
        x > last.x + last.width - size * 0.3 &&
        x < last.x + last.width + size * 0.6
      if (!joins) {
        current = { text: '', x, y, width: 0, size, font: state.font, glyphs: [] }
        runs.push(current)
      }
      current!.glyphs.push({ text: glyph.unicode, x, width })
      current!.width = x + width - current!.x
    }
  }

  for (let index = 0; index < fns.length; index += 1) {
    const fn = fns[index]
    const arg = args[index] ?? []
    if (fn === OPS.save) stack.push({ ctm, state: { ...state } })
    else if (fn === OPS.restore) ({ ctm, state } = stack.pop() ?? { ctm, state })
    else if (fn === OPS.transform) ctm = times(arg as Matrix, ctm)
    else if (fn === OPS.paintFormXObjectBegin) {
      stack.push({ ctm, state: { ...state } })
      if (Array.isArray(arg[0]) && arg[0].length === 6) ctm = times(arg[0] as Matrix, ctm)
    } else if (fn === OPS.paintFormXObjectEnd) ({ ctm, state } = stack.pop() ?? { ctm, state })
    else if (fn === OPS.beginText) line = matrix = IDENTITY
    else if (fn === OPS.setFont) state = { ...state, font: String(arg[0]), size: Number(arg[1]), scale: fontMatrix(String(arg[0])) }
    else if (fn === OPS.setCharSpacing) state = { ...state, charSpacing: Number(arg[0]) }
    else if (fn === OPS.setWordSpacing) state = { ...state, wordSpacing: Number(arg[0]) }
    else if (fn === OPS.setHScale) state = { ...state, hScale: Number(arg[0]) / 100 }
    else if (fn === OPS.setLeading) state = { ...state, leading: -Number(arg[0]) }
    else if (fn === OPS.setTextRise) state = { ...state, rise: Number(arg[0]) }
    else if (fn === OPS.setTextMatrix) line = matrix = Array.from(arg[0] as ArrayLike<number>) as Matrix
    else if (fn === OPS.moveText) nextLine(Number(arg[0]), Number(arg[1]))
    else if (fn === OPS.setLeadingMoveText) {
      state = { ...state, leading: Number(arg[1]) }
      nextLine(Number(arg[0]), Number(arg[1]))
    } else if (fn === OPS.nextLine) nextLine(0, state.leading)
    else if (fn === OPS.showText || fn === OPS.showSpacedText) show(arg[0] as Glyph[])
    else if (fn === OPS.nextLineShowText) {
      nextLine(0, state.leading)
      show(arg[0] as Glyph[])
    } else if (fn === OPS.nextLineSetSpacingShowText) {
      state = { ...state, wordSpacing: Number(arg[0]), charSpacing: Number(arg[1]) }
      nextLine(0, state.leading)
      show(arg[2] as Glyph[])
    }
  }
  for (const run of runs) run.text = readingOrder(run.glyphs.map((glyph) => glyph.text))
  return runs
}

const RTL = /[֐-ࣿיִ-﷿ﹰ-﻿]/
const LTR = /[A-Za-z0-9À-ɏͰ-ϿЀ-ӿ]/
// Presentation forms are how a PDF draws Arabic letters joined, and Latin
// ligatures such as “fi”: read as the letters they are.
const PRESENTATION_FORM = /[ﬀ-ﭏﭐ-﷿ﹰ-﻿]/g

/**
 * Glyphs as they stand on the page, left to right, in the order they are
 * read: a run of right-to-left letters (Hebrew, Arabic), with the spaces
 * between them, is reversed.
 */
function readingOrder(glyphs: string[]): string {
  const out: string[] = []
  let index = 0
  while (index < glyphs.length) {
    if (!RTL.test(glyphs[index]!)) {
      out.push(glyphs[index]!)
      index += 1
      continue
    }
    let end = index
    for (let next = index; next < glyphs.length; next += 1) {
      if (RTL.test(glyphs[next]!)) end = next
      else if (LTR.test(glyphs[next]!)) break
    }
    for (let back = end; back >= index; back -= 1) out.push(glyphs[back]!)
    index = end + 1
  }
  return out.join('').replace(PRESENTATION_FORM, (form) => form.normalize('NFKC')).normalize('NFC')
}
