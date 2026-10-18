// Number and currency cleanup. Works on the text directly (no floating point), so
// "1,234.50" becomes exactly "1234.50" and never "1234.5" or "1234.4999999".

const CURRENCY = /(?:US\$|CA\$|AU\$|NZ\$|HK\$|R\$|[$€£¥₹₩₽₺₪฿₫₴₦]|\b(?:USD|EUR|GBP|JPY|CAD|AUD|INR|CHF|CNY|SEK|NOK|DKK|NZD|MXN|BRL|ZAR)\b)/gi
const SPACES = /[\s   ']/g

export interface NumberReading {
  /** The cleaned number as text, using "." for decimals and no thousands separators. */
  value: string
  hadCurrency: boolean
  hadGrouping: boolean
  /** True if the separator could be either a thousands separator or a decimal point (e.g. "1,234"). */
  ambiguousSeparator: boolean
}

function groupedOk(intPart: string, sep: string): boolean {
  if (!intPart.includes(sep)) return /^\d+$/.test(intPart)
  const parts = intPart.split(sep)
  return /^\d{1,3}$/.test(parts[0]) && parts.slice(1).every((p) => /^\d{3}$/.test(p))
}

/**
 * Reads text like "$1,234.50", "1.234,50 €", "(45.00)", "-12", "1 234,5".
 * `decimal` says which symbol marks decimals. Returns null if the text is not a plain number
 * once currency and grouping are removed (percentages, ranges and words are left alone).
 */
export function readNumber(raw: string, decimal: '.' | ','): NumberReading | null {
  let v = raw.trim()
  if (v === '') return null
  let negative = false
  if (/^\(.*\)$/.test(v)) {
    negative = true
    v = v.slice(1, -1).trim()
  }
  const withoutCurrency = v.replace(CURRENCY, '')
  const hadCurrency = withoutCurrency !== v
  // Spaces are dropped; an apostrophe (Swiss style 1'234.50) is treated as a thousands separator.
  v = withoutCurrency.replace(SPACES, (m) => (m === "'" ? (decimal === '.' ? ',' : '.') : ''))
  if (/^-/.test(v)) {
    negative = !negative
    v = v.slice(1)
  } else if (/-$/.test(v)) {
    negative = !negative
    v = v.slice(0, -1)
  } else if (/^\+/.test(v)) {
    v = v.slice(1)
  }
  if (!/^[\d.,]+$/.test(v) || !/\d/.test(v)) return null

  const group = decimal === '.' ? ',' : '.'
  const decCount = v.split(decimal).length - 1
  if (decCount > 1) return null
  let [intPart, frac = ''] = v.split(decimal)
  if (frac.includes(group)) return null
  if (intPart === '') intPart = '0'
  if (!groupedOk(intPart, group)) return null
  const hadGrouping = intPart.includes(group)
  intPart = intPart.split(group).join('')
  if (decCount === 1 && frac === '') return null
  if (frac !== '' && !/^\d+$/.test(frac)) return null

  // "1,234" with decimal "." is read as 1234, but could have been meant as 1.234.
  const ambiguousSeparator = hadGrouping && decCount === 0 && intPart.length <= 6 && v.split(group).length === 2
  // Leading zeros are kept on purpose: they matter in codes like 02134.
  const value = (negative && /[1-9]/.test(intPart + frac) ? '-' : '') + intPart + (frac ? `.${frac}` : '')
  return { value, hadCurrency, hadGrouping, ambiguousSeparator }
}

export function isPlainNumber(v: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(v.trim())
}

/**
 * Looks at a column and suggests which decimal symbol it uses. Returns the evidence
 * so the UI can explain the suggestion.
 */
export function suggestDecimal(values: readonly string[]): { decimal: '.' | ','; dotVotes: number; commaVotes: number; certain: boolean } {
  let dot = 0
  let comma = 0
  for (const raw of values) {
    const v = raw.replace(CURRENCY, '').replace(SPACES, '')
    const lastDot = v.lastIndexOf('.')
    const lastComma = v.lastIndexOf(',')
    if (lastDot !== -1 && lastComma !== -1) {
      if (lastDot > lastComma) dot++
      else comma++
    } else if (lastComma !== -1) {
      // "12,5" or "12,50" -> decimal comma. "1,234" is ambiguous and gives no vote.
      const after = v.length - lastComma - 1
      if (after !== 3 || (v.match(/,/g) ?? []).length > 1) {
        if ((v.match(/,/g) ?? []).length > 1) dot++
        else comma++
      }
    } else if (lastDot !== -1) {
      const after = v.length - lastDot - 1
      if (after !== 3 || (v.match(/\./g) ?? []).length > 1) {
        if ((v.match(/\./g) ?? []).length > 1) comma++
        else dot++
      }
    }
  }
  const decimal = comma > dot ? ',' : '.'
  return { decimal, dotVotes: dot, commaVotes: comma, certain: (decimal === '.' ? comma : dot) === 0 && dot + comma > 0 }
}
