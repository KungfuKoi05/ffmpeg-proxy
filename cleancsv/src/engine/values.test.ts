import { describe, expect, it } from 'vitest'
import { checkEmail, fingerprint, isFormulaLike, placeholderStrength, protectFormula, toTitleCase } from './values'
import { isAmbiguous, readDate, resolveDate, suggestOrder, summarizeDates } from './dates'
import { readNumber, suggestDecimal } from './numbers'
import { looksLikePhone } from './phones'
import { findClusters } from './clusters'
import { countValues } from './profile'

describe('email checks', () => {
  it.each([
    'ada@example.com',
    'first.last+tag@sub.example.co.uk',
    'josé@exämple.de',
    "o'brien@example.ie",
  ])('accepts %s', (v) => expect(checkEmail(v).ok).toBe(true))

  it.each([
    ['ada.example.com', /no @/],
    ['ada@@example.com', /more than one/],
    ['ada@example', /missing a dot/],
    ['ada @example.com', /space/],
    ['ada@gmial.com', /typo/],
    ['ada@example.con', /typo/],
    ['.ada@example.com', /usual/],
    ['ada..lovelace@example.com', /usual/],
    ['ada@', /nothing after/],
  ])('flags %s', (v, reason) => {
    const r = checkEmail(v)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(reason)
  })
})

describe('missing-value placeholders', () => {
  it('treats N/A and NULL as likely missing, but not None, Unknown or 0', () => {
    expect(placeholderStrength('N/A')).toBe('strong')
    expect(placeholderStrength(' null ')).toBe('strong')
    expect(placeholderStrength('None')).toBe('weak')
    expect(placeholderStrength('Unknown')).toBe('weak')
    expect(placeholderStrength('0')).toBe(null)
    expect(placeholderStrength('Namibia')).toBe(null)
  })
})

describe('formula risk', () => {
  it.each(['=1+1', '=HYPERLINK("http://x")', '@SUM(A1)', '+cmd|calc', '-2+3+cmd|x', '\t=1'])('flags %s', (v) =>
    expect(isFormulaLike(v)).toBe(true),
  )
  it.each(['-12.50', '+1 (555) 010-0100', 'hello', '', 'a=b', '-', '--'])('does not flag %s', (v) =>
    expect(isFormulaLike(v)).toBe(false),
  )
  it('protects with a leading apostrophe', () => {
    expect(protectFormula('=1+1')).toBe("'=1+1")
    expect(protectFormula('-5')).toBe('-5')
  })
})

describe('title case', () => {
  it('handles hyphens and apostrophes', () => {
    expect(toTitleCase("mary-jane O'NEIL")).toBe("Mary-Jane O'Neil")
    expect(toTitleCase("don't stop")).toBe("Don't Stop")
    expect(toTitleCase('élodie durand')).toBe('Élodie Durand')
  })
})

describe('reading dates', () => {
  it('reads common formats', () => {
    expect(readDate('2026-03-04')?.options[0].date).toEqual({ y: 2026, m: 3, d: 4 })
    expect(readDate('March 4, 2026')?.options[0].date).toEqual({ y: 2026, m: 3, d: 4 })
    expect(readDate('4 Mar 2026')?.options[0].date).toEqual({ y: 2026, m: 3, d: 4 })
    expect(readDate('Tue, March 4th, 2026')?.options[0].date).toEqual({ y: 2026, m: 3, d: 4 })
    expect(readDate('04-Mar-26')?.options[0].date).toEqual({ y: 2026, m: 3, d: 4 })
  })

  it('reports both readings for an ambiguous date and never picks one by itself', () => {
    const r = readDate('03/04/2026')!
    expect(isAmbiguous(r)).toBe(true)
    expect(resolveDate(r, 'MDY')).toEqual({ y: 2026, m: 3, d: 4 })
    expect(resolveDate(r, 'DMY')).toEqual({ y: 2026, m: 4, d: 3 })
  })

  it('knows when only one reading is possible', () => {
    const r = readDate('03/25/2026')!
    expect(isAmbiguous(r)).toBe(false)
    expect(resolveDate(r, 'MDY')).toEqual({ y: 2026, m: 3, d: 25 })
    expect(resolveDate(r, 'DMY')).toBe(null)
  })

  it('treats the same day and month as unambiguous', () => {
    expect(isAmbiguous(readDate('05/05/2026')!)).toBe(false)
  })

  it('rejects impossible dates', () => {
    expect(readDate('2026-02-30')).toBe(null)
    expect(readDate('2024-02-29')).not.toBe(null)
    expect(readDate('2026-13-01')).toBe(null)
    expect(readDate('13/13/2026')).toBe(null)
    expect(readDate('hello world')).toBe(null)
    expect(readDate('Marble 4, 2026')).toBe(null)
  })

  it('suggests an order only when the column proves it', () => {
    expect(suggestOrder(summarizeDates(['03/04/2026', '03/25/2026']))).toBe('MDY')
    expect(suggestOrder(summarizeDates(['03/04/2026', '25/03/2026']))).toBe('DMY')
    expect(suggestOrder(summarizeDates(['03/04/2026', '05/06/2026']))).toBe(null)
    expect(suggestOrder(summarizeDates(['03/25/2026', '25/03/2026']))).toBe(null)
    expect(suggestOrder(summarizeDates(['2026-03-04', 'March 5, 2026']))).toBe('YMD')
  })
})

