// Cleaning actions. Each one is a pure function: it takes a table and returns a NEW table
// plus a list of exactly what changed. The input table is never modified, which is what
// makes undo, redo and "reset to original" exact. Unchanged rows are shared between the
// old and new table, so keeping history does not copy the whole file each time.

import type { ActionResult, CellChange, ChangeSet, ParamsOf, Row, Step, Table } from './types'
import { checkEmail, cleanSpaces, isBlank, plural, toSentenceCase, toTitleCase } from './values'
import { formatDate, isAmbiguous, readDate, resolveDate } from './dates'
import { readNumber } from './numbers'
import { formatPhone, looksLikePhone } from './phones'
import { makeUniqueHeaders } from './parse'

/** A problem with the step itself (e.g. a column that does not exist). The message is shown to the user. */
export class ActionError extends Error {}

export function emptyChanges(): ChangeSet {
  return { cells: [], removedRows: [], headers: [], removedColumns: [], addedColumns: [] }
}

export function colIndex(table: Table, name: string): number {
  const i = table.headers.indexOf(name)
  if (i === -1) throw new ActionError(`There is no column called "${name}" in this file.`)
  return i
}

function colIndexes(table: Table, names: string[]): number[] {
  if (names.length === 0) return table.headers.map((_, i) => i)
  return names.map((n) => colIndex(table, n))
}

type CellFn = (value: string, row: Row, col: number) => string | null

function mapCells(table: Table, cols: number[], fn: CellFn): { table: Table; changes: CellChange[] } {
  const changes: CellChange[] = []
  const rows = table.rows.map((row) => {
    let next: string[] | null = null
    for (const c of cols) {
      const before = row.cells[c]
      const after = fn(before, row, c)
      if (after !== null && after !== before) {
        if (!next) next = row.cells.slice()
        next[c] = after
        changes.push({ rowId: row.id, column: table.headers[c], before, after })
      }
    }
    return next ? { id: row.id, cells: next } : row
  })
  return { table: changes.length ? { headers: table.headers, rows } : table, changes }
}

function cellResult(
  table: Table,
  cols: number[],
  fn: CellFn,
  summary: (n: number) => string,
  skipped: ActionResult['skipped'] = [],
): ActionResult {
  const { table: next, changes } = mapCells(table, cols, fn)
  return {
    table: next,
    changes: { ...emptyChanges(), cells: changes },
    affected: changes.length,
    unit: 'cells',
    summary: summary(changes.length),
    skipped,
  }
}

// ---------- Rows ----------

function dupKey(row: Row, cols: number[], ignoreCase: boolean, ignoreSpaces: boolean): string | null {
  let allBlank = true
  const parts = cols.map((c) => {
    let v = row.cells[c]
    if (!isBlank(v)) allBlank = false
    if (ignoreSpaces) v = cleanSpaces(v, true)
    if (ignoreCase) v = v.toLowerCase()
    return v
  })
  // Rows whose compared cells are all empty are never treated as duplicates of each other.
  return allBlank ? null : parts.join('\u0000')
}

function removeDuplicates(table: Table, p: ParamsOf<'removeDuplicates'>): ActionResult {
  const cols = colIndexes(table, p.columns)
  const keptBy = new Map<string, number>()
  const remove = new Map<number, string>()
  const order = p.keep === 'last' ? [...table.rows].reverse() : table.rows
  for (const row of order) {
    const key = dupKey(row, cols, p.ignoreCase, p.ignoreSpaces)
    if (key === null) continue
    const kept = keptBy.get(key)
    if (kept === undefined) keptBy.set(key, row.id)
    else remove.set(row.id, `same as row ${kept}`)
  }
  const changes = emptyChanges()
  const rows = table.rows.filter((r) => {
    const note = remove.get(r.id)
    if (note === undefined) return true
    changes.removedRows.push({ rowId: r.id, cells: r.cells, note })
    return false
  })
  const n = changes.removedRows.length
  return {
    table: n ? { headers: table.headers, rows } : table,
    changes,
    affected: n,
    unit: 'rows',
    summary: n ? `Removed ${plural(n, 'duplicate row')}` : 'No duplicate rows found',
    skipped: [],
  }
}

function removeEmptyRows(table: Table): ActionResult {
  const changes = emptyChanges()
  const rows = table.rows.filter((r) => {
    if (r.cells.every(isBlank)) {
      changes.removedRows.push({ rowId: r.id, cells: r.cells, note: 'every cell is empty' })
      return false
    }
    return true
  })
  const n = changes.removedRows.length
  return {
    table: n ? { headers: table.headers, rows } : table,
    changes,
    affected: n,
    unit: 'rows',
    summary: n ? `Removed ${plural(n, 'empty row')}` : 'No empty rows found',
    skipped: [],
  }
}

