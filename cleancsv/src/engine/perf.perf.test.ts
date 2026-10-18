// Run with: npm run perf
// Measures how long the main operations take on synthetic files of different sizes.
// Results are printed and used to choose the limits in limits.ts and the README.
import { it } from 'vitest'
import { parseText } from './parse'
import { analyze } from './analyze'
import { runStep } from './actions'
import { toCSV, DEFAULT_EXPORT } from './export'

function synthetic(rows: number): string {
  const cats = ['Electronics', 'electronics', 'Toys', 'Books', 'Home & Garden', 'TOYS']
  const out = ['id,name,email,phone,signup,country,category,total,notes,flag']
  for (let i = 0; i < rows; i++) {
    out.push(
      [
        `C-${i}`,
        i % 50 === 0 ? ` Person ${i} ` : `Person ${i}`,
        i % 97 === 0 ? `p${i}@example` : `p${i}@example.com`,
        `(555) 010-${String(i % 10000).padStart(4, '0')}`,
        `2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
        i % 3 ? 'USA' : 'Canada',
        cats[i % cats.length],
        `"$${(i % 5000).toLocaleString('en-US')}.50"`,
        i % 10 ? '' : 'N/A',
        i % 2 ? 'yes' : 'no',
      ].join(','),
    )
  }
  return out.join('\n')
}

function time<T>(label: string, fn: () => T): T {
  const t = performance.now()
  const r = fn()
  console.log(`${label}: ${Math.round(performance.now() - t)} ms`)
  return r
}

for (const n of [10_000, 100_000, 500_000]) {
  it(`handles ${n.toLocaleString('en-US')} rows`, () => {
    const text = synthetic(n)
    console.log(`\n${n.toLocaleString('en-US')} rows, ${(text.length / 1024 / 1024).toFixed(1)} MB`)
    const r = time('parse', () => parseText(text, { limits: { maxBytes: 1e9, maxCells: 1e8 } }))
    if (!r.ok) throw new Error(r.error.title)
    const a = time('find problems', () => analyze(r.table))
    console.log(`  ${a.findings.length} findings`)
    const t = time('trim spaces', () => runStep(r.table, { action: 'trimWhitespace', params: { columns: [], collapseSpaces: false } })).table
    time('remove duplicates', () => runStep(t, { action: 'removeDuplicates', params: { columns: [], ignoreCase: false, ignoreSpaces: false, keep: 'first' } }))
    time('clean numbers', () => runStep(t, { action: 'cleanNumbers', params: { column: 'total', decimal: '.' } }))
    time('export', () => toCSV(t, DEFAULT_EXPORT))
    if (global.gc) global.gc()
    console.log(`  heap used: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`)
  })
}
