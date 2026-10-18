// Finds problems in a table and explains them in plain English. Every number shown to the
// user is counted from the actual data. Pattern-based guesses are labelled as guesses.

import type { ColumnProfile, Finding, Rule, Severity, Table } from './types'
import { hasEdgeSpace, hasRepeatedSpace, isBlank, isFormulaLike, plural } from './values'
import { cCase as caseStyle, cDate as readDate, cEmail as checkEmail, cNumber as readNumber, cPhone as looksLikePhone, cPlaceholder as placeholderStrength } from './cached'
import { columnValues, countValues, profileColumn } from './profile'
import { summarizeDates, suggestOrder } from './dates'
import { suggestDecimal } from './numbers'
import { phoneStyle } from './phones'
import { findClusters } from './clusters'
import { styleHeader } from './actions'

export interface Analysis {
  profiles: ColumnProfile[]
  findings: Finding[]
}

const ROW_CAP = 5000
const quote = (v: string) => `"${v}"`
const cap = (ids: number[]) => (ids.length > ROW_CAP ? ids.slice(0, ROW_CAP) : ids)
const severityRank: Record<Severity, number> = { important: 0, check: 1, info: 2 }

function examples(values: Iterable<string>, n = 4): string[] {
  const out: string[] = []
  for (const v of values) {
    if (out.length >= n) break
    if (!out.includes(v)) out.push(v)
  }
  return out
}

function rowKey(cells: readonly string[]): string {
  return cells.join('\u0000')
}

function looseKey(cells: readonly string[]): string {
  let out = ''
  for (let i = 0; i < cells.length; i++) {
    const v = cells[i]
    out += (i ? '\u0000' : '') + (/\s\s|^\s|\s$|[\t\n\r\u00a0]/.test(v) ? v.trim().replace(/\s+/g, ' ') : v).toLowerCase()
  }
  return out
}

function headerClass(h: string): string {
  if (/^[a-z0-9]+(_[a-z0-9]+)*$/.test(h)) return 'snake'
  if (/^[a-z]+([A-Z][a-z0-9]*)+$/.test(h)) return 'camel'
  if (/^[A-Z0-9_ ]+$/.test(h) && /[A-Z]{2}/.test(h)) return 'upper'
  if (/^(\p{Lu}[\p{Ll}\p{N}]*|\p{N}+)([ ](\p{Lu}[\p{Ll}\p{N}]*|\p{N}+|[A-Z]{2,}))*$/u.test(h)) return 'title'
  if (/^[\p{Ll}\p{N} ]+$/u.test(h)) return 'lower'
  return 'other'
}