// ---------- Columns ----------

function dropColumns(table: Table, drop: Set<number>): Table {
  return {
    headers: table.headers.filter((_, i) => !drop.has(i)),
    rows: table.rows.map((r) => ({ id: r.id, cells: r.cells.filter((_, i) => !drop.has(i)) })),
  }
}

function removeEmptyColumns(table: Table): ActionResult {
  const drop = new Set<number>()
  table.headers.forEach((_, c) => {
    if (table.rows.every((r) => isBlank(r.cells[c]))) drop.add(c)
  })
  if (drop.size === table.headers.length) {
    throw new ActionError('Every column is empty, so removing them would leave nothing.')
  }
  const changes = emptyChanges()
  changes.removedColumns = [...drop].map((i) => ({ index: i, name: table.headers[i] }))
  return {
    table: drop.size ? dropColumns(table, drop) : table,
    changes,
    affected: drop.size,
    unit: 'columns',
    summary: drop.size ? `Removed ${plural(drop.size, 'empty column')}` : 'No empty columns found',
    skipped: [],
  }
}

function removeColumn(table: Table, p: ParamsOf<'removeColumn'>): ActionResult {
  const c = colIndex(table, p.column)
  if (table.headers.length === 1) throw new ActionError('This is the only column, so it cannot be removed.')
  const changes = emptyChanges()
  changes.removedColumns = [{ index: c, name: p.column }]
  return {
    table: dropColumns(table, new Set([c])),
    changes,
    affected: 1,
    unit: 'columns',
    summary: `Removed the column "${p.column}"`,
    skipped: [],
  }
}

function renameHeaders(table: Table, next: string[], summary: (n: number) => string): ActionResult {
  const changes = emptyChanges()
  next.forEach((h, i) => {
    if (h !== table.headers[i]) changes.headers.push({ index: i, before: table.headers[i], after: h })
  })
  const n = changes.headers.length
  return {
    table: n ? { headers: next, rows: table.rows } : table,
    changes,
    affected: n,
    unit: 'columns',
    summary: summary(n),
    skipped: [],
  }
}

function renameColumn(table: Table, p: ParamsOf<'renameColumn'>): ActionResult {
  const c = colIndex(table, p.column)
  const to = p.to.trim()
  if (to === '') throw new ActionError('Type a new name for the column.')
  if (to !== p.column && table.headers.includes(to)) throw new ActionError(`There is already a column called "${to}".`)
  const next = [...table.headers]
  next[c] = to
  return renameHeaders(table, next, (n) => (n ? `Renamed "${p.column}" to "${to}"` : 'The name is unchanged'))
}

function splitWords(h: string): string[] {
  return h
    .trim()
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1 $2')
    .split(/[\s_\-.]+/u)
    .filter(Boolean)
}

export function styleHeader(h: string, style: ParamsOf<'cleanHeaders'>['style']): string {
  switch (style) {
    case 'tidy':
      return cleanSpaces(h, true)
    case 'lower':
      return cleanSpaces(h, true).toLowerCase()
    case 'title':
      return splitWords(h)
        .map((w) => (w.length > 1 && w === w.toUpperCase() ? w : toTitleCase(w)))
        .join(' ')
    case 'snake':
      return splitWords(h)
        .join(' ')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, '_')
        .replace(/^_+|_+$/g, '')
  }
}

function cleanHeaders(table: Table, p: ParamsOf<'cleanHeaders'>): ActionResult {
  const styled = table.headers.map((h) => styleHeader(h, p.style))
  return renameHeaders(table, makeUniqueHeaders(styled), (n) =>
    n ? `Renamed ${plural(n, 'column')}` : 'Column names were already tidy',
  )
}

// ---------- Cells ----------

function trimWhitespace(table: Table, p: ParamsOf<'trimWhitespace'>): ActionResult {
  return cellResult(
    table,
    colIndexes(table, p.columns),
    (v) => cleanSpaces(v, p.collapseSpaces),
    (n) => (n ? `Removed extra spaces in ${plural(n, 'cell')}` : 'No extra spaces found'),
  )
}

function replaceMissing(table: Table, p: ParamsOf<'replaceMissing'>): ActionResult {
  const set = new Set(p.placeholders.map((x) => x.trim().toLowerCase()))
  if (set.size === 0 && !p.includeBlank) throw new ActionError('Choose at least one kind of missing value to replace.')
  return cellResult(
    table,
    colIndexes(table, p.columns),
    (v) => {
      if (p.includeBlank && isBlank(v)) return p.replaceWith
      if (set.has(v.trim().toLowerCase())) return p.replaceWith
      return null
    },
    (n) =>
      n
        ? p.replaceWith === ''
          ? `Emptied ${plural(n, 'cell')} that held placeholder text`
          : `Filled ${plural(n, 'cell')} with "${p.replaceWith}"`
        : 'No matching cells found',
  )
}