describe('reading numbers', () => {
  it('handles currency, grouping and negatives', () => {
    expect(readNumber('$1,234.50', '.')?.value).toBe('1234.50')
    expect(readNumber('USD 1,234', '.')?.value).toBe('1234')
    expect(readNumber('1 234,5', ',')?.value).toBe('1234.5')
    expect(readNumber("1'234.50", '.')?.value).toBe('1234.50')
    expect(readNumber('(12.00)', '.')?.value).toBe('-12.00')
    expect(readNumber('12-', '.')?.value).toBe('-12')
    expect(readNumber('.5', '.')?.value).toBe('0.5')
  })
  it('refuses things that are not plain numbers', () => {
    expect(readNumber('12%', '.')).toBe(null)
    expect(readNumber('1,23', '.')).toBe(null)
    expect(readNumber('1.2.3', '.')).toBe(null)
    expect(readNumber('5-10', '.')).toBe(null)
    expect(readNumber('abc', '.')).toBe(null)
  })
  it('marks 1,234 as possibly ambiguous', () => {
    expect(readNumber('1,234', '.')?.ambiguousSeparator).toBe(true)
    expect(readNumber('1,234.00', '.')?.ambiguousSeparator).toBe(false)
  })
  it('suggests the decimal symbol from evidence', () => {
    expect(suggestDecimal(['1,234.50', '12.5']).decimal).toBe('.')
    expect(suggestDecimal(['1.234,50', '12,5']).decimal).toBe(',')
    expect(suggestDecimal(['1,234']).certain).toBe(false)
  })
})

describe('phones', () => {
  it('recognises phone-shaped values', () => {
    expect(looksLikePhone('(555) 010-0101')).toBe(true)
    expect(looksLikePhone('+44 20 7946 0958')).toBe(true)
    expect(looksLikePhone('555-0101 ext 22')).toBe(true)
    expect(looksLikePhone('12')).toBe(false)
    expect(looksLikePhone('call me')).toBe(false)
  })
})

describe('similar value groups', () => {
  it('groups case and spacing differences, ticked by default', () => {
    const cl = findClusters(countValues(['Electronics', 'Electronics', 'electronics', 'ELECTRONICS ', 'Toys']))
    expect(cl).toHaveLength(1)
    expect(cl[0].kind).toBe('case')
    expect(cl[0].preselected).toBe(true)
    expect(cl[0].suggested).toBe('Electronics')
  })

  it('finds known alternative names and close spellings, not ticked', () => {
    const cl = findClusters(countValues(['USA', 'United States', 'U.S.', 'Canada', 'Electronics', 'Electroncs']))
    const kinds = Object.fromEntries(cl.map((c) => [c.suggested, c]))
    expect(cl.find((c) => c.values.some((v) => v.value === 'U.S.'))?.kind).toBe('synonym')
    expect(cl.find((c) => c.values.some((v) => v.value === 'Electroncs'))?.kind).toBe('spelling')
    expect(Object.values(kinds).every((c) => !c.preselected)).toBe(true)
  })

  it('does not group values that differ by a number', () => {
    expect(findClusters(countValues(['Size 10', 'Size 11', 'Size 12']))).toEqual([])
  })

  it('fingerprints ignore case, accents, punctuation and word order', () => {
    expect(fingerprint('  São Paulo ')).toBe(fingerprint('sao-paulo'))
    expect(fingerprint('Smith, John')).toBe(fingerprint('john smith'))
  })
})

describe('"do not guess" date order', () => {
  it('converts dates with one meaning and skips ambiguous ones', () => {
    expect(resolveDate(readDate('03/25/2026')!, 'YMD')).toEqual({ y: 2026, m: 3, d: 25 })
    expect(resolveDate(readDate('05/05/2026')!, 'YMD')).toEqual({ y: 2026, m: 5, d: 5 })
    expect(resolveDate(readDate('03/04/2026')!, 'YMD')).toBe(null)
  })
})
