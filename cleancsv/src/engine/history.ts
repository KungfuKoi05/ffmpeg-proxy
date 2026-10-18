// The cleaning session: the original table (never touched), the list of applied steps,
// and a cursor. Undo moves the cursor back, redo moves it forward, reset moves it to 0.
// Because every step keeps the table it produced (sharing unchanged rows), going back
// restores the exact earlier state instead of trying to reverse each change.

import type { ActionResult, ImportMeta, Rule, Step, Table } from './types'
import { runStep } from './actions'
import { describeStep } from './describe'

export interface HistoryEntry {
  id: number
  step: Step
  label: string
  result: Omit<ActionResult, 'table'>
  /** The table after this step. */
  table: Table
  at: string
}

export interface SessionEvent {
  at: string
  kind: 'imported' | 'applied' | 'undone' | 'redone' | 'reset' | 'recipe'
  label: string
}

export interface Session {
  original: Table
  meta: ImportMeta
  entries: HistoryEntry[]
  /** How many entries are currently applied. */
  cursor: number
  events: SessionEvent[]
  rules: Rule[]
  nextId: number
}

const now = () => new Date().toISOString()

export function createSession(table: Table, meta: ImportMeta): Session {
  return {
    original: table,
    meta,
    entries: [],
    cursor: 0,
    events: [{ at: now(), kind: 'imported', label: `Opened ${meta.fileName}` }],
    rules: [],
    nextId: 1,
  }
}

export function currentTable(s: Session): Table {
  return s.cursor === 0 ? s.original : s.entries[s.cursor - 1].table
}

export function appliedEntries(s: Session): HistoryEntry[] {
  return s.entries.slice(0, s.cursor)
}

export const canUndo = (s: Session) => s.cursor > 0
export const canRedo = (s: Session) => s.cursor < s.entries.length

/** Runs a step without saving it, for previews. Throws ActionError for invalid steps. */
export function previewStep(s: Session, step: Step): ActionResult {
  return runStep(currentTable(s), step)
}

/**
 * Applies a step. If some steps had been undone, they are discarded (like any editor).
 * Pass a result from previewStep to avoid running the step twice; it must have been
 * computed from the current table.
 */
export function applyStep(s: Session, step: Step, precomputed?: ActionResult, eventKind: SessionEvent['kind'] = 'applied'): Session {
  const result = precomputed ?? runStep(currentTable(s), step)
  const { table, ...rest } = result
  const label = describeStep(step)
  const entry: HistoryEntry = { id: s.nextId, step, label, result: rest, table, at: now() }
  return {
    ...s,
    entries: [...s.entries.slice(0, s.cursor), entry],
    cursor: s.cursor + 1,
    nextId: s.nextId + 1,
    events: [...s.events, { at: entry.at, kind: eventKind, label: `${label} — ${rest.summary}` }],
  }
}

export function undo(s: Session): Session {
  if (!canUndo(s)) return s
  const e = s.entries[s.cursor - 1]
  return { ...s, cursor: s.cursor - 1, events: [...s.events, { at: now(), kind: 'undone', label: e.label }] }
}

export function redo(s: Session): Session {
  if (!canRedo(s)) return s
  const e = s.entries[s.cursor]
  return { ...s, cursor: s.cursor + 1, events: [...s.events, { at: now(), kind: 'redone', label: e.label }] }
}

/** Back to the file exactly as it was opened. The steps stay available through redo. */
export function reset(s: Session): Session {
  if (s.cursor === 0) return s
  return { ...s, cursor: 0, events: [...s.events, { at: now(), kind: 'reset', label: 'Went back to the original file' }] }
}

export function setRules(s: Session, rules: Rule[]): Session {
  return { ...s, rules }
}
