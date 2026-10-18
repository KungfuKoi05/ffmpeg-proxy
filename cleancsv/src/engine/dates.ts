// Date recognition. Dates like 03/04/2026 can mean March 4 or April 3, so the reader
// never picks an order on its own: it reports which orders are possible and the
// user (or clear evidence in the column) decides.

import type { DateOrder, DateOutput } from './types'

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const MONTH_NAMES_OUT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function monthFromName(name: string): number | null {
  const n = name.toLowerCase().replace(/\.$/, '')
  if (n === 'sept') return 9
  const i = MONTHS.indexOf(n.slice(0, 3))
  if (i === -1) return null
  // Accept "Mar", "March", "Sept"; reject random words that start like a month ("Marble").
  const full = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'][i]
  if (n.length > 3 && !full.startsWith(n)) return null
  return i + 1
}

export function daysInMonth(y: number, m: number): number {
  return [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
}

function validYMD(y: number, m: number, d: number): boolean {
  return y >= 1000 && y <= 9999 && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m)
}

function expandYear(y: string): number {
  if (y.length === 4) return Number(y)
  const n = Number(y)
  // Two-digit years: 00-49 -> 2000s, 50-99 -> 1900s.
  return n <= 49 ? 2000 + n : 1900 + n
}

export interface YMD {
  y: number
  m: number
  d: number
}

export interface DateReading {
  /** The pattern family, used to count how many different styles a column uses. */
  style: string
  /** Possible meanings. One entry = unambiguous. Two entries = month/day could be swapped. */
  options: { order: DateOrder | 'named'; date: YMD }[]
  /** Time part, kept as written (e.g. "14:30" or "2:30 PM"). */
  time: string
  twoDigitYear: boolean
}

const TIME_RE = /(?:[T\s]+(\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:\s*[AaPp][Mm])?(?:\s*(?:Z|[+-]\d{2}:?\d{2}))?))?$/

function splitTime(v: string): { date: string; time: string } {
  const m = v.match(TIME_RE)
  if (m && m[1]) return { date: v.slice(0, m.index).trim(), time: m[1] }
  return { date: v, time: '' }
}

/**
 * Reads a single value. Returns null if it does not look like a date at all,
 * or if every possible reading is impossible (e.g. 02/30/2026).
 */
