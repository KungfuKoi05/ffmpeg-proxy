// Core data shapes shared by the cleaning engine and the UI.
// Every cell is kept as text, exactly as it appeared in the file. Nothing is converted
// to numbers or dates unless the user applies a fix that does so.

export interface Row {
  /** Position of this row in the original file, counting the first row below the header as 1. Never changes. */
  readonly id: number
  readonly cells: readonly string[]
}

export interface Table {
  readonly headers: readonly string[]
  readonly rows: readonly Row[]
}

export type Severity = 'important' | 'check' | 'info'

/**
 * confirmed: we counted it and it is certainly true (e.g. two rows are identical).
 * guess: a pattern-based guess that may be wrong (e.g. "this column looks like dates").
 * rule: the user asked us to check this.
 */
export type Basis = 'confirmed' | 'guess' | 'rule'

export interface ParseWarning {
  kind:
    | 'unclosed-quote'
    | 'bad-quote'
    | 'extra-cells'
    | 'missing-cells'
    | 'encoding-fallback'
    | 'renamed-headers'
    | 'replacement-characters'
    | 'large-file'
  severity: Severity
  message: string
  /** Row ids affected, if known (may be capped). */
  rows?: number[]
  /** When true, the user must confirm before continuing because the data may be read wrongly. */
  blocking?: boolean
}

export type Delimiter = ',' | ';' | '\t' | '|'

export interface ImportMeta {
  fileName: string
  fileSize: number
  encoding: string
  delimiter: Delimiter
  rowCount: number
  columnCount: number
  hadBom: boolean
  lineEnding: '\r\n' | '\n' | '\r'
  /** Header names exactly as they were in the file, before blank or repeated names were made unique. */
  originalHeaders: string[]
  warnings: ParseWarning[]
}

export type ParseResult =
  | { ok: true; table: Table; meta: ImportMeta }
  | { ok: false; error: { title: string; message: string } }

export interface CellChange {
  rowId: number
  column: string
  before: string
  after: string
}

export interface ChangeSet {
  cells: CellChange[]
  /** `note` explains why, e.g. "same as row 4". */
  removedRows: { rowId: number; cells: readonly string[]; note?: string }[]
  headers: { index: number; before: string; after: string }[]
  removedColumns: { index: number; name: string }[]
  addedColumns: { index: number; name: string }[]
}

export type HeaderStyle = 'tidy' | 'title' | 'snake' | 'lower'
export type CaseMode = 'title' | 'upper' | 'lower' | 'sentence'
export type DateOrder = 'MDY' | 'DMY' | 'YMD'
export type DateOutput = 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'D MMM YYYY' | 'MMM D, YYYY'
export type PhoneFormat = 'E164' | 'INTERNATIONAL' | 'NATIONAL'
export type CheckKind = 'email' | 'phone' | 'date' | 'number'

/** One cleaning step. Columns are referred to by name so steps can be saved and replayed on another file. */
export type Step =
  | {
      action: 'removeDuplicates'
      params: { columns: string[]; ignoreCase: boolean; ignoreSpaces: boolean; keep: 'first' | 'last' }
    }
  | { action: 'removeEmptyRows'; params: Record<string, never> }
  | { action: 'removeEmptyColumns'; params: Record<string, never> }
  | { action: 'trimWhitespace'; params: { columns: string[]; collapseSpaces: boolean } }
  | { action: 'cleanHeaders'; params: { style: HeaderStyle } }
  | {
      action: 'replaceMissing'
      params: { columns: string[]; placeholders: string[]; includeBlank: boolean; replaceWith: string }
    }
  | { action: 'changeCase'; params: { column: string; mode: CaseMode } }
  | { action: 'mergeValues'; params: { column: string; groups: { from: string[]; to: string }[] } }
  | { action: 'formatDates'; params: { column: string; order: DateOrder; output: DateOutput } }
  | { action: 'cleanNumbers'; params: { column: string; decimal: '.' | ',' } }
  | { action: 'formatPhones'; params: { column: string; country: string; format: PhoneFormat } }
  | { action: 'lowercaseEmails'; params: { column: string } }
  | { action: 'addCheckColumn'; params: { column: string; check: CheckKind; dateOrder?: DateOrder } }
  | {
      action: 'findReplace'
      params: { columns: string[]; find: string; replace: string; matchCase: boolean; wholeCell: boolean }
    }
  | { action: 'renameColumn'; params: { column: string; to: string } }
  | { action: 'removeColumn'; params: { column: string } }

export type ActionId = Step['action']
export type StepOf<A extends ActionId> = Extract<Step, { action: A }>
export type ParamsOf<A extends ActionId> = StepOf<A>['params']

export interface ActionResult {
  table: Table
  changes: ChangeSet
  /** Number of cells, rows or columns changed (whichever the action works on). */
  affected: number
  unit: 'cells' | 'rows' | 'columns'
  /** Plain-English one-line summary of what happened, e.g. "Removed 124 duplicate rows". */
  summary: string
  /** Values the action could not handle and left unchanged, e.g. dates it could not understand. */
  skipped: { rowId: number; value: string }[]
}

export interface Finding {
  /** Stable id, so the UI can keep track of a finding between re-checks. */
  id: string
  severity: Severity
  basis: Basis
  title: string
  detail: string
  why: string
  suggestion: string
  count: number
  unit: 'rows' | 'cells' | 'columns' | 'values'
  column?: string
  /** Rows the user can jump to with "Show these rows". */
  rowIds?: number[]
  /** A suggested fix. Absent when the right fix depends on the user (or the problem is informational). */
  fix?: Step
  examples?: string[]
  /** When the fix happens at download time instead of as a cleaning step. */
  fixAtExport?: 'protectFormulas'
  /** The fix cannot be applied until the user makes this choice (we will not guess). */
  needsChoice?: 'dateOrder' | 'decimal' | 'fillValue' | 'mergeGroups'
  /** Plain-English reason for the suggested settings, e.g. why we think dates are day-first. */
  hint?: string
  /** For "similar values" findings: the groups the user can tick. */
  clusters?: import('./clusters').ValueCluster[]
}

export type RuleKind = 'required' | 'unique' | 'email' | 'number' | 'date' | 'allowed'

export interface Rule {
  id: string
  column: string
  kind: RuleKind
  /** For 'allowed': the only values this column may contain. */
  allowed?: string[]
}

export type ColumnType = 'empty' | 'number' | 'date' | 'email' | 'phone' | 'yesno' | 'category' | 'id' | 'text'

export interface ColumnProfile {
  name: string
  index: number
  total: number
  filled: number
  empty: number
  unique: number
  /** Number of distinct non-empty values that appear on more than one row. */
  repeatedValues: number
  type: ColumnType
  /** How many non-empty values fit the guessed type, 0..1. */
  typeConfidence: number
  topValues: { value: string; count: number }[]
  /** For email/date/number/phone columns: how many filled cells do not fit. */
  invalid: number
}

export interface Recipe {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  steps: Step[]
  rules: Rule[]
  /** Column names of the file the recipe was made from, so a mismatch can be explained later. */
  sourceColumns: string[]
}
