import { describe, expect, it } from 'vitest'
import { futureTense } from './FixCard'

describe('preview wording', () => {
  it('describes what will happen, not what happened', () => {
    expect(futureTense('Removed 3 duplicate rows')).toBe('Will remove 3 duplicate rows')
    expect(futureTense('Changed 9 dates in "d" to YYYY-MM-DD. 2 values were left unchanged because we could not read them as a date.')).toBe(
      'Will change 9 dates in "d" to YYYY-MM-DD. 2 values will be left unchanged because we could not read them as a date.',
    )
    expect(futureTense('No duplicate rows found')).toBe('No duplicate rows found')
  })
})