export function readDate(raw: string): DateReading | null {
  let v = raw.trim()
  if (v.length < 6 || v.length > 40) return null
  // Strip a leading weekday: "Tue, March 4, 2026" / "Tuesday 4 March 2026"
  v = v.replace(/^(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\.?,?\s+/i, '')
  const { date, time } = splitTime(v)

  // 2026-03-04, 2026/3/4, 2026.03.04
  let m = date.match(/^(\d{4})([-/.])(\d{1,2})\2(\d{1,2})$/)
  if (m) {
    const y = +m[1], mo = +m[3], d = +m[4]
    if (!validYMD(y, mo, d)) return null
    return { style: `ymd${m[2]}`, options: [{ order: 'YMD', date: { y, m: mo, d } }], time, twoDigitYear: false }
  }

  // 20260304 (only with 19xx/20xx years, to avoid reading ID numbers as dates)
  m = date.match(/^((?:19|20)\d{2})(\d{2})(\d{2})$/)
  if (m) {
    const y = +m[1], mo = +m[2], d = +m[3]
    if (!validYMD(y, mo, d)) return null
    return { style: 'ymd-compact', options: [{ order: 'YMD', date: { y, m: mo, d } }], time, twoDigitYear: false }
  }

  // 03/04/2026, 3-4-26, 03.04.2026
  m = date.match(/^(\d{1,2})([-/.])(\d{1,2})\2(\d{4}|\d{2})$/)
  if (m) {
    const a = +m[1], b = +m[3]
    const y = expandYear(m[4])
    const options: DateReading['options'] = []
    if (validYMD(y, a, b)) options.push({ order: 'MDY', date: { y, m: a, d: b } })
    if (a !== b && validYMD(y, b, a)) options.push({ order: 'DMY', date: { y, m: b, d: a } })
    if (a === b && options.length === 1) {
      // 05/05/2026 means the same under both orders.
      options.push({ order: 'DMY', date: { y, m: a, d: a } })
    }
    if (options.length === 0) return null
    return { style: `num${m[2]}${m[4].length}`, options, time, twoDigitYear: m[4].length === 2 }
  }

  // March 4, 2026 / Mar 4 2026 / March 4th, 2026
  m = date.match(/^([A-Za-z]{3,9}\.?)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/)
  if (m) {
    const mo = monthFromName(m[1])
    const d = +m[2], y = +m[3]
    if (!mo || !validYMD(y, mo, d)) return null
    return { style: 'named-mdy', options: [{ order: 'named', date: { y, m: mo, d } }], time, twoDigitYear: false }
  }

  // 4 March 2026 / 4-Mar-2026 / 04-Mar-26 / 4th of March 2026
  m = date.match(/^(\d{1,2})(?:st|nd|rd|th)?(?:\s+of)?[\s-]+([A-Za-z]{3,9}\.?),?[\s-]+(\d{4}|\d{2})$/)
  if (m) {
    const mo = monthFromName(m[2])
    const d = +m[1]
    const y = expandYear(m[3])
    if (!mo || !validYMD(y, mo, d)) return null
    return { style: 'named-dmy', options: [{ order: 'named', date: { y, m: mo, d } }], time, twoDigitYear: m[3].length === 2 }
  }

  return null
}

/** True if the text has the shape of a date even if the date itself is impossible (e.g. 2026-13-45). */
export function looksDateShaped(raw: string): boolean {
  const v = raw.trim()
  return (
    /^\d{1,4}[-/.]\d{1,2}[-/.]\d{2,4}(?:[T\s].*)?$/.test(v) ||
    /^[A-Za-z]{3,9}\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{2,4}$/.test(v) ||
    /^\d{1,2}[\s-]+[A-Za-z]{3,9}\.?[\s-]+\d{2,4}$/.test(v)
  )
}

export function isAmbiguous(r: DateReading): boolean {
  if (r.options.length < 2) return false
  const [x, y] = r.options
  return !(x.date.y === y.date.y && x.date.m === y.date.m && x.date.d === y.date.d)
}

/**
 * Picks the reading for the order the user chose. YMD and named-month dates are not affected
 * by the choice. Choosing 'YMD' for numeric dates means "do not guess": only dates with a
 * single possible meaning are converted.
 */
export function resolveDate(r: DateReading, order: DateOrder): YMD | null {
  if (r.options.length === 1) {
    const only = r.options[0]
    if (only.order === 'named' || only.order === 'YMD' || order === 'YMD') return only.date
    return only.order === order ? only.date : null
  }
  if (order === 'YMD') return isAmbiguous(r) ? null : r.options[0].date
  const pick = r.options.find((o) => o.order === order)
  return pick ? pick.date : null
}

const pad = (n: number) => String(n).padStart(2, '0')

export function formatDate(d: YMD, out: DateOutput): string {
  switch (out) {
    case 'YYYY-MM-DD':
      return `${d.y}-${pad(d.m)}-${pad(d.d)}`
    case 'MM/DD/YYYY':
      return `${pad(d.m)}/${pad(d.d)}/${d.y}`
    case 'DD/MM/YYYY':
      return `${pad(d.d)}/${pad(d.m)}/${d.y}`
    case 'D MMM YYYY':
      return `${d.d} ${MONTH_NAMES_OUT[d.m - 1]} ${d.y}`
    case 'MMM D, YYYY':
      return `${MONTH_NAMES_OUT[d.m - 1]} ${d.d}, ${d.y}`
  }
}

export interface DateColumnSummary {
  readable: number
  /** Distinct values that could not be read, with how many cells hold each. */
  unreadable: { value: string; count: number }[]
  unreadableCount: number
  dateShapedUnreadable: number
  ambiguous: number
  /** Values that only make sense as month-first (e.g. 03/25/2026). */
  onlyMDY: number
  /** Values that only make sense as day-first (e.g. 25/03/2026). */
  onlyDMY: number
  styles: Map<string, number>
  twoDigitYears: number
  filled: number
  /** Readable cells not already written as YYYY-MM-DD. */
  notIso: number
}

/** Summarizes a column of dates. Accepts the cell values, or a map of distinct value to count (faster). */
export function summarizeDates(input: readonly string[] | Map<string, number>, read: (v: string) => DateReading | null = readDate): DateColumnSummary {
  const s: DateColumnSummary = {
    readable: 0,
    unreadable: [],
    unreadableCount: 0,
    dateShapedUnreadable: 0,
    ambiguous: 0,
    onlyMDY: 0,
    onlyDMY: 0,
    styles: new Map(),
    twoDigitYears: 0,
    filled: 0,
    notIso: 0,
  }
  let counts: Map<string, number>
  if (input instanceof Map) counts = input
  else {
    counts = new Map()
    for (const v of input) counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  for (const [v, k] of counts) {
    if (v.trim() === '') continue
    s.filled += k
    const r = read(v)
    if (!r) {
      s.unreadable.push({ value: v, count: k })
      s.unreadableCount += k
      if (looksDateShaped(v)) s.dateShapedUnreadable += k
      continue
    }
    s.readable += k
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) s.notIso += k
    s.styles.set(r.style, (s.styles.get(r.style) ?? 0) + k)
    if (r.twoDigitYear) s.twoDigitYears += k
    if (isAmbiguous(r)) s.ambiguous += k
    else if (r.options.length === 1 && r.options[0].order === 'MDY') s.onlyMDY += k
    else if (r.options.length === 1 && r.options[0].order === 'DMY') s.onlyDMY += k
  }
  return s
}

/**
 * Suggests a month/day order only when the column itself proves it: some values only
 * make sense one way and none only make sense the other way. Otherwise returns null
 * and the user must choose.
 */
export function suggestOrder(s: DateColumnSummary): DateOrder | null {
  if (s.onlyMDY > 0 && s.onlyDMY === 0) return 'MDY'
  if (s.onlyDMY > 0 && s.onlyMDY === 0) return 'DMY'
  if (s.ambiguous === 0 && s.onlyMDY === 0 && s.onlyDMY === 0) return 'YMD'
  return null
}
