// The downloadable change report: a plain-text record of exactly what was changed,
// built from the recorded changes (not from what we intended to change).

import type { Finding } from './types'
import type { Session } from './history'
import { appliedEntries, currentTable } from './history'
import { delimiterName } from './parse'

const show = (v: string) => (v === '' ? '(empty)' : JSON.stringify(v))

export interface ReportOptions {
  exportName: string
  protectedCells: number
  unresolved: Finding[]
  generatedAt?: Date
}

export function buildReport(s: Session, opts: ReportOptions): string {
  const out: string[] = []
  const at = (opts.generatedAt ?? new Date()).toLocaleString('en-US')
  const final = currentTable(s)
  const steps = appliedEntries(s)
  out.push('CleanCSV change report')
  out.push('======================')
  out.push(`Created:        ${at}`)
  out.push(`Original file:  ${s.meta.fileName} (${s.meta.encoding}, ${delimiterName(s.meta.delimiter)}-separated)`)
  out.push(`Cleaned file:   ${opts.exportName}`)
  out.push(`Rows:           ${s.original.rows.length} before, ${final.rows.length} after`)
  out.push(`Columns:        ${s.original.headers.length} before, ${final.headers.length} after`)
  out.push(`Steps applied:  ${steps.length}`)
  out.push('')
  out.push('Row numbers below refer to the original file: row 1 is the first row under the column names.')
  out.push('This report was made on your device. It was not uploaded anywhere.')
  out.push('')

  const renamed = s.meta.originalHeaders
    .map((h, i) => ({ from: h, to: s.original.headers[i] }))
    .filter((x) => x.from !== x.to)
  if (renamed.length || s.meta.warnings.length) {
    out.push('When the file was opened')
    out.push('------------------------')
    for (const w of s.meta.warnings) out.push(`- ${w.message}`)
    for (const r of renamed) out.push(`- Column ${show(r.from)} was named ${show(r.to)}`)
    out.push('')
  }

  if (steps.length === 0) {
    out.push('No cleaning steps were applied. The data is unchanged.')
    out.push('')
  }
  steps.forEach((e, i) => {
    const c = e.result.changes
    out.push(`Step ${i + 1}: ${e.label}`)
    out.push(`Result: ${e.result.summary}`)
    out.push(`Applied: ${new Date(e.at).toLocaleString('en-US')}`)
    for (const h of c.headers) out.push(`  Column renamed: ${show(h.before)} -> ${show(h.after)}`)
    for (const col of c.removedColumns) out.push(`  Column removed: ${show(col.name)}`)
    for (const col of c.addedColumns) out.push(`  Column added: ${show(col.name)}`)
    for (const r of c.removedRows) {
      out.push(`  Row ${r.rowId} removed${r.note ? ` (${r.note})` : ''}: ${r.cells.map(show).join(', ')}`)
    }
    for (const ch of c.cells) out.push(`  Row ${ch.rowId}, ${show(ch.column)}: ${show(ch.before)} -> ${show(ch.after)}`)
    if (e.result.skipped.length) {
      out.push(`  Left unchanged (${e.result.skipped.length}):`)
      for (const sk of e.result.skipped) out.push(`    Row ${sk.rowId}: ${show(sk.value)}`)
    }
    out.push('')
  })

  out.push('When the file was downloaded')
  out.push('----------------------------')
  out.push(
    opts.protectedCells > 0
      ? `- ${opts.protectedCells} cell(s) that start with =, +, -, or @ got an apostrophe (') in front so spreadsheet apps show them as text instead of running them as formulas.`
      : '- No cells needed formula protection.',
  )
  out.push('')

  out.push(`Still worth checking (${opts.unresolved.length})`)
  out.push('------------------')
  if (opts.unresolved.length === 0) out.push('- Nothing. No open warnings.')
  for (const f of opts.unresolved) out.push(`- ${f.title}. ${f.detail}`)
  out.push('')

  const undone = s.events.filter((e) => e.kind === 'undone' || e.kind === 'redone' || e.kind === 'reset')
  if (undone.length) {
    out.push('Undo and redo history')
    out.push('---------------------')
    for (const e of undone) out.push(`- ${new Date(e.at).toLocaleTimeString('en-US')}: ${e.kind} — ${e.label}`)
    out.push('')
  }
  return out.join('\n')
}
