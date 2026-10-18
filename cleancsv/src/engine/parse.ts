// Reads a file's bytes into a Table. Pure: no DOM, so it runs in a Web Worker, in tests,
// and on the main thread as a fallback.

import Papa from 'papaparse'
import type { Delimiter, ImportMeta, ParseResult, ParseWarning, Row, Table } from './types'
import { MAX_BYTES, MAX_CELLS, SOFT_LIMIT_BYTES, formatBytes } from './limits'
import { plural } from './values'

export const ENCODINGS = [
  { value: 'auto', label: 'Detect automatically' },
  { value: 'utf-8', label: 'UTF-8 (most common)' },
  { value: 'windows-1252', label: 'Windows-1252 / Latin-1 (older Excel on Windows)' },
  { value: 'utf-16le', label: 'UTF-16 LE' },
  { value: 'utf-16be', label: 'UTF-16 BE' },
  { value: 'macintosh', label: 'Mac Roman (older Excel on Mac)' },
  { value: 'iso-8859-2', label: 'Central European (ISO-8859-2)' },
  { value: 'windows-1251', label: 'Cyrillic (Windows-1251)' },
  { value: 'shift_jis', label: 'Japanese (Shift_JIS)' },
  { value: 'gb18030', label: 'Chinese Simplified (GB18030)' },
  { value: 'big5', label: 'Chinese Traditional (Big5)' },
  { value: 'euc-kr', label: 'Korean (EUC-KR)' },
] as const

export const DELIMITERS: { value: Delimiter | 'auto'; label: string }[] = [
  { value: 'auto', label: 'Detect automatically' },
  { value: ',', label: 'Comma ( , )' },
  { value: ';', label: 'Semicolon ( ; )' },
  { value: '\t', label: 'Tab' },
  { value: '|', label: 'Pipe ( | )' },
]

export function delimiterName(d: Delimiter): string {
  return { ',': 'comma', ';': 'semicolon', '\t': 'tab', '|': 'pipe' }[d]
}

export interface ParseOptions {
  fileName: string
  encoding?: string
  delimiter?: Delimiter | 'auto'
  /** Overridable for tests. */
  limits?: { maxBytes: number; maxCells: number }
}

const fail = (title: string, message: string): ParseResult => ({ ok: false, error: { title, message } })

function startsWith(bytes: Uint8Array, sig: number[]): boolean {
  return sig.every((b, i) => bytes[i] === b)
}

interface Decoded {
  text: string
  encoding: string
  hadBom: boolean
  warnings: ParseWarning[]
}

export function decode(bytes: Uint8Array, requested = 'auto'): Decoded | { error: string } {
  const warnings: ParseWarning[] = []
  let encoding = requested
  let hadBom = false
  let offset = 0
  if (startsWith(bytes, [0xef, 0xbb, 0xbf])) {
    hadBom = true
    if (encoding === 'auto') encoding = 'utf-8'
    if (encoding === 'utf-8') offset = 3
  } else if (startsWith(bytes, [0xff, 0xfe])) {
    hadBom = true
    if (encoding === 'auto') encoding = 'utf-16le'
    if (encoding === 'utf-16le') offset = 2
  } else if (startsWith(bytes, [0xfe, 0xff])) {
    hadBom = true
    if (encoding === 'auto') encoding = 'utf-16be'
    if (encoding === 'utf-16be') offset = 2
  }

  if (encoding === 'auto') {
    // UTF-16 without a byte-order mark: lots of zero bytes in every other position.
    const sample = bytes.subarray(0, Math.min(bytes.length, 4096))
    let evenZeros = 0
    let oddZeros = 0
    for (let i = 0; i < sample.length; i++) if (sample[i] === 0) (i % 2 === 0 ? evenZeros++ : oddZeros++)
    const half = sample.length / 2
    if (oddZeros > half * 0.3 && evenZeros < half * 0.05) encoding = 'utf-16le'
    else if (evenZeros > half * 0.3 && oddZeros < half * 0.05) encoding = 'utf-16be'
  }

  const body = bytes.subarray(offset)
  if (encoding === 'auto') {
    try {
      return { text: new TextDecoder('utf-8', { fatal: true }).decode(body), encoding: 'utf-8', hadBom, warnings }
    } catch {
      warnings.push({
        kind: 'encoding-fallback',
        severity: 'check',
        message:
          'This file is not saved as UTF-8, so we read it as Windows-1252, which older versions of Excel use. If accented letters or symbols look wrong, choose a different text encoding below.',
      })
      encoding = 'windows-1252'
    }
  }
  try {
    const text = new TextDecoder(encoding).decode(body)
    return { text, encoding, hadBom, warnings }
  } catch {
    return { error: `Your browser cannot read the "${encoding}" text encoding. Try "Detect automatically" or UTF-8.` }
  }
}

