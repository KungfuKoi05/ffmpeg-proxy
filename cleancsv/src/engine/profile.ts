// Column profiling: how full each column is, how many different values it has, and a
// GUESS at what kind of data it holds. The type is always presented as a guess.

import type { ColumnProfile, ColumnType, Table } from './types'
import { fingerprint, isBlank } from './values'
import { suggestDecimal } from './numbers'
import { cDate as readDate, cEmail as checkEmail, cNumber as readNumber, cPhone as looksLikePhone } from './cached'

const HINT = {
  email: /e-?mail/i,
  date: /date|\bday\b|dob|birth|created|updated|modified|joined|sign.?up|since|\bwhen\b|expir|\bdue\b|time|timestamp|_at$|\bat$/i,
  phone: /phone|mobile|\bcell\b|\btel\b|telephone|\bfax\b|whatsapp|contact.?(no|num)/i,
  code: /zip|postal|post.?code|\bcode\b|\bid\b|_id$|^id_|id$|sku|\bupc\b|\bean\b|isbn|account|\bno\.?$|number$|#/i,
}

const YESNO = new Set(['yes', 'no', 'y', 'n', 'true', 'false', 't', 'f'])
const SAMPLE = 5000

export function columnValues(table: Table, c: number): string[] {
  const out = new Array<string>(table.rows.length)
  for (let i = 0; i < table.rows.length; i++) out[i] = table.rows[i].cells[c]
  return out
}

export interface TypeGuess {
  type: ColumnType
  confidence: number
  decimal?: '.' | ','
}

export function guessType(name: string, values: readonly string[], counts: Map<string, number>): TypeGuess {
  const filled: string[] = []
  for (const v of values) {
    if (!isBlank(v)) {
      filled.push(v.trim())
      if (filled.length >= SAMPLE) break
    }
  }
  if (filled.length === 0) return { type: 'empty', confidence: 1 }
  const n = filled.length
  const frac = (pred: (v: string) => boolean) => filled.filter(pred).length / n

  const at = frac((v) => v.includes('@'))
  if ((HINT.email.test(name) && at >= 0.3) || at >= 0.6) return { type: 'email', confidence: frac((v) => checkEmail(v).ok) }

  const dateHint = HINT.date.test(name)
  const dates = frac((v) => {
    const r = readDate(v)
    return !!r && (dateHint || r.style !== 'ymd-compact')
  })
  if (dates >= 0.6 || (dateHint && dates >= 0.3)) return { type: 'date', confidence: dates }

  const phoneHint = HINT.phone.test(name)
  const phones = frac(looksLikePhone)
  const punctuated = frac((v) => /[+()\-.\s]/.test(v))
  if ((phoneHint && phones >= 0.5) || (phones >= 0.8 && punctuated >= 0.3 && !HINT.code.test(name))) {
    return { type: 'phone', confidence: phones }
  }

  const lowered = new Set<string>()
  for (const k of counts.keys()) if (!isBlank(k)) lowered.add(k.trim().toLowerCase())
  if (lowered.size <= 4 && [...lowered].every((v) => YESNO.has(v)) && [...lowered].some((v) => v.length > 1)) {
    return { type: 'yesno', confidence: 1 }
  }

  const { decimal } = suggestDecimal(filled)
  const numbers = frac((v) => readNumber(v, decimal) !== null)
  const leadingZeros = frac((v) => /^0\d/.test(v))
  if (numbers >= 0.8) {
    if (HINT.code.test(name) || leadingZeros >= 0.05) return { type: 'id', confidence: numbers }
    return { type: 'number', confidence: numbers, decimal }
  }

  const distinct = counts.size - (counts.has('') ? 1 : 0)
  const filledTotal = values.length - (counts.get('') ?? 0)
  if (HINT.code.test(name) && distinct >= filledTotal * 0.9) return { type: 'id', confidence: distinct / Math.max(1, filledTotal) }
  if (filled.length >= 4 && distinct <= 60) {
    // Count values that differ only in capitals or spacing once: "Toys", "toys " and "TOYS" are one category.
    const keys = new Set<string>()
    for (const k of counts.keys()) if (!isBlank(k)) keys.add(fingerprint(k))
    if (keys.size <= filledTotal * 0.5) return { type: 'category', confidence: 1 }
  }
  return { type: 'text', confidence: 1 }
}

export function countValues(values: readonly string[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1)
  return m
}

export function profileColumn(table: Table, c: number, values = columnValues(table, c), counts = countValues(values)): ColumnProfile & { decimal?: '.' | ',' } {
  const name = table.headers[c]
  let empty = 0
  for (const [v, k] of counts) if (isBlank(v)) empty += k
  const filled = values.length - empty
  let unique = 0
  let repeatedValues = 0
  const top: { value: string; count: number }[] = []
  for (const [v, k] of counts) {
    if (isBlank(v)) continue
    unique++
    if (k > 1) repeatedValues++
    top.push({ value: v, count: k })
  }
  top.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
  const guess = guessType(name, values, counts)
  let invalid = 0
  if (guess.type === 'email' || guess.type === 'date' || guess.type === 'number' || guess.type === 'phone') {
    for (const [v, k] of counts) {
      if (isBlank(v)) continue
      const bad =
        guess.type === 'email'
          ? !checkEmail(v).ok
          : guess.type === 'date'
            ? readDate(v) === null
            : guess.type === 'number'
              ? readNumber(v, guess.decimal ?? '.') === null
              : !looksLikePhone(v)
      if (bad) invalid += k
    }
  }
  return {
    name,
    index: c,
    total: values.length,
    filled,
    empty,
    unique,
    repeatedValues,
    type: guess.type,
    typeConfidence: guess.confidence,
    topValues: top.slice(0, 5),
    invalid,
    decimal: guess.decimal,
  }
}

export const TYPE_LABEL: Record<ColumnType, string> = {
  empty: 'empty',
  number: 'numbers',
  date: 'dates',
  email: 'email addresses',
  phone: 'phone numbers',
  yesno: 'yes/no values',
  category: 'categories (a few repeated values)',
  id: 'codes or IDs',
  text: 'text',
}

/** "Email — 92% filled, 3 repeated values, 4 invalid-looking entries." */
export function describeProfile(p: ColumnProfile): string {
  const pct = p.total ? Math.round((p.filled / p.total) * 100) : 0
  const parts = [`${pct}% filled`]
  if (p.type !== 'empty') parts.push(`${p.unique.toLocaleString('en-US')} different value${p.unique === 1 ? '' : 's'}`)
  if (p.repeatedValues > 0 && (p.type === 'email' || p.type === 'id' || p.type === 'phone')) {
    parts.push(`${p.repeatedValues.toLocaleString('en-US')} repeated value${p.repeatedValues === 1 ? '' : 's'}`)
  }
  if (p.invalid > 0) parts.push(`${p.invalid.toLocaleString('en-US')} invalid-looking entr${p.invalid === 1 ? 'y' : 'ies'}`)
  return `${p.name} — ${parts.join(', ')}.`
}