export function analyze(table: Table, rules: Rule[] = []): Analysis {
  const findings: Finding[] = []
  const { headers, rows } = table
  const columns = headers.map((_, c) => columnValues(table, c))
  const counts = columns.map(countValues)
  const profiles = headers.map((_, c) => profileColumn(table, c, columns[c], counts[c]))

  // ---------- Whole rows ----------
  const emptyRowIds: number[] = []
  const exactSeen = new Map<string, number>()
  const exactDupes: number[] = []
  const looseSeen = new Map<string, number>()
  const nearDupes: number[] = []
  const exactDupeSet = new Set<number>()
  const emptyRowSet = new Set<number>()
  for (const row of rows) {
    if (row.cells.every(isBlank)) {
      emptyRowIds.push(row.id)
      emptyRowSet.add(row.id)
      continue
    }
    const k = rowKey(row.cells)
    if (exactSeen.has(k)) {
      exactDupes.push(row.id)
      exactDupeSet.add(row.id)
    } else exactSeen.set(k, row.id)
    const lk = looseKey(row.cells)
    if (looseSeen.has(lk)) {
      if (!exactDupeSet.has(row.id)) nearDupes.push(row.id)
    } else looseSeen.set(lk, row.id)
  }

  const nearDupeSet = new Set(nearDupes)
  if (exactDupes.length > 0) {
    findings.push({
      id: 'duplicate-rows',
      severity: 'important',
      basis: 'confirmed',
      title: `${plural(exactDupes.length, 'duplicate row')}`,
      detail: `${plural(exactDupes.length, 'row is an exact copy', 'rows are exact copies')} of an earlier row. Every cell matches.`,
      why: 'Duplicates make totals and counts wrong, and can mean the same customer gets two emails or the same order is counted twice.',
      suggestion: 'Remove the copies and keep the first one of each.',
      count: exactDupes.length,
      unit: 'rows',
      rowIds: cap(exactDupes),
      fix: { action: 'removeDuplicates', params: { columns: [], ignoreCase: false, ignoreSpaces: false, keep: 'first' } },
    })
  }
  if (nearDupes.length > 0) {
    findings.push({
      id: 'near-duplicate-rows',
      severity: 'check',
      basis: 'guess',
      title: `${plural(nearDupes.length, 'row looks', 'rows look')} like a duplicate`,
      detail: `${plural(nearDupes.length, 'row matches', 'rows match')} an earlier row if you ignore capital letters and extra spaces (for example "Jane Doe" and "jane doe ").`,
      why: 'These are probably the same record entered twice, but they are not identical, so check before removing them.',
      suggestion: 'Preview which rows would be removed, then decide.',
      count: nearDupes.length,
      unit: 'rows',
      rowIds: cap(nearDupes),
      fix: { action: 'removeDuplicates', params: { columns: [], ignoreCase: true, ignoreSpaces: true, keep: 'first' } },
    })
  }
  if (emptyRowIds.length > 0) {
    findings.push({
      id: 'empty-rows',
      severity: 'check',
      basis: 'confirmed',
      title: `${plural(emptyRowIds.length, 'empty row')}`,
      detail: `${plural(emptyRowIds.length, 'row has', 'rows have')} no values at all.`,
      why: 'Empty rows can break imports into other tools and make row counts wrong.',
      suggestion: 'Remove the empty rows.',
      count: emptyRowIds.length,
      unit: 'rows',
      rowIds: cap(emptyRowIds),
      fix: { action: 'removeEmptyRows', params: {} },
    })
  }

  // ---------- Columns and headers ----------
  const emptyCols = profiles.filter((p) => p.type === 'empty')
  if (emptyCols.length > 0 && emptyCols.length < headers.length) {
    findings.push({
      id: 'empty-columns',
      severity: 'info',
      basis: 'confirmed',
      title: `${plural(emptyCols.length, 'empty column')}`,
      detail: `${emptyCols.map((p) => quote(p.name)).join(', ')} ${emptyCols.length === 1 ? 'has' : 'have'} a name but no values in any row.`,
      why: 'Empty columns are harmless, but they add clutter. Keep them if another tool expects them.',
      suggestion: 'Remove them if you do not need them.',
      count: emptyCols.length,
      unit: 'columns',
      fix: { action: 'removeEmptyColumns', params: {} },
    })
  }

  const spacedHeaders = headers.filter((h) => hasEdgeSpace(h) || hasRepeatedSpace(h))
  if (spacedHeaders.length > 0) {
    findings.push({
      id: 'header-spaces',
      severity: 'check',
      basis: 'confirmed',
      title: `${plural(spacedHeaders.length, 'column name has', 'column names have')} extra spaces`,
      detail: `${spacedHeaders.map((h) => quote(h)).join(', ')} ${spacedHeaders.length === 1 ? 'has' : 'have'} spaces at the start, at the end, or doubled.`,
      why: 'Another program may not find a column called "Email " when it looks for "Email".',
      suggestion: 'Tidy the column names.',
      count: spacedHeaders.length,
      unit: 'columns',
      examples: spacedHeaders.slice(0, 4),
      fix: { action: 'cleanHeaders', params: { style: 'tidy' } },
    })
  } else if (headers.length >= 3) {
    const classes = new Set(headers.map(headerClass))
    if (classes.size > 1) {
      const changing = headers.filter((h) => styleHeader(h, 'title') !== h)
      if (changing.length > 0) {
        findings.push({
          id: 'header-style',
          severity: 'info',
          basis: 'confirmed',
          title: `${plural(changing.length, 'column name uses', 'column names use')} a different style`,
          detail: `Column names are written in mixed styles, for example ${examples(changing, 3).map(quote).join(', ')}.`,
          why: 'Consistent names are easier to read and to match when you combine files.',
          suggestion: 'Pick one style for all column names.',
          count: changing.length,
          unit: 'columns',
          examples: changing.slice(0, 4),
          fix: { action: 'cleanHeaders', params: { style: 'title' } },
        })
      }
    }
  }

  // ---------- Cells everywhere ----------
  let edgeCells = 0
  let repeatedCells = 0
  const spaceRows: number[] = []
  const spaceCols = new Map<string, number>()
  const spaceExamples: string[] = []
  const formulaRows: number[] = []
  const formulaExamples: string[] = []
  let formulaCells = 0
  const strongPh = new Map<string, number>()
  const weakPh = new Map<string, number>()
  const phRows: number[] = []
  for (const row of rows) {
    let rowHasSpace = false
    let rowHasFormula = false
    let rowHasPh = false
    const cells = row.cells
    for (let c = 0; c < cells.length; c++) {
      const v = cells[c]
      if (v === '') continue
      const edge = hasEdgeSpace(v) && v.trim() !== ''
      const rep = (v.includes('  ') || v.includes('\t') || v.includes('\u00a0')) && hasRepeatedSpace(v)
      if (edge || rep) {
        if (edge) edgeCells++
        if (rep) repeatedCells++
        rowHasSpace = true
        spaceCols.set(headers[c], (spaceCols.get(headers[c]) ?? 0) + 1)
        if (spaceExamples.length < 4) spaceExamples.push(v)
      }
      if (isFormulaLike(v)) {
        formulaCells++
        rowHasFormula = true
        if (formulaExamples.length < 4) formulaExamples.push(v)
      }
      const ph = v.length <= 16 ? placeholderStrength(v) : null
      if (ph) {
        const key = v.trim()
        const m = ph === 'strong' ? strongPh : weakPh
        m.set(key, (m.get(key) ?? 0) + 1)
        rowHasPh = true
      }
    }
    if (rowHasSpace) spaceRows.push(row.id)
    if (rowHasFormula) formulaRows.push(row.id)
    if (rowHasPh) phRows.push(row.id)
  }

  if (edgeCells + repeatedCells > 0) {
    const cols = [...spaceCols.entries()].sort((a, b) => b[1] - a[1])
    const total = cols.reduce((s, [, n]) => s + n, 0)
    findings.push({
      id: 'extra-spaces',
      severity: 'check',
      basis: 'confirmed',
      title: `${plural(total, 'cell has', 'cells have')} extra spaces`,
      detail: [
        edgeCells ? `${plural(edgeCells, 'cell has', 'cells have')} spaces at the start or end.` : '',
        repeatedCells ? `${plural(repeatedCells, 'cell has', 'cells have')} double spaces inside.` : '',
        `Most are in ${cols.slice(0, 3).map(([n]) => quote(n)).join(', ')}.`,
      ]
        .filter(Boolean)
        .join(' '),
      why: 'Invisible spaces make "Smith" and "Smith " look different to a computer, which breaks sorting, matching and duplicate checks.',
      suggestion: 'Remove spaces at the start and end of every cell.',
      count: total,
      unit: 'cells',
      rowIds: cap(spaceRows),
      examples: spaceExamples,
      fix: { action: 'trimWhitespace', params: { columns: [], collapseSpaces: edgeCells === 0 } },
    })
  }

  if (formulaCells > 0) {
    findings.push({
      id: 'formulas',
      severity: 'important',
      basis: 'confirmed',
      title: `${plural(formulaCells, 'cell starts', 'cells start')} like a spreadsheet formula`,
      detail: `${plural(formulaCells, 'cell begins', 'cells begin')} with =, +, -, or @, for example ${formulaExamples.map(quote).join(', ')}.`,
      why: 'Excel or Google Sheets may run these as formulas when the file is opened. A harmful formula can leak data or run commands, so this is a known security risk.',
      suggestion: 'When you download, keep "Protect against spreadsheet formulas" turned on. It adds an apostrophe in front of these cells so they show as plain text.',
      count: formulaCells,
      unit: 'cells',
      rowIds: cap(formulaRows),
      examples: formulaExamples,
      fixAtExport: 'protectFormulas',
    })
  }

  if (strongPh.size + weakPh.size > 0) {
    const all = [...strongPh.entries(), ...weakPh.entries()].sort((a, b) => b[1] - a[1])
    const total = all.reduce((s, [, n]) => s + n, 0)
    const strongList = [...new Set([...strongPh.keys()].map((k) => k))]
    findings.push({
      id: 'placeholders',
      severity: strongPh.size > 0 ? 'check' : 'info',
      basis: 'guess',
      title: `${plural(total, 'cell contains', 'cells contain')} text that may mean "empty"`,
      detail: `We found ${all
        .slice(0, 5)
        .map(([v, n]) => `${quote(v)} (${n.toLocaleString('en-US')})`)
        .join(', ')}${all.length > 5 ? ', and others' : ''}.`,
      why: 'Placeholders like N/A or NULL are counted as real values by most programs, so averages and "missing data" counts come out wrong. Some of them (like "None" or "NA") can be real answers, so you choose.',
      suggestion: 'Choose which of these mean "no value" and make those cells empty.',
      count: total,
      unit: 'cells',
      rowIds: cap(phRows),
      examples: all.map(([v]) => v),
      fix: { action: 'replaceMissing', params: { columns: [], placeholders: strongList, includeBlank: false, replaceWith: '' } },
      needsChoice: strongList.length === 0 ? 'fillValue' : undefined,
    })
  }

  // ---------- Empty cells (informational: blanks are often legitimate) ----------
  // Cells in completely empty rows are already reported as empty rows, so they are not counted again here.
  const blankCols = profiles
    .filter((p) => p.type !== 'empty')
    .map((p) => ({ name: p.name, index: p.index, empty: p.empty - emptyRowIds.length }))
    .filter((p) => p.empty > 0)
    .sort((a, b) => b.empty - a.empty)
  if (blankCols.length > 0) {
    const top = blankCols[0]
    const topBlankRows = rows.filter((r) => isBlank(r.cells[top.index]) && !emptyRowSet.has(r.id)).map((r) => r.id)
    const total = blankCols.reduce((s, p) => s + p.empty, 0)
    if (topBlankRows.length > 0) {
      findings.push({
        id: 'blank-cells',
        severity: 'info',
        basis: 'confirmed',
        title: `Some cells are empty`,
        detail: `${blankCols
          .slice(0, 4)
          .map((p) => `${quote(p.name)} is empty in ${plural(p.empty, 'row')}`)
          .join('; ')}${blankCols.length > 4 ? `; and ${blankCols.length - 4} more columns` : ''}.`,
        why: 'Empty cells are often fine (not everyone has a second phone number). They only matter if another tool requires a value there.',
        suggestion: 'Leave them, or fill them with a value such as "Unknown". You can also add a check that a column must not be empty.',
        count: total,
        unit: 'cells',
        column: top.name,
        rowIds: cap(topBlankRows),
        fix: { action: 'replaceMissing', params: { columns: [top.name], placeholders: [], includeBlank: true, replaceWith: '' } },
        needsChoice: 'fillValue',
      })
    }
  }

  // ---------- Column-specific checks ----------
  // Each check looks at every DIFFERENT value once (with its count) instead of every row,
  // then makes one pass over the rows only to list the affected row numbers.
  profiles.forEach((p) => {
    const c = p.index
    const name = p.name
    const distinct: [string, number][] = []
    for (const e of counts[c]) if (!isBlank(e[0])) distinct.push(e)
    const rowsIn = (set: Set<string>) => {
      const ids: number[] = []
      for (const r of rows) if (set.has(r.cells[c])) ids.push(r.id)
      return cap(ids)
    }
    const pick = (pred: (v: string) => boolean) => {
      const set = new Set<string>()
      let n = 0
      for (const [v, k] of distinct) {
        if (pred(v)) {
          set.add(v)
          n += k
        }
      }
      return { set, n }
    }

    if (p.type === 'email') {
      const reasons = new Map<string, string>()
      const bad = pick((v) => {
        const r = checkEmail(v)
        if (!r.ok) reasons.set(v, r.reason)
        return !r.ok
      })
      if (bad.n > 0) {
        findings.push({
          id: `emails:${name}`,
          severity: 'check',
          basis: 'guess',
          title: `${plural(bad.n, 'email address', 'email addresses')} in ${quote(name)} ${bad.n === 1 ? 'looks' : 'look'} wrong`,
          detail: [...reasons.entries()]
            .slice(0, 4)
            .map(([v, why]) => `${quote(v)}: ${why}`)
            .join('; '),
          why: 'Messages sent to these addresses will probably bounce. We do not change them, because only you know the right address.',
          suggestion: 'Look at these rows and correct them by hand, or add a column that marks them so you can filter them in your spreadsheet.',
          count: bad.n,
          unit: 'cells',
          column: name,
          rowIds: rowsIn(bad.set),
          examples: [...bad.set].slice(0, 4),
          fix: { action: 'addCheckColumn', params: { column: name, check: 'email' } },
        })
      }
      const upper = pick((v) => v.includes('@') && v.trim() !== v.trim().toLowerCase())
      if (upper.n > 0) {
        findings.push({
          id: `email-case:${name}`,
          severity: 'info',
          basis: 'confirmed',
          title: `${plural(upper.n, 'email address', 'email addresses')} in ${quote(name)} ${upper.n === 1 ? 'has' : 'have'} capital letters`,
          detail: `For example ${examples(upper.set, 3).map(quote).join(', ')}.`,
          why: 'Email addresses work the same in lowercase, and lowercase makes it easier to spot the same person entered twice.',
          suggestion: 'Make all email addresses lowercase.',
          count: upper.n,
          unit: 'cells',
          column: name,
          rowIds: rowsIn(upper.set),
          fix: { action: 'lowercaseEmails', params: { column: name } },
        })
      }
    }

    if (p.type === 'date') {
      const s = summarizeDates(counts[c], readDate)
      const order = suggestOrder(s)
      if (s.unreadableCount > 0) {
        const bad = new Set(s.unreadable.map((u) => u.value))
        findings.push({
          id: `bad-dates:${name}`,
          severity: 'check',
          basis: 'guess',
          title: `${plural(s.unreadableCount, 'date')} in ${quote(name)} could not be understood`,
          detail: `For example ${examples(bad, 4).map(quote).join(', ')}.${s.dateShapedUnreadable ? ` ${plural(s.dateShapedUnreadable, 'of them looks', 'of them look')} like a date but ${s.dateShapedUnreadable === 1 ? 'is' : 'are'} impossible (like February 30 or month 13).` : ''}`,
          why: 'Other programs will treat these as text or reject them. We will not guess what they should be.',
          suggestion: 'Look at these rows and correct them by hand.',
          count: s.unreadableCount,
          unit: 'cells',
          column: name,
          rowIds: rowsIn(bad),
          examples: [...bad].slice(0, 4),
        })
      }
      if (s.styles.size > 1 || s.ambiguous > 0 || s.twoDigitYears > 0) {
        const parts: string[] = []
        if (s.styles.size > 1) parts.push(`Dates are written ${s.styles.size} different ways.`)
        if (s.ambiguous > 0) {
          parts.push(
            `${plural(s.ambiguous, 'date', 'dates')} could be read two ways: for example 03/04/2026 could be March 4 or April 3.`,
          )
        }
        if (s.twoDigitYears > 0) parts.push(`${plural(s.twoDigitYears, 'date uses', 'dates use')} a two-digit year.`)
        let hint: string
        if (order === 'MDY') hint = `We think these are month/day/year because ${plural(s.onlyMDY, 'date', 'dates')} in this column only make sense that way (for example the month can't be over 12). Please confirm.`
        else if (order === 'DMY') hint = `We think these are day/month/year because ${plural(s.onlyDMY, 'date', 'dates')} in this column only make sense that way (for example the month can't be over 12). Please confirm.`
        else if (order === 'YMD') hint = 'These dates are not ambiguous.'
        else if (s.onlyDMY > 0 && s.onlyMDY > 0) hint = `This column mixes both orders: ${plural(s.onlyMDY, 'date')} only work as month/day and ${plural(s.onlyDMY, 'date')} only work as day/month. Choose the order most of the file uses; dates that do not fit it will be left unchanged.`
        else hint = 'Nothing in this column tells us whether the first number is the month or the day. You need to choose.'
        findings.push({
          id: `dates:${name}`,
          severity: s.ambiguous > 0 && !order ? 'important' : 'check',
          basis: 'guess',
          title:
            s.ambiguous > 0 && !order
              ? `Dates in ${quote(name)} could be read two ways`
              : `Dates in ${quote(name)} are not in one consistent format`,
          detail: parts.join(' '),
          why: 'Mixed or ambiguous dates get sorted wrongly, and a program may read 03/04 as March when you meant April.',
          suggestion: 'Convert every date to one clear format, such as 2026-03-04 (year-month-day), which no program misreads.',
          count: s.notIso,
          unit: 'cells',
          column: name,
          hint,
          examples: distinct.slice(0, 4).map(([v]) => v),
          fix: { action: 'formatDates', params: { column: name, order: order ?? 'MDY', output: 'YYYY-MM-DD' } },
          needsChoice: order ? undefined : 'dateOrder',
        })
      }
    }

    if (p.type === 'number') {
      const sug = suggestDecimal(distinct.map(([v]) => v))
      let withCurrency = 0
      let ambiguous = 0
      let ambiguousExample = ''
      const changing = pick((v) => {
        const r = readNumber(v, sug.decimal)
        return r !== null && r.value !== v
      })
      for (const [v, k] of distinct) {
        const r = readNumber(v, sug.decimal)
        if (r?.hadCurrency && r.value !== v) withCurrency += k
        if (r?.ambiguousSeparator) {
          ambiguous += k
          ambiguousExample ||= v
        }
      }
      if (changing.n > 0) {
        findings.push({
          id: `numbers:${name}`,
          severity: 'check',
          basis: 'guess',
          title: `${plural(changing.n, 'number')} in ${quote(name)} ${changing.n === 1 ? 'includes' : 'include'} symbols or separators`,
          detail: `For example ${examples(changing.set, 4).map(quote).join(', ')}.${withCurrency ? ` ${plural(withCurrency, 'value has', 'values have')} a currency symbol.` : ''}`,
          why: 'Spreadsheets and databases often read "$1,200" as text instead of a number, so totals and sorting break.',
          suggestion: 'Turn them into plain numbers like 1200.50. The currency symbol is removed, so make sure the column name says the currency.',
          count: changing.n,
          unit: 'cells',
          column: name,
          rowIds: rowsIn(changing.set),
          hint: sug.certain
            ? `This column uses "${sug.decimal}" for decimals.`
            : ambiguous > 0
              ? `Some values like ${quote(ambiguousExample)} could mean a thousand or a decimal. Choose which symbol marks decimals.`
              : `We think this column uses "${sug.decimal}" for decimals. Please check.`,
          fix: { action: 'cleanNumbers', params: { column: name, decimal: sug.decimal } },
          needsChoice: sug.certain || ambiguous === 0 ? undefined : 'decimal',
        })
      }
      const bad = pick((v) => readNumber(v, sug.decimal) === null)
      if (bad.n > 0) {
        findings.push({
          id: `bad-numbers:${name}`,
          severity: 'info',
          basis: 'guess',
          title: `${plural(bad.n, 'value')} in ${quote(name)} ${bad.n === 1 ? 'is' : 'are'} not a number`,
          detail: `This column is mostly numbers, but some values are not, for example ${examples(bad.set, 4).map(quote).join(', ')}.`,
          why: 'Text in a number column can stop totals from adding up.',
          suggestion: 'Check these rows. We leave them as they are.',
          count: bad.n,
          unit: 'cells',
          column: name,
          rowIds: rowsIn(bad.set),
        })
      }
    }

    if (p.type === 'phone') {
      const good = pick(looksLikePhone)
      const styles = new Set([...good.set].map(phoneStyle))
      if (styles.size > 1) {
        const intl = pick((v) => good.set.has(v) && v.trim().startsWith('+')).n
        findings.push({
          id: `phones:${name}`,
          severity: 'check',
          basis: 'guess',
          title: `Phone numbers in ${quote(name)} are written ${styles.size} different ways`,
          detail: `For example ${examples(good.set, 4).map(quote).join(', ')}.`,
          why: 'Mixed formats make it hard to spot duplicates, and some phone and texting tools only accept one format.',
          suggestion: 'Write every number the same way. Numbers we cannot read are left unchanged.',
          count: good.n,
          unit: 'cells',
          column: name,
          hint: 'Numbers without a + country code are read using the country you choose.',
          examples: examples(good.set, 4),
          fix: { action: 'formatPhones', params: { column: name, country: 'US', format: intl > good.n / 2 ? 'E164' : 'INTERNATIONAL' } },
        })
      }
      const bad = pick((v) => !looksLikePhone(v))
      if (bad.n > 0) {
        findings.push({
          id: `bad-phones:${name}`,
          severity: 'check',
          basis: 'guess',
          title: `${plural(bad.n, 'value')} in ${quote(name)} ${bad.n === 1 ? "doesn't" : "don't"} look like a phone number`,
          detail: `For example ${examples(bad.set, 4).map(quote).join(', ')}. A phone number usually has 7 to 15 digits.`,
          why: 'These numbers may be incomplete or typed in the wrong column.',
          suggestion: 'Look at these rows. We will not invent missing digits.',
          count: bad.n,
          unit: 'cells',
          column: name,
          rowIds: rowsIn(bad.set),
          examples: examples(bad.set, 4),
          fix: { action: 'addCheckColumn', params: { column: name, check: 'phone' } },
        })
      }
    }

    if (p.type === 'category' || p.type === 'yesno') {
      const clusters = findClusters(counts[c])
      if (clusters.length > 0) {
        const cells = clusters.reduce(
          (s, cl) => s + cl.values.filter((v) => v.value !== cl.suggested).reduce((t, v) => t + v.count, 0),
          0,
        )
        const pre = clusters.filter((cl) => cl.preselected)
        findings.push({
          id: `similar:${name}`,
          severity: 'check',
          basis: 'guess',
          title: `${quote(name)} has values that look like the same thing written differently`,
          detail: clusters
            .slice(0, 3)
            .map((cl) => cl.values.map((v) => quote(v.value)).join(' / '))
            .join('; '),
          why: 'A report will count "Electronics" and "electronics" as two different categories.',
          suggestion: 'Review each group and combine the ones that really are the same.',
          count: cells,
          unit: 'cells',
          column: name,
          clusters,
          hint: pre.length < clusters.length ? 'Groups that differ only in capitals or spaces are ticked. Groups with different spellings or names are not ticked, so check them first.' : undefined,
          fix: {
            action: 'mergeValues',
            params: {
              column: name,
              groups: pre.map((cl) => ({ from: cl.values.map((v) => v.value).filter((v) => v !== cl.suggested), to: cl.suggested })),
            },
          },
          needsChoice: pre.length === 0 ? 'mergeGroups' : undefined,
        })
      }
    }

    if (p.type === 'text') {
      const filledN = distinct.reduce((n, [, k]) => n + k, 0)
      const shortN = pick((v) => v.length <= 40 && v.trim().split(/\s+/).length <= 4).n
      if (filledN >= 3 && shortN >= filledN * 0.9) {
        const tally = { upper: 0, lower: 0, title: 0 }
        for (const [v, k] of distinct) {
          const st = caseStyle(v.trim())
          if (st === 'upper' || st === 'lower' || st === 'title') tally[st] += k
        }
        const used = (Object.keys(tally) as (keyof typeof tally)[]).filter((k) => tally[k] > 0)
        const majority = used.sort((a, b) => tally[b] - tally[a])[0]
        if (used.length > 1 && majority) {
          const off = pick((v) => {
            const st = caseStyle(v.trim())
            return (st === 'upper' || st === 'lower' || st === 'title') && st !== majority
          })
          const label = { upper: 'ALL CAPS', lower: 'all lowercase', title: 'Title Case' }
          findings.push({
            id: `case:${name}`,
            severity: 'check',
            basis: 'guess',
            title: `${quote(name)} uses mixed capitalization`,
            detail: used.map((k) => `${plural(tally[k], 'value')} in ${label[k]}`).join(', ') + `. For example ${examples(off.set, 3).map(quote).join(', ')}.`,
            why: 'Mixed capitals look untidy in emails and labels, and can stop matching from working.',
            suggestion: `Change them all to ${label[majority]}. Names like McDonald or van der Berg may need a manual touch afterwards.`,
            count: off.n,
            unit: 'cells',
            column: name,
            rowIds: rowsIn(off.set),
            fix: { action: 'changeCase', params: { column: name, mode: majority } },
          })
        }
      }
    }

    if ((p.type === 'email' || p.type === 'id' || p.type === 'phone') && p.repeatedValues > 0) {
      // Rows already reported as duplicates or near-duplicates are skipped, so one problem is not reported three times.
      const seen = new Set<string>()
      const repeatedKeys = new Set<string>()
      const repeats: number[] = []
      for (const r of rows) {
        const raw = r.cells[c]
        if (isBlank(raw) || exactDupeSet.has(r.id) || nearDupeSet.has(r.id)) continue
        const k = p.type === 'email' ? raw.trim().toLowerCase() : raw.trim()
        if (seen.has(k)) {
          repeats.push(r.id)
          repeatedKeys.add(k)
        } else seen.add(k)
      }
      if (repeats.length > 0) {
        const kind = p.type === 'email' ? 'email address' : p.type === 'phone' ? 'phone number' : 'value'
        findings.push({
          id: `repeated:${name}`,
          severity: 'check',
          basis: 'guess',
          title: `${plural(repeats.length, 'row repeats', 'rows repeat')} ${p.type === 'email' ? 'an email address' : p.type === 'phone' ? 'a phone number' : 'a value'} in ${quote(name)}`,
          detail: `${quote(name)} looks like it should be different on every row, but ${plural(repeatedKeys.size, kind, `${kind === 'email address' ? 'email addresses' : `${kind}s`}`)} appear${repeatedKeys.size === 1 ? 's' : ''} more than once.`,
          why: 'This can be the same person or item entered twice, with small differences in the other columns.',
          suggestion: `Preview removing rows that repeat ${quote(name)}, keeping the first. The other cells in those rows may differ, so check the preview.`,
          count: repeats.length,
          unit: 'rows',
          column: name,
          rowIds: cap(repeats),
          fix: { action: 'removeDuplicates', params: { columns: [name], ignoreCase: p.type === 'email', ignoreSpaces: true, keep: 'first' } },
        })
      }
    }
  })

  // ---------- The user's own rules ----------
  for (const rule of rules) {
    const c = headers.indexOf(rule.column)
    if (c === -1) {
      findings.push({
        id: `rule:${rule.id}`,
        severity: 'important',
        basis: 'rule',
        title: `Your check needs a column called ${quote(rule.column)}`,
        detail: 'This file does not have that column, so the check could not run.',
        why: 'The file may have a different layout than the one you made the check for.',
        suggestion: 'Rename a column to match, or remove the check.',
        count: 1,
        unit: 'columns',
      })
      continue
    }
    const bad: number[] = []
    const seen = new Set<string>()
    const allowed = new Set((rule.allowed ?? []).map((a) => a.trim()))
    for (const r of rows) {
      const v = r.cells[c]
      let broken = false
      switch (rule.kind) {
        case 'required':
          broken = isBlank(v)
          break
        case 'unique': {
          const k = v.trim()
          if (k !== '') {
            broken = seen.has(k)
            seen.add(k)
          }
          break
        }
        case 'email':
          broken = !isBlank(v) && !checkEmail(v).ok
          break
        case 'number':
          broken = !isBlank(v) && readNumber(v, '.') === null && readNumber(v, ',') === null
          break
        case 'date':
          broken = !isBlank(v) && readDate(v) === null
          break
        case 'allowed':
          broken = !isBlank(v) && !allowed.has(v.trim())
          break
      }
      if (broken) bad.push(r.id)
    }
    const what = {
      required: 'must not be empty',
      unique: 'must be different on every row',
      email: 'must contain email addresses',
      number: 'must contain numbers',
      date: 'must contain dates',
      allowed: `may only contain: ${[...allowed].slice(0, 6).join(', ')}${allowed.size > 6 ? ', …' : ''}`,
    }[rule.kind]
    if (bad.length > 0) {
      findings.push({
        id: `rule:${rule.id}`,
        severity: 'important',
        basis: 'rule',
        title: `Your check: ${quote(rule.column)} ${what}`,
        detail: `${plural(bad.length, 'row breaks', 'rows break')} this rule.`,
        why: 'You asked us to check this.',
        suggestion: 'Show these rows and fix them, or fill the missing values.',
        count: bad.length,
        unit: 'rows',
        column: rule.column,
        rowIds: cap(bad),
      })
    }
  }

  findings.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || b.count - a.count)
  return { profiles, findings }
}

/** Number of findings that still need attention (informational ones do not count). */
export function unresolvedCount(findings: Finding[]): number {
  return findings.filter((f) => f.severity !== 'info').length
}
