// Runs the problem check off the main thread for big files, so the page stays responsive.
import { analyze } from './analyze'
import type { Rule, Table } from './types'

self.onmessage = (e: MessageEvent<{ id: number; table: Table; rules: Rule[] }>) => {
  const { id, table, rules } = e.data
  try {
    ;(self as unknown as Worker).postMessage({ id, analysis: analyze(table, rules) })
  } catch {
    ;(self as unknown as Worker).postMessage({ id, analysis: null })
  }
}
