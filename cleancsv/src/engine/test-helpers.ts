import { parseText } from './parse'
import type { ImportMeta, Table } from './types'

/** Parses CSV text and fails the test if it does not parse. */
export function load(text: string): { table: Table; meta: ImportMeta } {
  const r = parseText(text)
  if (!r.ok) throw new Error(`expected file to parse: ${r.error.title}`)
  return { table: r.table, meta: r.meta }
}

export function tableOf(text: string): Table {
  return load(text).table
}

/** Freezes a table deeply, so any action that tries to modify its input throws. */
export function freeze(t: Table): Table {
  Object.freeze(t.headers)
  for (const r of t.rows) {
    Object.freeze(r.cells)
    Object.freeze(r)
  }
  Object.freeze(t.rows)
  return Object.freeze(t)
}

export function grid(t: Table): string[][] {
  return [[...t.headers], ...t.rows.map((r) => [...r.cells])]
}
