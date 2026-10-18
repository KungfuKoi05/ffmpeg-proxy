import { describe, expect, it } from 'vitest'
import { analyze, unresolvedCount } from './analyze'
import { applyStep, canRedo, canUndo, createSession, currentTable, previewStep, redo, reset, undo } from './history'
import { checkRecipe, isRecipe, newRecipe } from './recipes'
import { buildReport } from './report'
import { defaultExportName, ensureCsvExtension, sanitizeFileName, toCSV, verifyExport, DEFAULT_EXPORT, countFormulaCells } from './export'
import { parseText } from './parse'
import { SAMPLE_CSV } from './sample'
import type { Step } from './types'
import { freeze, grid, load } from './test-helpers'

const trim: Step = { action: 'trimWhitespace', params: { columns: [], collapseSpaces: false } }
const dedupe: Step = { action: 'removeDuplicates', params: { columns: [], ignoreCase: false, ignoreSpaces: false, keep: 'first' } }

function session(csv: string) {
  const { table, meta } = load(csv)
  return createSession(freeze(table), meta)
}

describe('finding problems', () => {
  it('counts exact duplicate rows', () => {
    const { findings } = analyze(load('a,b\n1,2\n1,2\n3,4\n1,2\n').table)
    const f = findings.find((x) => x.id === 'duplicate-rows')!
    expect(f.count).toBe(2)
    expect(f.rowIds).toEqual([2, 4])
    expect(f.basis).toBe('confirmed')
  })

  it('reports near-duplicates separately, as a guess', () => {
    const { findings } = analyze(load('a,b\nJane,Paris\njane ,PARIS\n').table)
    expect(findings.find((x) => x.id === 'duplicate-rows')).toBeUndefined()
    expect(findings.find((x) => x.id === 'near-duplicate-rows')?.basis).toBe('guess')
  })

  it('finds empty rows', () => {
    const { findings } = analyze(load('a,b\n1,2\n,\n3,4\n').table)
    expect(findings.find((x) => x.id === 'empty-rows')?.rowIds).toEqual([2])
  })

  it('finds extra spaces and missing-value placeholders', () => {
    const { findings } = analyze(load('name,note\n Ada ,N/A\nGrace,NULL\nLinus,None\n').table)
    expect(findings.find((x) => x.id === 'extra-spaces')?.count).toBe(1)
    const ph = findings.find((x) => x.id === 'placeholders')!
    expect(ph.count).toBe(3)
    // Only the strong placeholders are pre-selected; "None" waits for the user.
    expect(ph.fix?.action === 'replaceMissing' && ph.fix.params.placeholders.sort()).toEqual(['N/A', 'NULL'])
  })

  it('treats ordinary empty cells as information, not errors', () => {
    const { findings } = analyze(load('name,phone2\nAda,\nGrace,555-010-0101\nLinus,\n').table)
    const f = findings.find((x) => x.id === 'blank-cells')!
    expect(f.severity).toBe('info')
    expect(f.needsChoice).toBe('fillValue')
  })

  it('flags invalid emails without changing them', () => {
    const t = load('Email\nada@example.com\ngrace@example\nlinus.example.com\n').table
    const f = analyze(t).findings.find((x) => x.id === 'emails:Email')!
    expect(f.count).toBe(2)
    expect(f.rowIds).toEqual([2, 3])
    expect(f.fix?.action).toBe('addCheckColumn')
  })

  it('insists on a choice for ambiguous dates with no evidence', () => {
    const t = load('Signup Date\n03/04/2026\n05/06/2026\n07/08/2026\n').table
    const f = analyze(t).findings.find((x) => x.id === 'dates:Signup Date')!
    expect(f.needsChoice).toBe('dateOrder')
    expect(f.severity).toBe('important')
  })

  it('suggests month/day when the column proves it', () => {
    const t = load('Signup Date\n03/04/2026\n03/25/2026\n2026-01-01\n').table
    const f = analyze(t).findings.find((x) => x.id === 'dates:Signup Date')!
    expect(f.needsChoice).toBeUndefined()
    expect(f.fix?.action === 'formatDates' && f.fix.params.order).toBe('MDY')
    expect(f.hint).toMatch(/month\/day\/year/)
  })

  it('finds dates that cannot be understood', () => {
    const t = load('Date\n2026-01-01\n2026-02-30\nsoon\n2026-01-03\n').table
    expect(analyze(t).findings.find((x) => x.id === 'bad-dates:Date')?.count).toBe(2)
  })

  it('finds categories written different ways', () => {
    const t = load('Category\nToys\ntoys\nBooks\nBooks\nTOYS\nBooks\nGames\nGames\n').table
    const f = analyze(t).findings.find((x) => x.id === 'similar:Category')!
    expect(f.clusters?.[0].values.map((v) => v.value).sort()).toEqual(['TOYS', 'Toys', 'toys'])
    expect(f.basis).toBe('guess')
  })

  it('flags cells that spreadsheets could run as formulas', () => {
    const f = analyze(load('a\n=1+1\nok\n').table).findings.find((x) => x.id === 'formulas')!
    expect(f.severity).toBe('important')
    expect(f.fixAtExport).toBe('protectFormulas')
  })

  it("applies the user's own rules", () => {
    const t = load('sku,qty\nA1,3\n,4\nA1,x\n').table
    const { findings } = analyze(t, [
      { id: '1', column: 'sku', kind: 'required' },
      { id: '2', column: 'sku', kind: 'unique' },
      { id: '3', column: 'qty', kind: 'number' },
      { id: '4', column: 'missing', kind: 'required' },
    ])
    expect(findings.find((f) => f.id === 'rule:1')?.rowIds).toEqual([2])
    expect(findings.find((f) => f.id === 'rule:2')?.rowIds).toEqual([3])
    expect(findings.find((f) => f.id === 'rule:3')?.rowIds).toEqual([3])
    expect(findings.find((f) => f.id === 'rule:4')?.title).toMatch(/needs a column/)
    expect(findings.every((f) => f.id.startsWith('rule:') ? f.basis === 'rule' : true)).toBe(true)
  })

  it('finds every problem planted in the sample file', () => {
    const r = parseText(SAMPLE_CSV)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const ids = analyze(r.table).findings.map((f) => f.id)
    expect(ids).toEqual(
      expect.arrayContaining([
        'duplicate-rows',
        'near-duplicate-rows',
        'empty-rows',
        'extra-spaces',
        'header-spaces',
        'placeholders',
        'formulas',
        'emails:Email ',
        'bad-dates:Signup Date',
        'dates:Signup Date',
        'similar:Category',
        'similar:Country',
        'case:Name',
        'numbers:Order Total',
        'phones:Phone',
      ]),
    )
  })

  it('profiles columns in plain numbers', () => {
    const { profiles } = analyze(load('Email,n\na@example.com,1\n,2\nbad,3\na@example.com,4\n').table)
    expect(profiles[0]).toMatchObject({ name: 'Email', total: 4, filled: 3, empty: 1, unique: 2, repeatedValues: 1, type: 'email', invalid: 1 })
    expect(profiles[1].type).toBe('number')
  })
})