function detectLineEnding(text: string): ImportMeta['lineEnding'] {
  const sample = text.slice(0, 100_000)
  const crlf = (sample.match(/\r\n/g) ?? []).length
  const lf = (sample.match(/\n/g) ?? []).length - crlf
  const cr = (sample.match(/\r/g) ?? []).length - crlf
  if (crlf >= lf && crlf >= cr && crlf > 0) return '\r\n'
  if (cr > lf) return '\r'
  return '\n'
}

/** Gives blank and repeated header names unique, readable names: "Column 3", "Email (2)". */
export function makeUniqueHeaders(headers: readonly string[]): string[] {
  const taken = new Set<string>()
  return headers.map((h, i) => {
    const base = h.trim() === '' ? `Column ${i + 1}` : h
    let name = base
    let n = 2
    while (taken.has(name)) name = `${base} (${n++})`
    taken.add(name)
    return name
  })
}

function rowsSample(ids: number[]): string {
  const shown = ids.slice(0, 5).join(', ')
  return ids.length > 5 ? `${shown} and ${ids.length - 5} more` : shown
}

export function parseBytes(bytes: Uint8Array, opts: ParseOptions): ParseResult {
  const fileSize = bytes.byteLength
  const maxBytes = opts.limits?.maxBytes ?? MAX_BYTES
  const maxCells = opts.limits?.maxCells ?? MAX_CELLS
  if (fileSize === 0) return fail('This file is empty', 'The file has no content at all. Check that you picked the right file.')
  if (fileSize > maxBytes) {
    return fail(
      'This file is too large',
      `This file is ${formatBytes(fileSize)}. CleanCSV works inside your browser and can handle files up to ${formatBytes(maxBytes)}. Try splitting the file into smaller parts.`,
    )
  }
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    return fail(
      'This looks like an Excel or zip file, not a CSV',
      'Open it in Excel, Google Sheets or Numbers, then choose File → Save As (or Download) → CSV, and upload that file instead.',
    )
  }
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0])) {
    return fail(
      'This looks like an old Excel (.xls) file, not a CSV',
      'Open it in Excel or Google Sheets, then save or download it as CSV, and upload that file instead.',
    )
  }
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) {
    return fail('This is a PDF, not a CSV', 'CleanCSV can only read spreadsheet data saved as CSV (comma-separated) text.')
  }

  const decoded = decode(bytes, opts.encoding ?? 'auto')
  if ('error' in decoded) return fail('We could not read this file', decoded.error)
  const { text, encoding, hadBom } = decoded
  const warnings = [...decoded.warnings]

  const controlChars = (text.slice(0, 20_000).match(/[\u0000-\u0008\u000e-\u001f]/g) ?? []).length
  if (controlChars > 20) {
    return fail(
      "This doesn't look like a text file",
      'It contains a lot of unreadable characters, so it is probably not a CSV. If it came from Excel, save it as CSV first. If it is a CSV, try a different text encoding.',
    )
  }
  if (text.trim() === '') return fail('This file is empty', 'The file only contains blank space.')

  const replacementCount = (text.match(/�/g) ?? []).length
  if (replacementCount > 0 && encoding !== 'utf-8') {
    warnings.push({
      kind: 'replacement-characters',
      severity: 'check',
      message: `${plural(replacementCount, 'character')} could not be read and show as �. Try a different text encoding below.`,
    })
  } else if (replacementCount > 0) {
    warnings.push({
      kind: 'replacement-characters',
      severity: 'info',
      message: `The file contains ${plural(replacementCount, '� symbol')}. These were already in the file, which usually means it was damaged by an earlier conversion.`,
    })
  }

  const tooManyCells = (rowsN: number, colsN: number) =>
    fail(
      'This file has too many cells for your browser',
      `It has about ${plural(rowsN, 'row')} and ${plural(colsN, 'column')}. CleanCSV can handle up to ${maxCells.toLocaleString('en-US')} cells. Try splitting the file into smaller parts.`,
    )

  let chosen: string = opts.delimiter && opts.delimiter !== 'auto' ? opts.delimiter : ''
  if (chosen === '') {
    // Guess the separator from the start of the file, then use it for the whole file.
    const head = Papa.parse<string[]>(text.slice(0, 64 * 1024), { delimitersToGuess: [',', ';', '\t', '|'], preview: 200, skipEmptyLines: true })
    chosen = head.meta.delimiter || ','
  }
  // Rough cell count before parsing, so a huge file is refused before it can exhaust memory.
  let separators = 0
  let lines = 1
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i)
    if (ch === 10) lines++
    else if (ch === chosen.charCodeAt(0)) separators++
  }
  const roughCells = separators + lines
  if (roughCells > maxCells * 1.5) return tooManyCells(lines, Math.max(1, Math.round(roughCells / lines)))

  let parsed: Papa.ParseResult<string[]>
  try {
    parsed = Papa.parse<string[]>(text, {
      delimiter: chosen,
      header: false,
      skipEmptyLines: false,
      dynamicTyping: false,
      quoteChar: '"',
      escapeChar: '"',
    })
  } catch (e) {
    if (e instanceof RangeError) {
      return fail('This file is too large for your browser', 'Your browser ran out of memory while reading it. Try a smaller file, or close other tabs and try again.')
    }
    return fail('We could not read this file', 'Something unexpected went wrong while reading it. The file may be damaged.')
  }

  let data = parsed.data
  // A file that ends with a line break produces one extra empty record. It is not a real row.
  if (data.length > 0) {
    const last = data[data.length - 1]
    if (last.length === 1 && last[0] === '') data = data.slice(0, -1)
  }
  if (data.length === 0) return fail('This file is empty', 'We could not find any rows in it.')

  const delimiter = (parsed.meta.delimiter as Delimiter) || ','
  const rawHeaders = data[0].map((h) => h)
  const body = data.slice(1)
  if (body.length === 0) {
    return fail(
      'This file has column names but no rows',
      `We found ${plural(rawHeaders.length, 'column')} (${rawHeaders.slice(0, 4).join(', ')}${rawHeaders.length > 4 ? ', …' : ''}) but no data below them.`,
    )
  }

  let width = rawHeaders.length
  for (const r of body) if (r.length > width) width = r.length
  if (width * body.length > maxCells) return tooManyCells(body.length, width)

  const extraRows: number[] = []
  const shortRows: number[] = []
  const rows: Row[] = new Array(body.length)
  for (let i = 0; i < body.length; i++) {
    const r = body[i]
    const id = i + 1
    // A completely blank line is one empty cell; it becomes an empty row, not a "short" row.
    const isBlankLine = r.length === 1 && r[0] === ''
    if (r.length > rawHeaders.length) extraRows.push(id)
    else if (r.length < rawHeaders.length && !isBlankLine) shortRows.push(id)
    let cells = r
    if (cells.length < width) cells = cells.concat(new Array(width - cells.length).fill(''))
    rows[i] = { id, cells }
  }

  const headersPadded = rawHeaders.concat(
    Array.from({ length: width - rawHeaders.length }, (_, i) => `Extra ${i + 1}`),
  )
  const headers = makeUniqueHeaders(headersPadded)

  if (extraRows.length > 0) {
    warnings.push({
      kind: 'extra-cells',
      severity: 'important',
      message: `${plural(extraRows.length, 'row has', 'rows have')} more values than there are column names (row ${rowsSample(extraRows)}). Nothing was thrown away: the extra values are in new columns called "Extra 1" and so on. This often means a value contains an unquoted comma.`,
      rows: extraRows.slice(0, 1000),
    })
  }
  if (shortRows.length > 0) {
    warnings.push({
      kind: 'missing-cells',
      severity: 'check',
      message: `${plural(shortRows.length, 'row has', 'rows have')} fewer values than there are columns (row ${rowsSample(shortRows)}). The missing cells at the end are left empty.`,
      rows: shortRows.slice(0, 1000),
    })
  }
  const renamed = headers
    .slice(0, rawHeaders.length)
    .map((h, i) => ({ from: rawHeaders[i], to: h }))
    .filter((x) => x.from !== x.to)
  if (renamed.length > 0) {
    warnings.push({
      kind: 'renamed-headers',
      severity: 'check',
      message: `${plural(renamed.length, 'column had', 'columns had')} no name or the same name as another column, so we named ${renamed.length === 1 ? 'it' : 'them'} ${renamed
        .slice(0, 4)
        .map((r) => `"${r.to}"`)
        .join(', ')}${renamed.length > 4 ? ', …' : ''} to tell them apart. Your download will use these names.`,
    })
  }

  const quoteErrors = parsed.errors.filter((e) => e.type === 'Quotes')
  const unclosed = quoteErrors.filter((e) => e.code === 'MissingQuotes')
  const badQuotes = quoteErrors.filter((e) => e.code !== 'MissingQuotes')
  const errRow = (e: Papa.ParseError) => (typeof e.row === 'number' ? e.row : 0)
  if (unclosed.length > 0) {
    const at = unclosed.map(errRow)
    warnings.push({
      kind: 'unclosed-quote',
      severity: 'important',
      blocking: true,
      message: `A quotation mark near row ${rowsSample(at)} is never closed. Everything after it may have been read as a single cell, so rows could be missing or merged. Check the preview below. If it looks wrong, fix the quote in the original file or try a different separator.`,
      rows: at,
    })
  }
  if (badQuotes.length > 0) {
    const at = badQuotes.map(errRow)
    warnings.push({
      kind: 'bad-quote',
      severity: 'check',
      message: `${plural(badQuotes.length, 'cell has', 'cells have')} quotation marks in an unusual place (near row ${rowsSample(at)}). We read them as best we could. Check those rows.`,
      rows: at,
    })
  }
  if (fileSize > SOFT_LIMIT_BYTES) {
    warnings.push({
      kind: 'large-file',
      severity: 'info',
      message: `This is a large file (${formatBytes(fileSize)}). Some fixes may take a few seconds.`,
    })
  }

  const table: Table = { headers, rows }
  const meta: ImportMeta = {
    fileName: opts.fileName,
    fileSize,
    encoding,
    delimiter,
    rowCount: rows.length,
    columnCount: headers.length,
    hadBom,
    lineEnding: detectLineEnding(text),
    originalHeaders: rawHeaders,
    warnings,
  }
  return { ok: true, table, meta }
}

/** Convenience for tests and the sample file: parse a string as if it were a UTF-8 file. */
export function parseText(text: string, opts: Partial<ParseOptions> = {}): ParseResult {
  return parseBytes(new TextEncoder().encode(text), { fileName: 'data.csv', ...opts })
}