function changeCase(table: Table, p: ParamsOf<'changeCase'>): ActionResult {
  const fn = {
    title: toTitleCase,
    upper: (v: string) => v.toUpperCase(),
    lower: (v: string) => v.toLowerCase(),
    sentence: toSentenceCase,
  }[p.mode]
  return cellResult(table, [colIndex(table, p.column)], (v) => fn(v), (n) =>
    n ? `Changed capitalization in ${plural(n, 'cell')} of "${p.column}"` : 'Capitalization was already consistent',
  )
}

function mergeValues(table: Table, p: ParamsOf<'mergeValues'>): ActionResult {
  const map = new Map<string, string>()
  for (const g of p.groups) for (const f of g.from) map.set(f, g.to)
  if (map.size === 0) throw new ActionError('Choose at least one group of values to combine.')
  return cellResult(table, [colIndex(table, p.column)], (v) => map.get(v) ?? null, (n) =>
    n ? `Combined ${plural(n, 'value')} in "${p.column}" into consistent names` : 'No matching values found',
  )
}

function formatDates(table: Table, p: ParamsOf<'formatDates'>): ActionResult {
  const skipped: ActionResult['skipped'] = []
  return cellResult(
    table,
    [colIndex(table, p.column)],
    (v, row) => {
      if (isBlank(v)) return null
      const r = readDate(v)
      const d = r && resolveDate(r, p.order)
      if (!r || !d) {
        skipped.push({ rowId: row.id, value: v })
        return null
      }
      return formatDate(d, p.output) + (r.time ? ` ${r.time}` : '')
    },
    (n) => {
      const base = n ? `Changed ${plural(n, 'date')} in "${p.column}" to ${p.output}` : 'All dates were already in this format'
      return skipped.length ? `${base}. ${plural(skipped.length, 'value was', 'values were')} left unchanged because we could not read ${skipped.length === 1 ? 'it' : 'them'} as a date.` : base
    },
    skipped,
  )
}

function cleanNumbers(table: Table, p: ParamsOf<'cleanNumbers'>): ActionResult {
  const skipped: ActionResult['skipped'] = []
  return cellResult(
    table,
    [colIndex(table, p.column)],
    (v, row) => {
      if (isBlank(v)) return null
      const r = readNumber(v, p.decimal)
      if (!r) {
        skipped.push({ rowId: row.id, value: v })
        return null
      }
      return r.value
    },
    (n) => {
      const base = n ? `Turned ${plural(n, 'value')} in "${p.column}" into plain numbers` : 'All numbers were already plain'
      return skipped.length ? `${base}. ${plural(skipped.length, 'value was', 'values were')} left unchanged because ${skipped.length === 1 ? 'it is' : 'they are'} not a plain number.` : base
    },
    skipped,
  )
}

function formatPhones(table: Table, p: ParamsOf<'formatPhones'>): ActionResult {
  const skipped: ActionResult['skipped'] = []
  return cellResult(
    table,
    [colIndex(table, p.column)],
    (v, row) => {
      if (isBlank(v)) return null
      const out = formatPhone(v, p.country, p.format)
      if (out === null) {
        skipped.push({ rowId: row.id, value: v })
        return null
      }
      return out
    },
    (n) => {
      const base = n ? `Reformatted ${plural(n, 'phone number')} in "${p.column}"` : 'Phone numbers were already in this format'
      return skipped.length ? `${base}. ${plural(skipped.length, 'value was', 'values were')} left unchanged because ${skipped.length === 1 ? 'it does' : 'they do'} not look like a complete phone number.` : base
    },
    skipped,
  )
}

function lowercaseEmails(table: Table, p: ParamsOf<'lowercaseEmails'>): ActionResult {
  return cellResult(
    table,
    [colIndex(table, p.column)],
    (v) => (v.includes('@') ? v.trim().toLowerCase() : null),
    (n) => (n ? `Made ${plural(n, 'email address', 'email addresses')} lowercase` : 'Emails were already lowercase'),
  )
}