describe('undo, redo and reset', () => {
  it('undo and redo move between exact states', () => {
    let s = session('a\n x \nx\n')
    const original = grid(currentTable(s))
    s = applyStep(s, trim)
    const trimmed = grid(currentTable(s))
    expect(trimmed).toEqual([['a'], ['x'], ['x']])
    s = applyStep(s, dedupe)
    expect(grid(currentTable(s))).toEqual([['a'], ['x']])
    s = undo(s)
    expect(grid(currentTable(s))).toEqual(trimmed)
    s = undo(s)
    expect(grid(currentTable(s))).toEqual(original)
    expect(canUndo(s)).toBe(false)
    s = redo(s)
    s = redo(s)
    expect(grid(currentTable(s))).toEqual([['a'], ['x']])
    expect(canRedo(s)).toBe(false)
  })

  it('applying a new step after undo discards the undone steps', () => {
    let s = session('a\n x \n')
    s = applyStep(s, trim)
    s = undo(s)
    s = applyStep(s, { action: 'renameColumn', params: { column: 'a', to: 'b' } })
    expect(s.entries).toHaveLength(1)
    expect(canRedo(s)).toBe(false)
    expect(grid(currentTable(s))).toEqual([['b'], [' x ']])
  })

  it('reset restores the exact original data, and can be redone', () => {
    let s = session('name\n  Ada  \nAda\n')
    const original = currentTable(s)
    s = applyStep(s, trim)
    s = applyStep(s, dedupe)
    s = reset(s)
    expect(currentTable(s)).toBe(original)
    expect(grid(currentTable(s))).toEqual([['name'], ['  Ada  '], ['Ada']])
    s = redo(s)
    expect(grid(currentTable(s))).toEqual([['name'], ['Ada'], ['Ada']])
    expect(s.events.map((e) => e.kind)).toEqual(['imported', 'applied', 'applied', 'reset', 'redone'])
  })

  it('the preview is exactly what gets applied', () => {
    const s = session('a\n x \n')
    const p = previewStep(s, trim)
    const after = applyStep(s, trim, p)
    expect(currentTable(after)).toBe(p.table)
    expect(currentTable(s).rows[0].cells[0]).toBe(' x ')
  })
})

