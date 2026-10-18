// Small, pure helpers for looking at single cell values.

/** A cell is blank if it is empty or contains only whitespace (including non-breaking spaces). */
export function isBlank(v: string): boolean {
  return v.trim() === ''
}

/** Text that almost always means "no value" in exported data. Suggested pre-selected, but never applied without the user. */
export const STRONG_PLACEHOLDERS = ['N/A', 'NULL', '#N/A', 'NaN', 'nil', '#NULL!'] as const

/** Text that often means "no value" but can be real data ("NA" is also Namibia, "None" can be an answer). Shown unselected. */
export const WEAK_PLACEHOLDERS = ['NA', '-', '--', '?', 'None', 'Unknown', 'not available', 'TBD', 'missing', '.'] as const

const strongSet = new Set(STRONG_PLACEHOLDERS.map((p) => p.toLowerCase()))
const weakSet = new Set(WEAK_PLACEHOLDERS.map((p) => p.toLowerCase()))

export function placeholderStrength(v: string): 'strong' | 'weak' | null {
  const t = v.trim().toLowerCase()
  if (t === '') return null
  if (strongSet.has(t)) return 'strong'
  if (weakSet.has(t)) return 'weak'
  return null
}

const EDGE_SPACE = /^\s|\s$/
const REPEATED_SPACE = /[ \t ]{2,}/

export function hasEdgeSpace(v: string): boolean {
  return EDGE_SPACE.test(v)
}

export function hasRepeatedSpace(v: string): boolean {
  return REPEATED_SPACE.test(v.trim())
}

/** Trim the edges. Optionally squeeze runs of spaces/tabs inside the value into one space. Line breaks are kept. */
export function cleanSpaces(v: string, collapse: boolean): string {
  let out = v.trim()
  if (collapse) out = out.replace(/[ \t ]{2,}/g, ' ')
  return out
}

// ---------- Email ----------

const EMAIL_RE =
  /^(?!\.)(?!.*\.\.)[\p{L}\p{N}.!#$%&'*+/=?^_`{|}~-]+(?<!\.)@(?=.{1,253}$)(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+[\p{L}]{2,}$/u

const DOMAIN_TYPOS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'iclod.com': 'icloud.com',
}

export type EmailCheck = { ok: true } | { ok: false; reason: string }

/** Checks whether a value looks like a usable email address. It never rewrites the value. */
export function checkEmail(raw: string): EmailCheck {
  const v = raw.trim()
  if (v === '') return { ok: true }
  if (!v.includes('@')) return { ok: false, reason: 'no @ sign' }
  if (v.indexOf('@') !== v.lastIndexOf('@')) return { ok: false, reason: 'more than one @ sign' }
  if (/\s/.test(v)) return { ok: false, reason: 'contains a space' }
  const domain = v.slice(v.indexOf('@') + 1).toLowerCase()
  if (domain === '') return { ok: false, reason: 'nothing after the @' }
  if (!domain.includes('.')) return { ok: false, reason: 'missing a dot in the part after @' }
  if (DOMAIN_TYPOS[domain]) return { ok: false, reason: `possible typo: ${domain} (did they mean ${DOMAIN_TYPOS[domain]}?)` }
  if (/\.(con|cmo|ocm|vom|comm)$/.test(domain)) return { ok: false, reason: `the ending ".${domain.split('.').pop()}" looks like a typo` }
  if (!EMAIL_RE.test(v)) return { ok: false, reason: 'not in the usual name@example.com shape' }
  return { ok: true }
}

export function looksLikeEmail(v: string): boolean {
  const t = v.trim()
  return t !== '' && checkEmail(t).ok
}

// ---------- Capitalization ----------

export type CaseStyle = 'upper' | 'lower' | 'title' | 'mixed' | 'none'

export function caseStyle(v: string): CaseStyle {
  const letters = v.replace(/[^\p{L}]/gu, '')
  if (letters.length < 2) return 'none'
  if (letters === letters.toUpperCase() && letters !== letters.toLowerCase()) return 'upper'
  if (letters === letters.toLowerCase() && letters !== letters.toUpperCase()) return 'lower'
  if (v === toTitleCase(v)) return 'title'
  return 'mixed'
}

function capitalizeWord(word: string): string {
  if (word === '') return word
  const lower = word.toLowerCase()
  // O'Brien, D'Angelo: capitalize after an apostrophe that follows a single letter.
  const apos = lower.match(/^(\p{L})(['’])(\p{L})(.*)$/u)
  if (apos) return apos[1].toUpperCase() + apos[2] + apos[3].toUpperCase() + apos[4]
  const chars = Array.from(lower)
  return chars[0].toUpperCase() + chars.slice(1).join('')
}

/** "mary-jane O'NEIL" -> "Mary-Jane O'Neil". Words split on spaces and hyphens. */
export function toTitleCase(v: string): string {
  return v.replace(/[^\s-]+/gu, (w) => capitalizeWord(w))
}

/** "HELLO THERE. HOW ARE YOU" -> "Hello there. How are you" */
export function toSentenceCase(v: string): string {
  const lower = v.toLowerCase()
  return lower.replace(/(^\s*\p{L}|[.!?]\s+\p{L})/gu, (m) => m.toUpperCase())
}

// ---------- Grouping similar values ----------

/** A key that is the same for values that differ only in case, accents, punctuation, spacing, or word order. */
export function fingerprint(v: string): string {
  return v
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .filter((t, i, arr) => i === 0 || arr[i - 1] !== t)
    .join(' ')
}

/** Edit distance, stopping early once it exceeds `max`. */
export function levenshtein(a: string, b: string, max = Infinity): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      if (cur[j] < rowMin) rowMin = cur[j]
    }
    if (rowMin > max) return max + 1
    prev = cur
  }
  return prev[b.length]
}

// ---------- Spreadsheet formula risk ----------

/**
 * Spreadsheet apps (Excel, Google Sheets, LibreOffice) may treat a cell that starts with
 * = + - @ (or a tab / carriage return) as a formula. A malicious formula can run commands
 * or leak data when someone opens the file. Plain numbers like -12.50 and phone numbers
 * like +1 (555) 010-0100 are not treated as risky.
 */
export function isFormulaLike(v: string): boolean {
  if (v === '') return false
  const first = v[0]
  if (first === '=' || first === '@' || first === '\t' || first === '\r') return true
  if (first === '+' || first === '-') {
    return !/^[+-][\d\s().,\-]*$/.test(v)
  }
  return false
}

/** Adds a leading apostrophe, which spreadsheet apps show as plain text instead of running. */
export function protectFormula(v: string): string {
  return isFormulaLike(v) ? `'${v}` : v
}

export function plural(n: number, one: string, many?: string): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : (many ?? `${one}s`)}`
}
