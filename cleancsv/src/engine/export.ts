// Writing the cleaned table back out as CSV text, plus safe download names.

import Papa from 'papaparse'
import type { Delimiter, Table } from './types'
import { isFormulaLike, protectFormula } from './values'

export interface ExportOptions {
  delimiter: Delimiter
  lineEnding: '\r\n' | '\n'
  /** Adds a byte-order mark so Excel shows accented letters correctly. */
  bom: boolean
  /** Adds an apostrophe before cells that a spreadsheet could run as a formula. */
  protectFormulas: boolean
}

export const DEFAULT_EXPORT: ExportOptions = { delimiter: ',', lineEnding: '\r\n', bom: false, protectFormulas: true }

export interface ExportResult {
  text: string
  protectedCells: number
}

export function countFormulaCells(table: Table): number {
  let n = 0
  for (const h of table.headers) if (isFormulaLike(h)) n++
  for (const r of table.rows) for (const v of r.cells) if (isFormulaLike(v)) n++
  return n
}

export function hasNonAscii(table: Table): boolean {
  const re = /[^\x00-\x7f]/
  if (table.headers.some((h) => re.test(h))) return true
  return table.rows.some((r) => r.cells.some((v) => re.test(v)))
}

export function toCSV(table: Table, opts: ExportOptions = DEFAULT_EXPORT): ExportResult {
  let protectedCells = 0
  const fix = (v: string) => {
    if (!opts.protectFormulas || !isFormulaLike(v)) return v
    protectedCells++
    return protectFormula(v)
  }
  const data = [table.headers.map(fix), ...table.rows.map((r) => r.cells.map(fix))]
  const body = Papa.unparse(data, {
    delimiter: opts.delimiter,
    newline: opts.lineEnding,
    quotes: false,
    quoteChar: '"',
    escapeChar: '"',
    escapeFormulae: false,
  })
  return { text: (opts.bom ? '﻿' : '') + body + opts.lineEnding, protectedCells }
}

/**
 * Reads the exported text back and checks it matches the table cell for cell.
 * This is how the app confirms the download contains what the screen shows.
 */
export function verifyExport(text: string, table: Table, opts: ExportOptions): { ok: true } | { ok: false; problem: string } {
  const body = text.startsWith('﻿') ? text.slice(1) : text
  const parsed = Papa.parse<string[]>(body, { delimiter: opts.delimiter, header: false, skipEmptyLines: false })
  let rows = parsed.data
  if (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') rows = rows.slice(0, -1)
  if (rows.length !== table.rows.length + 1) {
    return { ok: false, problem: `the file has ${rows.length - 1} rows but the table has ${table.rows.length}` }
  }
  const expect = (v: string) => (opts.protectFormulas ? protectFormula(v) : v)
  const all = [table.headers, ...table.rows.map((r) => r.cells)]
  for (let i = 0; i < all.length; i++) {
    const want = all[i]
    const got = rows[i]
    if (got.length !== want.length) return { ok: false, problem: `row ${i} has ${got.length} cells instead of ${want.length}` }
    for (let j = 0; j < want.length; j++) {
      if (got[j] !== expect(want[j])) return { ok: false, problem: `row ${i}, column ${j + 1} does not match` }
    }
  }
  return { ok: true }
}

/** Removes characters that are not allowed in file names on Windows, macOS or Linux. */
export function sanitizeFileName(name: string, fallback = 'file'): string {
  const cleaned = name
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.-]+|[\s.]+$/g, '')
    .slice(0, 120)
  const reserved = /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i
  if (cleaned === '' || reserved.test(cleaned)) return fallback
  return cleaned
}

export function baseName(fileName: string): string {
  return fileName.replace(/\.(csv|tsv|txt)$/i, '')
}

export function defaultExportName(fileName: string): string {
  return `cleaned-${sanitizeFileName(baseName(fileName), 'file')}.csv`
}

export function ensureCsvExtension(name: string): string {
  const safe = sanitizeFileName(name, 'cleaned-file.csv')
  return /\.(csv|tsv|txt)$/i.test(safe) ? safe : `${safe}.csv`
}