describe('exporting', () => {
  it('writes a CSV that reads back to exactly the same table', () => {
    const { table } = load('name,note\n"Smith, John","He said ""hi"""\nAda,"two\nlines"\n,  spaced  \n名前,🎉\n')
    const out = toCSV(table, DEFAULT_EXPORT)
    const back = parseText(out.text)
    expect(back.ok && grid(back.table)).toEqual(grid(table))
    expect(verifyExport(out.text, table, DEFAULT_EXPORT)).toEqual({ ok: true })
  })

  it('protects formula-like cells only when asked, and counts them', () => {
    const { table } = load('a,b\n=1+1,-5\n@SUM(A1),ok\n')
    expect(countFormulaCells(table)).toBe(2)
    const safe = toCSV(table, DEFAULT_EXPORT)
    expect(safe.protectedCells).toBe(2)
    expect(safe.text).toContain("'=1+1")
    expect(safe.text).toContain("'@SUM(A1)")
    expect(safe.text).toContain('-5')
    expect(verifyExport(safe.text, table, DEFAULT_EXPORT)).toEqual({ ok: true })
    const raw = toCSV(table, { ...DEFAULT_EXPORT, protectFormulas: false })
    expect(raw.protectedCells).toBe(0)
    expect(raw.text).toContain('=1+1')
    expect(raw.text).not.toContain("'=1+1")
  })

  it('can add a byte-order mark and use other separators', () => {
    const { table } = load('a,b\n1;2,3\n')
    const out = toCSV(table, { ...DEFAULT_EXPORT, delimiter: ';', bom: true })
    expect(out.text.startsWith('﻿a;b')).toBe(true)
    expect(out.text).toContain('"1;2";3')
  })

  it('detects an export that does not match', () => {
    const { table } = load('a\n1\n2\n')
    expect(verifyExport('a\r\n1\r\n', table, DEFAULT_EXPORT).ok).toBe(false)
  })

  it('makes safe file names', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('etc-passwd')
    expect(sanitizeFileName('a<b>:c"d|e?f*g')).toBe('a-b-c-d-e-f-g')
    expect(sanitizeFileName('CON')).toBe('file')
    expect(sanitizeFileName('   ')).toBe('file')
    expect(defaultExportName('Customers 2026.csv')).toBe('cleaned-Customers 2026.csv')
    expect(ensureCsvExtension('report')).toBe('report.csv')
    expect(ensureCsvExtension('x/y.csv')).toBe('x-y.csv')
  })
})