export function checkValue(v: string, check: ParamsOf<'addCheckColumn'>['check'], dateOrder?: ParamsOf<'addCheckColumn'>['dateOrder']): string {
  if (isBlank(v)) return ''
  switch (check) {
    case 'email': {
      const r = checkEmail(v)
      return r.ok ? 'OK' : `Problem: ${r.reason}`
    }
    case 'phone':
      return looksLikePhone(v) ? 'OK' : 'Problem: not a complete phone number'
    case 'number':
      return readNumber(v, '.') || readNumber(v, ',') ? 'OK' : 'Problem: not a number'
    case 'date': {
      const r = readDate(v)
      if (!r) return 'Problem: not a date we can read'
      if (dateOrder) return resolveDate(r, dateOrder) ? 'OK' : 'Problem: does not fit the chosen date order'
      return isAmbiguous(r) ? 'Unclear: month and day could be swapped' : 'OK'
    }
  }
}

function addCheckColumn(table: Table, p: ParamsOf<'addCheckColumn'>): ActionResult {
  const c = colIndex(table, p.column)
  const name = makeUniqueHeaders([...table.headers, `${p.column} check`]).pop() as string
  const headers = [...table.headers.slice(0, c + 1), name, ...table.headers.slice(c + 1)]
  let problems = 0
  const rows = table.rows.map((r) => {
    const value = checkValue(r.cells[c], p.check, p.dateOrder)
    if (value !== '' && value !== 'OK') problems++
    return { id: r.id, cells: [...r.cells.slice(0, c + 1), value, ...r.cells.slice(c + 1)] }
  })
  const changes = emptyChanges()
  changes.addedColumns = [{ index: c + 1, name }]
  return {
    table: { headers, rows },
    changes,
    affected: 1,
    unit: 'columns',
    summary: `Added a column "${name}" that marks ${plural(problems, 'row')} with a problem`,
    skipped: [],
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function findReplace(table: Table, p: ParamsOf<'findReplace'>): ActionResult {
  if (p.find === '' && !p.wholeCell) throw new ActionError('Type the text you want to find.')
  const cols = colIndexes(table, p.columns)
  let fn: CellFn
  if (p.wholeCell) {
    const target = p.matchCase ? p.find : p.find.toLowerCase()
    fn = (v) => ((p.matchCase ? v : v.toLowerCase()) === target ? p.replace : null)
  } else {
    const re = new RegExp(escapeRegExp(p.find), p.matchCase ? 'g' : 'gi')
    fn = (v) => v.replace(re, () => p.replace)
  }
  return cellResult(table, cols, fn, (n) => (n ? `Replaced text in ${plural(n, 'cell')}` : 'No cells matched'))
}

// ---------- Registry ----------

export const ACTION_IDS: readonly Step['action'][] = [
  'removeDuplicates',
  'removeEmptyRows',
  'removeEmptyColumns',
  'trimWhitespace',
  'cleanHeaders',
  'replaceMissing',
  'changeCase',
  'mergeValues',
  'formatDates',
  'cleanNumbers',
  'formatPhones',
  'lowercaseEmails',
  'addCheckColumn',
  'findReplace',
  'renameColumn',
  'removeColumn',
]

export function runStep(table: Table, step: Step): ActionResult {
  switch (step.action) {
    case 'removeDuplicates':
      return removeDuplicates(table, step.params)
    case 'removeEmptyRows':
      return removeEmptyRows(table)
    case 'removeEmptyColumns':
      return removeEmptyColumns(table)
    case 'trimWhitespace':
      return trimWhitespace(table, step.params)
    case 'cleanHeaders':
      return cleanHeaders(table, step.params)
    case 'replaceMissing':
      return replaceMissing(table, step.params)
    case 'changeCase':
      return changeCase(table, step.params)
    case 'mergeValues':
      return mergeValues(table, step.params)
    case 'formatDates':
      return formatDates(table, step.params)
    case 'cleanNumbers':
      return cleanNumbers(table, step.params)
    case 'formatPhones':
      return formatPhones(table, step.params)
    case 'lowercaseEmails':
      return lowercaseEmails(table, step.params)
    case 'addCheckColumn':
      return addCheckColumn(table, step.params)
    case 'findReplace':
      return findReplace(table, step.params)
    case 'renameColumn':
      return renameColumn(table, step.params)
    case 'removeColumn':
      return removeColumn(table, step.params)
  }
}

/** Column names a step needs to exist before it can run. Empty list = works on any file. */
export function columnsUsed(step: Step): string[] {
  const p = step.params as { column?: string; columns?: string[] }
  if (p.column) return [p.column]
  if (p.columns) return p.columns
  return []
}

/** True if the step deletes rows or columns (shown with an extra confirmation). */
export function isDestructive(step: Step): boolean {
  return ['removeDuplicates', 'removeEmptyRows', 'removeEmptyColumns', 'removeColumn'].includes(step.action)
}
