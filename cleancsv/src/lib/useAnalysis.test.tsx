import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { analyze } from '../engine/analyze'
import type { Table } from '../engine/types'

// A fake Web Worker that answers only when the test says so.
class FakeWorker {
  static last: FakeWorker | null = null
  listeners: ((e: MessageEvent) => void)[] = []
  pending: { id: number; table: Table }[] = []
  constructor() {
    FakeWorker.last = this
  }
  addEventListener(_: string, fn: (e: MessageEvent) => void) {
    this.listeners.push(fn)
  }
  removeEventListener(_: string, fn: (e: MessageEvent) => void) {
    this.listeners = this.listeners.filter((x) => x !== fn)
  }
  postMessage(msg: { id: number; table: Table }) {
    this.pending.push(msg)
  }
  answer() {
    const msg = this.pending.shift()!
    const data = { id: msg.id, analysis: analyze(msg.table) }
    for (const fn of [...this.listeners]) fn({ data } as MessageEvent)
  }
}

function bigTable(label: string): Table {
  const headers = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
  const rows = Array.from({ length: 16_000 }, (_, i) => ({ id: i + 1, cells: headers.map((h) => `${label}${h}${i % 3 === 0 ? ' ' : ''}`) }))
  return { headers, rows }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('background problem check', () => {
  it('shows nothing from a previous file while the new file is being checked', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const { useAnalysis } = await import('./useAnalysis')
    const first = bigTable('x')
    const second = bigTable('y')
    const { result, rerender } = renderHook(({ t, key }) => useAnalysis(t, undefined, key), { initialProps: { t: first, key: first as unknown } })
    expect(result.current).toEqual({ analysis: null, pending: true })
    act(() => FakeWorker.last!.answer())
    expect(result.current.pending).toBe(false)
    expect(result.current.analysis?.findings.length).toBeGreaterThan(0)

    rerender({ t: second, key: second })
    expect(result.current).toEqual({ analysis: null, pending: true })
    act(() => FakeWorker.last!.answer())
    expect(result.current.pending).toBe(false)
  })

  it('keeps showing the last results for the same file while an update runs', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const { useAnalysis } = await import('./useAnalysis')
    const t1 = bigTable('x')
    const t2 = { ...t1, headers: [...t1.headers] }
    const { result, rerender } = renderHook(({ t }) => useAnalysis(t, undefined, t1), { initialProps: { t: t1 } })
    act(() => FakeWorker.last!.answer())
    const before = result.current.analysis
    rerender({ t: t2 })
    expect(result.current.analysis).toBe(before)
    expect(result.current.pending).toBe(true)
  })

  it('checks small files immediately, without a worker', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const { useAnalysis } = await import('./useAnalysis')
    const small: Table = { headers: ['a'], rows: [{ id: 1, cells: [' x '] }] }
    const { result } = renderHook(() => useAnalysis(small, undefined, small))
    expect(result.current.pending).toBe(false)
    expect(result.current.analysis?.findings.map((f) => f.id)).toContain('extra-spaces')
  })
})
