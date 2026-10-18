import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ColumnProfile, Table } from '../engine/types'
import { TYPE_LABEL } from '../engine/profile'
import { Button, ShowValue, cx } from './ui'

const PAGE = 50

/**
 * A paged view of the data. The header row and the row-number column stay in place
 * while scrolling, so wide tables keep their context. Cells are rendered as text,
 * never as HTML.
 */
export function DataTable({
  table,
  profiles,
  filter,
  onClearFilter,
  highlight,
  caption,
  maxRows,
}: {
  table: Table
  profiles?: ColumnProfile[]
  filter?: { label: string; rowIds: number[] } | null
  onClearFilter?: () => void
  /** Keys "rowId:column" of cells to highlight (e.g. changed by the last step). */
  highlight?: Set<string>
  caption: string
  maxRows?: number
}) {
  const [page, setPage] = useState(0)
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    let r = table.rows
    if (filter) {
      const ids = new Set(filter.rowIds)
      r = r.filter((x) => ids.has(x.id))
    }
    const q = query.trim().toLocaleLowerCase()
    if (q) r = r.filter((x) => x.cells.some((v) => v.toLocaleLowerCase().includes(q)))
    return maxRows ? r.slice(0, maxRows) : r
  }, [table, filter, query, maxRows])

  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const current = Math.min(page, pages - 1)
  const shown = rows.slice(current * PAGE, current * PAGE + PAGE)
  const from = rows.length === 0 ? 0 : current * PAGE + 1
  const to = current * PAGE + shown.length

  return (
    <section aria-label={caption} className="min-w-0">
      {!maxRows && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
            <input
              type="search"
              aria-label="Search the data"
              placeholder="Search the data"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(0)
              }}
              className="block w-full rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
            />
          </div>
          <p className="text-sm text-slate-600" aria-live="polite">
            {rows.length === 0
              ? 'No rows to show'
              : `Rows ${from.toLocaleString('en-US')}–${to.toLocaleString('en-US')} of ${rows.length.toLocaleString('en-US')}`}
            {(filter || query) && ` (out of ${table.rows.length.toLocaleString('en-US')})`}
          </p>
        </div>
      )}
      {filter && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-950">
          <span>
            Showing only: <strong>{filter.label}</strong>
          </span>
          <Button size="sm" variant="ghost" onClick={onClearFilter}>
            <X className="h-4 w-4" aria-hidden /> Show all rows
          </Button>
        </div>
      )}
      {highlight && highlight.size > 0 && (
        <p className="mb-2 flex items-center gap-2 text-xs text-slate-600">
          <span className="inline-block h-3 w-3 rounded-sm bg-emerald-100 ring-1 ring-emerald-300" aria-hidden />
          Highlighted cells were changed by the last step.
        </p>
      )}
      <div className="max-h-[70vh] overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm" tabIndex={0} role="region" aria-label={`${caption}, scrollable`}>
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 top-0 z-20 border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-left text-xs font-semibold text-slate-600">
                <span aria-hidden>#</span>
                <span className="sr-only">Original row number</span>
              </th>
              {table.headers.map((h, i) => (
                <th
                  key={i}
                  scope="col"
                  className="sticky top-0 z-10 min-w-[8rem] max-w-[20rem] border-b border-slate-200 bg-slate-100 px-3 py-2 text-left align-bottom text-xs font-semibold text-slate-800"
                >
                  <ShowValue value={h} className="font-sans text-xs" />
                  {profiles?.[i] && profiles[i].name === h && (
                    <span className="mt-0.5 block font-normal text-slate-600">{TYPE_LABEL[profiles[i].type]}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="group">
                <th scope="row" className="sticky left-0 z-[1] border-b border-r border-slate-100 bg-slate-50 px-3 py-1.5 text-left text-xs font-normal tabular-nums text-slate-500">
                  {r.id}
                </th>
                {r.cells.map((v, i) => {
                  const hl = highlight?.has(`${r.id}:${table.headers[i]}`)
                  return (
                    <td
                      key={i}
                      className={cx(
                        'max-w-[20rem] border-b border-slate-100 px-3 py-1.5 align-top text-slate-900 group-hover:bg-slate-50',
                        hl && 'bg-emerald-50 group-hover:bg-emerald-100',
                      )}
                    >
                      {v === '' ? <span className="text-slate-300" aria-label="empty">–</span> : <ShowValue value={v} className="font-sans text-sm" />}
                    </td>
                  )
                })}
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={table.headers.length + 1} className="px-3 py-8 text-center text-slate-500">
                  {query ? 'No rows contain that text.' : 'No rows.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!maxRows && pages > 1 && (
        <nav aria-label="Pages" className="mt-3 flex items-center justify-between gap-2">
          <Button size="sm" onClick={() => setPage(current - 1)} disabled={current === 0}>
            <ChevronLeft className="h-4 w-4" aria-hidden /> Previous
          </Button>
          <span className="text-sm text-slate-600">
            Page {current + 1} of {pages.toLocaleString('en-US')}
          </span>
          <Button size="sm" onClick={() => setPage(current + 1)} disabled={current >= pages - 1}>
            Next <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </nav>
      )}
      <p className="mt-2 text-xs text-slate-500 sm:hidden">Scroll sideways to see more columns.</p>
    </section>
  )
}
