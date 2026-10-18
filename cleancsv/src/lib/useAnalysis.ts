// Keeps the problem list up to date. Small files are checked instantly on the page.
// Big files are checked in a Web Worker so clicks and scrolling never freeze; while
// that runs, the previous results stay on screen and `pending` is true.

import { useEffect, useMemo, useRef, useState } from 'react'
import { analyze, type Analysis } from '../engine/analyze'
import type { Rule, Table } from '../engine/types'

/** Above this many cells the check runs in the background (about 0.25 s of work on a laptop). */
export const BACKGROUND_CELLS = 150_000

let worker: Worker | null | undefined
function getWorker(): Worker | null {
  if (worker !== undefined) return worker
  try {
    worker = typeof Worker === 'undefined' ? null : new Worker(new URL('../engine/analyze.worker.ts', import.meta.url), { type: 'module' })
  } catch {
    worker = null
  }
  return worker
}

/**
 * `fileKey` identifies the opened file (its original table). Results for a different file
 * are never shown, even briefly, while a new check runs.
 */
export function useAnalysis(table: Table | null, rules: Rule[] | undefined, fileKey: unknown): { analysis: Analysis | null; pending: boolean } {
  const big = !!table && table.rows.length * Math.max(1, table.headers.length) >= BACKGROUND_CELLS
  const w = big ? getWorker() : null
  const sync = useMemo(() => (table && !w ? analyze(table, rules) : null), [table, rules, w])
  const [bg, setBg] = useState<{ analysis: Analysis; table: Table; rules: Rule[] | undefined; fileKey: unknown } | null>(null)
  const latest = useRef(0)

  useEffect(() => {
    if (!table || !w) return
    const id = ++latest.current
    const onMessage = (e: MessageEvent<{ id: number; analysis: Analysis | null }>) => {
      if (e.data.id !== id) return
      w.removeEventListener('message', onMessage)
      // If the worker could not finish, fall back to checking on the page.
      setBg({ analysis: e.data.analysis ?? analyze(table, rules), table, rules, fileKey })
    }
    // If the worker cannot start (for example a host blocks it), check on the page instead.
    const onError = (e: Event) => {
      e.preventDefault?.()
      if (id !== latest.current) return
      w.removeEventListener('message', onMessage)
      setBg({ analysis: analyze(table, rules), table, rules, fileKey })
    }
    w.addEventListener('message', onMessage)
    w.addEventListener('error', onError)
    w.postMessage({ id, table, rules: rules ?? [] })
    return () => {
      w.removeEventListener('message', onMessage)
      w.removeEventListener('error', onError)
    }
  }, [table, rules, w, fileKey])

  if (!table) return { analysis: null, pending: false }
  if (!w) return { analysis: sync, pending: false }
  const sameFile = bg !== null && bg.fileKey === fileKey
  const fresh = sameFile && bg.table === table && bg.rules === rules
  return { analysis: sameFile ? bg.analysis : null, pending: !fresh }
}
