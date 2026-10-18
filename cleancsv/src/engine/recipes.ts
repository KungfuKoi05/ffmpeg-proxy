// Saved recipes: a list of cleaning steps (and checks) that can be run again on a
// similar file. Before running, every step is tried on a copy of the new file so the
// user sees what each one would do, and any step that needs a missing column is
// explained instead of being run blindly.

import type { Recipe, Rule, Step, Table } from './types'
import { ACTION_IDS, ActionError, columnsUsed, runStep } from './actions'
import { describeStep } from './describe'

export interface RecipeCheck {
  step: Step
  label: string
  status: 'ok' | 'missing-columns' | 'error'
  missing: string[]
  /** What the step would do on this file, e.g. "Removed 3 duplicate rows". */
  summary: string
  affected: number
}

export interface RecipePlan {
  checks: RecipeCheck[]
  runnable: number
  /** Columns the original file had that this file does not. */
  missingColumns: string[]
  /** Columns this file has that the original did not. */
  newColumns: string[]
  ruleColumnsMissing: string[]
}

export function newRecipe(name: string, steps: Step[], rules: Rule[], sourceColumns: string[]): Recipe {
  const t = new Date().toISOString()
  return {
    id: `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || 'Untitled recipe',
    createdAt: t,
    updatedAt: t,
    steps,
    rules,
    sourceColumns,
  }
}

/** Dry-runs the recipe on a file. Steps that cannot run are skipped in the dry run and reported. */
export function checkRecipe(table: Table, recipe: Recipe): RecipePlan {
  let t = table
  const checks: RecipeCheck[] = []
  for (const step of recipe.steps) {
    const label = describeStep(step)
    const missing = columnsUsed(step).filter((c) => !t.headers.includes(c))
    if (missing.length > 0) {
      checks.push({ step, label, status: 'missing-columns', missing, summary: '', affected: 0 })
      continue
    }
    try {
      const r = runStep(t, step)
      t = r.table
      checks.push({ step, label, status: 'ok', missing: [], summary: r.summary, affected: r.affected })
    } catch (e) {
      checks.push({
        step,
        label,
        status: 'error',
        missing: [],
        summary: e instanceof ActionError ? e.message : 'This step could not run on this file.',
        affected: 0,
      })
    }
  }
  return {
    checks,
    runnable: checks.filter((c) => c.status === 'ok').length,
    missingColumns: recipe.sourceColumns.filter((c) => !table.headers.includes(c)),
    newColumns: table.headers.filter((c) => !recipe.sourceColumns.includes(c)),
    ruleColumnsMissing: recipe.rules.map((r) => r.column).filter((c) => !t.headers.includes(c)),
  }
}

const isStr = (x: unknown): x is string => typeof x === 'string'
const isStrArr = (x: unknown): x is string[] => Array.isArray(x) && x.every(isStr)
const RULE_KINDS = ['required', 'unique', 'email', 'number', 'date', 'allowed']

function isStep(x: unknown): boolean {
  if (!x || typeof x !== 'object') return false
  const s = x as { action?: unknown; params?: unknown }
  if (!isStr(s.action) || !(ACTION_IDS as readonly string[]).includes(s.action)) return false
  if (!s.params || typeof s.params !== 'object' || Array.isArray(s.params)) return false
  const p = s.params as Record<string, unknown>
  if ('column' in p && !isStr(p.column)) return false
  if ('columns' in p && !isStrArr(p.columns)) return false
  if ('placeholders' in p && !isStrArr(p.placeholders)) return false
  if (s.action === 'mergeValues') {
    if (!Array.isArray(p.groups) || !p.groups.every((g) => g && isStrArr((g as { from?: unknown }).from) && isStr((g as { to?: unknown }).to))) return false
  }
  // Every other field must be plain text, true/false, or a number.
  return Object.entries(p).every(([k, v]) => ['columns', 'placeholders', 'groups'].includes(k) || ['string', 'boolean', 'number'].includes(typeof v))
}

function isRule(x: unknown): boolean {
  if (!x || typeof x !== 'object') return false
  const r = x as { id?: unknown; column?: unknown; kind?: unknown; allowed?: unknown }
  return isStr(r.id) && isStr(r.column) && isStr(r.kind) && RULE_KINDS.includes(r.kind) && (r.allowed === undefined || isStrArr(r.allowed))
}

/** Shape check for recipes loaded from storage or imported from a file, so a damaged or hand-edited one cannot crash the app. */
export function isRecipe(x: unknown): x is Recipe {
  if (!x || typeof x !== 'object') return false
  const r = x as Recipe
  return (
    isStr(r.id) &&
    isStr(r.name) &&
    r.name.length <= 200 &&
    Array.isArray(r.steps) &&
    r.steps.length <= 500 &&
    r.steps.every(isStep) &&
    Array.isArray(r.rules) &&
    r.rules.every(isRule) &&
    isStrArr(r.sourceColumns)
  )
}
