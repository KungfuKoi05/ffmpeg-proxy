// Cached versions of the per-value checks used when looking for problems. The problem
// check runs again after every fix, and most values have not changed, so remembering
// earlier answers makes it several times faster on big files. Caches are cleared when
// they get large, so memory stays bounded.

import { caseStyle, checkEmail, placeholderStrength } from './values'
import { readDate } from './dates'
import { readNumber } from './numbers'
import { looksLikePhone } from './phones'

const MAX = 300_000

function memo<R>(fn: (v: string) => R): (v: string) => R {
  let cache = new Map<string, R>()
  return (v: string) => {
    const hit = cache.get(v)
    if (hit !== undefined || cache.has(v)) return hit as R
    const r = fn(v)
    if (cache.size >= MAX) cache = new Map()
    cache.set(v, r)
    return r
  }
}

export const cEmail = memo(checkEmail)
export const cDate = memo(readDate)
export const cPhone = memo(looksLikePhone)
export const cCase = memo(caseStyle)
export const cPlaceholder = memo(placeholderStrength)
const numDot = memo((v) => readNumber(v, '.'))
const numComma = memo((v) => readNumber(v, ','))
export const cNumber = (v: string, decimal: '.' | ',') => (decimal === '.' ? numDot(v) : numComma(v))
