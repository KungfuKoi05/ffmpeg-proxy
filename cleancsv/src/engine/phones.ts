// Phone numbers, using libphonenumber-js (Google's phone rules, MIT licensed).
// Numbers are only reformatted when the library can read them for the chosen country.
// Anything it cannot read is left exactly as it was.

import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min'
import type { PhoneFormat } from './types'

export const PHONE_COUNTRIES: { code: CountryCode; name: string }[] = [
  { code: 'US', name: 'United States / Canada (+1)' },
  { code: 'GB', name: 'United Kingdom (+44)' },
  { code: 'AU', name: 'Australia (+61)' },
  { code: 'IN', name: 'India (+91)' },
  { code: 'DE', name: 'Germany (+49)' },
  { code: 'FR', name: 'France (+33)' },
  { code: 'ES', name: 'Spain (+34)' },
  { code: 'IT', name: 'Italy (+39)' },
  { code: 'NL', name: 'Netherlands (+31)' },
  { code: 'IE', name: 'Ireland (+353)' },
  { code: 'NZ', name: 'New Zealand (+64)' },
  { code: 'ZA', name: 'South Africa (+27)' },
  { code: 'MX', name: 'Mexico (+52)' },
  { code: 'BR', name: 'Brazil (+55)' },
  { code: 'PH', name: 'Philippines (+63)' },
  { code: 'SG', name: 'Singapore (+65)' },
  { code: 'JP', name: 'Japan (+81)' },
]

const SHAPE = /^[+()\d\s.\-/]+(?:\s*(?:x|ext\.?|extension|#)\s*\d{1,6})?$/i

export function digitCount(v: string): number {
  return (v.replace(/(?:x|ext\.?|extension|#)\s*\d+$/i, '').match(/\d/g) ?? []).length
}

/** Has the shape of a phone number (7 to 15 digits, only phone punctuation). Does not check that the number exists. */
export function looksLikePhone(raw: string): boolean {
  const v = raw.trim()
  if (!SHAPE.test(v)) return false
  const n = digitCount(v)
  return n >= 7 && n <= 15
}

/** A rough fingerprint of how a number is written, e.g. "(ddd) ddd-dddd". Used to count styles. */
export function phoneStyle(raw: string): string {
  return raw.trim().replace(/\d/g, 'd').replace(/d+/g, (m) => (m.length > 4 ? 'D' : m))
}

export function formatPhone(raw: string, country: string, format: PhoneFormat): string | null {
  const v = raw.trim()
  if (!looksLikePhone(v)) return null
  const parsed = parsePhoneNumberFromString(v, country as CountryCode)
  if (!parsed || !parsed.isPossible()) return null
  return parsed.format(format === 'E164' ? 'E.164' : format)
}
