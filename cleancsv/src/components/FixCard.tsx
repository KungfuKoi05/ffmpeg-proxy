import { ChevronDown, Eye, Wand2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ActionError, isDestructive, runStep } from '../engine/actions'
import { formatDate, isAmbiguous, readDate } from '../engine/dates'
import { describeStep } from '../engine/describe'
import type { ActionResult, Finding, Step, Table } from '../engine/types'
import { plural } from '../engine/values'
import { useApp } from '../state'
import { clusterChoices, groupsFromChoices, StepOptions, type ClusterChoice } from './StepOptions'
import { Alert, Badge, Button, Card, ShowValue, cx } from './ui'

const SAMPLE = 10

const VERBS: Record<string, string> = {
  Removed: 'remove',
  Changed: 'change',
  Renamed: 'rename',
  Turned: 'turn',
  Reformatted: 'reformat',
  Made: 'make',
  Combined: 'combine',
  Emptied: 'empty',
  Filled: 'fill',
  Replaced: 'replace',
  Added: 'add',
}

/** "Removed 3 rows. 2 values were left unchanged" -> "Will remove 3 rows. 2 values will be left unchanged" */
export function futureTense(summary: string): string {
  return summary
    .replace(/^(\w+)/, (w) => (VERBS[w] ? `Will ${VERBS[w]}` : w))
    .replace(/ (?:was|were) left unchanged/, ' will be left unchanged')
}

export function ChangePreview({ result }: { result: ActionResult }) {
  const c = result.changes
  const oneColumn = c.cells.every((x) => x.column === c.cells[0]?.column)
  return (
    <div className="space-y-3 text-sm">
      <p className="font-medium text-slate-900" data-testid="preview-summary">
        {futureTense(result.summary)}
      </p>
      {c.cells.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">Before and after{oneColumn && c.cells[0] ? `, column ${c.cells[0].column}` : ''}</caption>
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Row</th>
                {!oneColumn && <th scope="col" className="px-3 py-2 font-medium">Column</th>}
                <th scope="col" className="px-3 py-2 font-medium">Before</th>
                <th scope="col" className="px-3 py-2 font-medium">After</th>
              </tr>
            </thead>
            <tbody>
              {c.cells.slice(0, SAMPLE).map((ch, i) => (
                <tr key={i} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-1.5 tabular-nums text-slate-500">{ch.rowId}</td>
                  {!oneColumn && <td className="px-3 py-1.5 text-slate-600">{ch.column}</td>}
                  <td className="px-3 py-1.5 text-red-800">
                    <ShowValue value={ch.before} />
                  </td>
                  <td className="px-3 py-1.5 text-emerald-800">
                    <ShowValue value={ch.after} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {c.cells.length > SAMPLE && (
            <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
              Showing {SAMPLE} of {plural(c.cells.length, 'change')}. All of them will be listed in the change report.
            </p>
          )}
        </div>
      )}
      {c.removedRows.length > 0 && (
        <div className="rounded-lg border border-red-200">
          <p className="border-b border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-900">These rows will be removed</p>
          <ul className="divide-y divide-slate-100">
            {c.removedRows.slice(0, SAMPLE).map((r) => (
              <li key={r.rowId} className="px-3 py-1.5">
                <span className="tabular-nums text-slate-500">Row {r.rowId}</span>
                {r.note && <span className="text-slate-500"> ({r.note})</span>}:{' '}
                <span className="break-words text-slate-800">{r.cells.filter((x) => x !== '').join(' · ') || '(all empty)'}</span>
              </li>
            ))}
          </ul>
          {c.removedRows.length > SAMPLE && (
            <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">…and {plural(c.removedRows.length - SAMPLE, 'more row')}.</p>
          )}
        </div>
      )}
      {c.headers.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-slate-200 p-3">
          {c.headers.map((h) => (
            <li key={h.index}>
              <ShowValue value={h.before} className="text-red-800" /> → <ShowValue value={h.after} className="text-emerald-800" />
            </li>
          ))}
        </ul>
      )}
      {c.removedColumns.length > 0 && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-900">
          Columns removed: {c.removedColumns.map((x) => `"${x.name}"`).join(', ')}
        </p>
      )}
      {c.addedColumns.length > 0 && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">New column: {c.addedColumns.map((x) => `"${x.name}"`).join(', ')}</p>
      )}
      {result.skipped.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950">
          <p className="font-medium">{plural(result.skipped.length, 'value', 'values')} will stay exactly as they are:</p>
          <p className="mt-1 break-words">
            {result.skipped
              .slice(0, 6)
              .map((s) => `"${s.value}" (row ${s.rowId})`)
              .join(', ')}
            {result.skipped.length > 6 ? ', …' : ''}
          </p>
        </div>
      )}
    </div>
  )
}