describe('recipes', () => {
  const recipeFrom = (steps: Step[], cols: string[]) => newRecipe('My recipe', steps, [], cols)

  it('replays saved steps on a similar file', () => {
    let s = session('Name ,Category\n ada ,toys\nAda,Toys\n')
    s = applyStep(s, { action: 'cleanHeaders', params: { style: 'tidy' } })
    s = applyStep(s, trim)
    s = applyStep(s, { action: 'changeCase', params: { column: 'Name', mode: 'title' } })
    s = applyStep(s, dedupe)
    const recipe = recipeFrom(s.entries.map((e) => e.step), s.original.headers as string[])
    expect(isRecipe(JSON.parse(JSON.stringify(recipe)))).toBe(true)

    const next = load('Name ,Category\n bob ,Books\nBob,Books\ncarol,Toys\n').table
    const plan = checkRecipe(next, recipe)
    expect(plan.checks.map((c) => c.status)).toEqual(['ok', 'ok', 'ok', 'ok'])
    expect(plan.checks[3].summary).toBe('Removed 1 duplicate row')

    let s2 = createSession(next, load('Name ,Category\n bob ,Books\n').meta)
    for (const c of plan.checks) s2 = applyStep(s2, c.step, undefined, 'recipe')
    expect(grid(currentTable(s2))).toEqual([['Name', 'Category'], ['Bob', 'Books'], ['Carol', 'Toys']])
  })

  it('explains a missing column instead of running blindly', () => {
    const recipe = recipeFrom([trim, { action: 'mergeValues', params: { column: 'Category', groups: [{ from: ['toys'], to: 'Toys' }] } }], ['Name', 'Category'])
    const plan = checkRecipe(load('Name,Type\nA,b\n').table, recipe)
    expect(plan.checks[1].status).toBe('missing-columns')
    expect(plan.checks[1].missing).toEqual(['Category'])
    expect(plan.runnable).toBe(1)
    expect(plan.missingColumns).toEqual(['Category'])
    expect(plan.newColumns).toEqual(['Type'])
  })

  it('rejects hand-edited recipes that could crash the app', () => {
    const base = { id: 'x', name: 'y', rules: [], sourceColumns: [], steps: [] }
    expect(isRecipe(base)).toBe(true)
    expect(isRecipe({ ...base, steps: [{ action: 'changeCase', params: { column: 5, mode: 'upper' } }] })).toBe(false)
    expect(isRecipe({ ...base, steps: [{ action: 'mergeValues', params: { column: 'a', groups: [{ from: 'x', to: 'y' }] } }] })).toBe(false)
    expect(isRecipe({ ...base, steps: [{ action: 'trimWhitespace', params: { columns: [], collapseSpaces: { evil: true } } }] })).toBe(false)
    expect(isRecipe({ ...base, rules: [{ id: '1', column: 'a', kind: 'allowed', allowed: 'not a list' }] })).toBe(false)
    expect(isRecipe({ ...base, rules: [{ id: '1', column: 'a', kind: 'explode' }] })).toBe(false)
  })

  it('rejects damaged saved recipes', () => {
    expect(isRecipe({ id: 'x', name: 'y', steps: [{ action: 'deleteEverything', params: {} }], rules: [], sourceColumns: [] })).toBe(false)
    expect(isRecipe(null)).toBe(false)
  })
})

describe('change report', () => {
  it('lists every change that was actually made', () => {
    let s = session('name\n  Ada  \nAda\n=1+1\n')
    s = applyStep(s, trim)
    s = applyStep(s, dedupe)
    const final = currentTable(s)
    const exp = toCSV(final, DEFAULT_EXPORT)
    const report = buildReport(s, {
      exportName: 'cleaned-data.csv',
      protectedCells: exp.protectedCells,
      unresolved: analyze(final).findings.filter((f) => f.severity !== 'info'),
    })
    expect(report).toContain('Rows:           3 before, 2 after')
    expect(report).toContain('Row 1, "name": "  Ada  " -> "Ada"')
    expect(report).toContain('Row 2 removed (same as row 1): "Ada"')
    expect(report).toMatch(/1 cell\(s\) that start with/)
    expect(unresolvedCount(analyze(final).findings)).toBeGreaterThan(0)
  })
})