function AmbiguousDates({ table, column }: { table: Table; column: string }) {
  const c = table.headers.indexOf(column)
  const examples = useMemo(() => {
    const out: { value: string; mdy: string; dmy: string }[] = []
    for (const r of table.rows) {
      const v = r.cells[c]
      const d = v && readDate(v)
      if (d && isAmbiguous(d) && !out.some((o) => o.value === v)) {
        out.push({ value: v, mdy: formatDate(d.options[0].date, 'MMM D, YYYY'), dmy: formatDate(d.options[1].date, 'MMM D, YYYY') })
      }
      if (out.length >= 5) break
    }
    return out
  }, [table, c])
  if (examples.length === 0) return null
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
      <p className="font-medium">These dates mean different things depending on your choice:</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {examples.map((e) => (
          <li key={e.value}>
            <span className="font-mono">{e.value}</span>: {e.mdy} if month first, or {e.dmy} if day first
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Why Apply is not allowed yet, in plain English. Null when it is allowed. */
function blockedReason(step: Step, result: ActionResult | null, finding: Finding | undefined, orderChosen: boolean): string | null {
  if (step.action === 'formatDates' && finding?.needsChoice === 'dateOrder' && !orderChosen) return 'Choose how the dates should be read first.'
  if (step.action === 'replaceMissing' && step.params.includeBlank && step.params.replaceWith.trim() === '' && step.params.placeholders.length === 0) {
    return 'Type the value to put in empty cells.'
  }
  if (step.action === 'mergeValues' && step.params.groups.length === 0) return 'Tick at least one group to combine.'
  if (result && result.affected === 0) return 'Nothing would change with these settings.'
  return null
}

export function FixCard({
  id,
  title,
  explanation,
  countLabel,
  initial,
  finding,
  table,
  startOpen = false,
  onDone,
  badge,
}: {
  id: string
  title: string
  explanation: string
  countLabel?: string
  initial: Step
  finding?: Finding
  table: Table
  startOpen?: boolean
  /** Called after Apply or Cancel (used to close tool cards). */
  onDone?: () => void
  badge?: React.ReactNode
}) {
  const { apply, focusFix, setFocusFix } = useApp()
  const [open, setOpen] = useState(startOpen)
  const [step, setStep] = useState<Step>(initial)
  const [orderChosen, setOrderChosen] = useState(finding?.needsChoice !== 'dateOrder')
  const [choices, setChoicesState] = useState<ClusterChoice[]>(() => (finding?.clusters ? clusterChoices(finding.clusters) : []))
  const [askedToApply, setAskedToApply] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (focusFix === id) {
      setOpen(true)
      setFocusFix(null)
      ref.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
      ref.current?.querySelector<HTMLElement>('h3')?.focus()
    }
  }, [focusFix, id, setFocusFix])

  const setChoices = (c: ClusterChoice[]) => {
    setChoicesState(c)
    if (step.action === 'mergeValues' && finding?.clusters) {
      setStep({ ...step, params: { ...step.params, groups: groupsFromChoices(finding.clusters, c) } })
    }
  }

  const preview = useMemo(() => {
    if (!open) return null
    try {
      return { result: runStep(table, step), error: null as string | null }
    } catch (e) {
      return { result: null, error: e instanceof ActionError ? e.message : 'This change cannot be made with these settings.' }
    }
  }, [open, table, step])

  const blocked = preview?.error ?? blockedReason(step, preview?.result ?? null, finding, orderChosen)
  const needsLook = isDestructive(step) || !!finding?.needsChoice || step.action === 'mergeValues'

  const doApply = (result?: ActionResult) => {
    if (apply(step, result)) onDone?.()
  }

  const quickApply = () => {
    if (needsLook) {
      setOpen(true)
      setAskedToApply(true)
      return
    }
    let result: ActionResult
    try {
      result = runStep(table, step)
    } catch {
      setOpen(true)
      return
    }
    if (blockedReason(step, result, finding, orderChosen)) {
      setOpen(true)
      setAskedToApply(true)
      return
    }
    doApply(result)
  }

  const headingId = `${id}-title`
  return (
    <Card className={cx('scroll-mt-24 p-4', open && 'ring-2 ring-teal-600/30')} data-testid={`fix-${id}`}>
      <div ref={ref} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={headingId} tabIndex={-1} className="font-semibold text-slate-900 focus:outline-none">
            {title}
          </h3>
          <p className="mt-1 text-sm text-slate-600">{explanation}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {countLabel && <Badge>{countLabel}</Badge>}
            {badge}
          </div>
        </div>
      </div>

      {!open && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setOpen(true)} aria-describedby={headingId}>
            <Eye className="h-4 w-4" aria-hidden /> Preview
          </Button>
          <Button size="sm" variant="primary" onClick={quickApply} aria-describedby={headingId}>
            <Wand2 className="h-4 w-4" aria-hidden /> Apply fix
          </Button>
        </div>
      )}

      {open && (
        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
          {askedToApply && <Alert tone="info">Check the settings and the preview below, then press “Apply fix”.</Alert>}
          <StepOptions
            step={step}
            onChange={setStep}
            table={table}
            finding={finding}
            clusterState={finding?.clusters ? { choices, setChoices } : undefined}
            orderChosen={orderChosen}
            onOrderChosen={() => setOrderChosen(true)}
          />
          <div>
            <h4 className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <ChevronDown className="h-3 w-3" aria-hidden /> Preview
            </h4>
            {step.action === 'formatDates' && !orderChosen ? (
              <AmbiguousDates table={table} column={step.params.column} />
            ) : preview?.error ? (
              <Alert tone="error">{preview.error}</Alert>
            ) : preview?.result ? (
              <ChangePreview result={preview.result} />
            ) : null}
          </div>
          {blocked && !preview?.error && <p className="text-sm text-amber-800">{blocked}</p>}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              disabled={!!blocked || !preview?.result}
              onClick={() => doApply(preview?.result ?? undefined)}
              aria-describedby={headingId}
            >
              <Wand2 className="h-4 w-4" aria-hidden />
              {isDestructive(step) && preview?.result
                ? `Apply fix: remove ${plural(preview.result.affected, preview.result.unit === 'columns' ? 'column' : 'row')}`
                : 'Apply fix'}
            </Button>
            <Button
              onClick={() => {
                setOpen(false)
                setAskedToApply(false)
                setStep(initial)
                onDone?.()
              }}
            >
              Cancel
            </Button>
          </div>
          <p className="text-xs text-slate-500">Step: {describeStep(step)}. You can undo it afterwards.</p>
        </div>
      )}
    </Card>
  )
}
