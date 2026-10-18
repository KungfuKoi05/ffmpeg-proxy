import { ArrowRight, CheckCircle2, Eye, ListFilter, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { Finding, Rule, RuleKind, Severity } from '../../engine/types'
import { TYPE_LABEL, describeProfile } from '../../engine/profile'
import { useApp } from '../../state'
import { DataTable } from '../DataTable'
import { Alert, Badge, Button, Card, Select, Spinner, TextInput } from '../ui'

export const SEVERITY: Record<Severity, { label: string; tone: 'important' | 'check' | 'info' }> = {
  important: { label: 'Important', tone: 'important' },
  check: { label: 'Worth checking', tone: 'check' },
  info: { label: 'Good to know', tone: 'info' },
}

export function BasisBadge({ basis }: { basis: Finding['basis'] }) {
  if (basis === 'confirmed') return <Badge tone="success">Confirmed</Badge>
  if (basis === 'rule') return <Badge tone="neutral">Your check</Badge>
  return <Badge tone="guess">Our guess: please check</Badge>
}

function FindingCard({ f }: { f: Finding }) {
  const { setStep, setFocusFix, setRowFilter } = useApp()
  const showRows = () => {
    setRowFilter({ label: f.title, rowIds: f.rowIds ?? [] })
    document.getElementById('your-data')?.scrollIntoView?.({ behavior: 'smooth' })
  }
  return (
    <Card className="p-4" data-testid={`finding-${f.id}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={SEVERITY[f.severity].tone}>{SEVERITY[f.severity].label}</Badge>
        <BasisBadge basis={f.basis} />
      </div>
      <h3 className="mt-2 font-semibold text-slate-900">{f.title}</h3>
      <p className="mt-1 break-words text-sm text-slate-700">{f.detail}</p>
      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="font-medium text-slate-800">Why it matters</dt>
          <dd className="text-slate-600">{f.why}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-800">Suggested fix</dt>
          <dd className="text-slate-600">{f.suggestion}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        {f.fix && (
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setFocusFix(f.id)
              setStep(3)
            }}
          >
            <Eye className="h-4 w-4" aria-hidden /> Preview fix
          </Button>
        )}
        {f.fixAtExport && (
          <Button size="sm" variant="primary" onClick={() => setStep(4)}>
            <Eye className="h-4 w-4" aria-hidden /> See download options
          </Button>
        )}
        {f.rowIds && f.rowIds.length > 0 && (
          <Button size="sm" onClick={showRows}>
            <ListFilter className="h-4 w-4" aria-hidden /> Show {f.rowIds.length === 1 ? 'this row' : `these ${f.rowIds.length.toLocaleString('en-US')} rows`}
          </Button>
        )}
      </div>
    </Card>
  )
}

const RULE_KINDS: { value: RuleKind; label: string }[] = [
  { value: 'required', label: 'must not be empty' },
  { value: 'unique', label: 'must be different on every row' },
  { value: 'email', label: 'must contain email addresses' },
  { value: 'number', label: 'must contain numbers' },
  { value: 'date', label: 'must contain dates' },
  { value: 'allowed', label: 'may only contain certain values' },
]

export function RulesPanel() {
  const { session, setRules, table } = useApp()
  const [column, setColumn] = useState('')
  const [kind, setKind] = useState<RuleKind>('required')
  const [allowed, setAllowed] = useState('')
  if (!session || !table) return null
  const col = column || table.headers[0]
  const add = () => {
    const rule: Rule = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      column: col,
      kind,
      allowed: kind === 'allowed' ? allowed.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
    }
    setRules([...session.rules, rule])
    setAllowed('')
  }
  return (
    <Card className="p-5">
      <h2 className="font-semibold text-slate-900">Your own checks</h2>
      <p className="mt-1 text-sm text-slate-600">Tell CleanCSV what this file must look like, for example “Product ID must not be empty”. These are saved with recipes.</p>
      {session.rules.length > 0 && (
        <ul className="mt-3 space-y-1">
          {session.rules.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm">
              <span>
                “{r.column}” {RULE_KINDS.find((k) => k.value === r.kind)?.label}
                {r.kind === 'allowed' && r.allowed ? `: ${r.allowed.join(', ')}` : ''}
              </span>
              <Button size="sm" variant="ghost" aria-label={`Remove the check on ${r.column}`} onClick={() => setRules(session.rules.filter((x) => x.id !== r.id))}>
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Select label="Column" value={col} onChange={setColumn} options={table.headers.map((h) => ({ value: h, label: h }))} />
        <Select label="Rule" value={kind} onChange={(v) => setKind(v as RuleKind)} options={RULE_KINDS} />
        <Button onClick={add} disabled={kind === 'allowed' && allowed.trim() === ''}>
          <Plus className="h-4 w-4" aria-hidden /> Add check
        </Button>
      </div>
      {kind === 'allowed' && (
        <div className="mt-3">
          <TextInput label="Allowed values, separated by commas" value={allowed} onChange={setAllowed} placeholder="Small, Medium, Large" />
        </div>
      )}
    </Card>
  )
}

export function ColumnOverview() {
  const { analysis } = useApp()
  if (!analysis) return null
  return (
    <Card className="p-5">
      <h2 className="font-semibold text-slate-900">Column overview</h2>
      <p className="mt-1 text-sm text-slate-600">What each column contains. The “looks like” column is our guess from the values.</p>
      <ul className="mt-3 divide-y divide-slate-100 md:hidden">
        {analysis.profiles.map((p) => (
          <li key={p.index} className="py-2 text-sm">
            <p className="text-slate-800">{describeProfile(p)}</p>
            <p className="text-xs text-slate-500">Looks like {TYPE_LABEL[p.type]}</p>
          </li>
        ))}
      </ul>
      <div className="mt-3 hidden overflow-x-auto md:block">
        <table className="min-w-full text-left text-sm">
          <caption className="sr-only">Column overview</caption>
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="py-2 pr-4 font-medium">Column</th>
              <th scope="col" className="py-2 pr-4 font-medium">Looks like (guess)</th>
              <th scope="col" className="py-2 pr-4 font-medium">Filled</th>
              <th scope="col" className="py-2 pr-4 font-medium">Different values</th>
              <th scope="col" className="py-2 pr-4 font-medium">Invalid-looking</th>
              <th scope="col" className="py-2 font-medium">Most common</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {analysis.profiles.map((p) => (
              <tr key={p.index}>
                <th scope="row" className="py-2 pr-4 font-medium text-slate-900">{p.name}</th>
                <td className="py-2 pr-4 text-slate-600">{TYPE_LABEL[p.type]}</td>
                <td className="py-2 pr-4 tabular-nums">
                  {p.total ? Math.round((p.filled / p.total) * 100) : 0}% <span className="text-slate-500">({p.filled.toLocaleString('en-US')})</span>
                </td>
                <td className="py-2 pr-4 tabular-nums">{p.unique.toLocaleString('en-US')}</td>
                <td className="py-2 pr-4 tabular-nums">{p.invalid > 0 ? <span className="text-amber-800">{p.invalid.toLocaleString('en-US')}</span> : '–'}</td>
                <td className="max-w-[16rem] truncate py-2 text-slate-600">
                  {p.topValues
                    .slice(0, 3)
                    .map((v) => `${v.value} (${v.count})`)
                    .join(', ') || '–'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export function ProblemsStep() {
  const { analysis, analysisPending, table, session, setStep, rowFilter, setRowFilter } = useApp()
  if (!table || !session) return null
  if (!analysis) {
    return (
      <Card className="p-6">
        <Spinner label="Checking your file for problems… Big files can take a few seconds." />
      </Card>
    )
  }
  const { findings } = analysis
  const bySev = (s: Severity) => findings.filter((f) => f.severity === s)
  const counts = { important: bySev('important').length, check: bySev('check').length, info: bySev('info').length }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900" data-testid="findings-heading">
            {findings.length === 0
              ? 'We didn’t find any common problems.'
              : `Your file has ${findings.length} ${findings.length === 1 ? 'thing' : 'things'} worth checking.`}
          </h2>
          <p className="mt-1 text-slate-600">
            {table.rows.length.toLocaleString('en-US')} rows and {table.headers.length} columns.{' '}
            {findings.length > 0 && (
              <>
                {counts.important} important, {counts.check} worth checking, {counts.info} good to know.
              </>
            )}
          </p>
        </div>
        <Button variant="primary" size="lg" onClick={() => setStep(3)}>
          Start cleaning <ArrowRight className="h-5 w-5" aria-hidden />
        </Button>
      </div>

      {analysisPending && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
          <Spinner label="Updating the list of problems after your last change…" />
        </div>
      )}
      {findings.length === 0 && !analysisPending && (
        <Alert tone="success" title="Looks clean">
          No duplicates, stray spaces, inconsistent values or unreadable dates were found. You can still use the cleaning tools, or go straight to download.
        </Alert>
      )}

      {(['important', 'check', 'info'] as Severity[]).map((s) =>
        bySev(s).length ? (
          <section key={s} aria-labelledby={`sev-${s}`}>
            <h2 id={`sev-${s}`} className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {SEVERITY[s].label} ({bySev(s).length})
            </h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {bySev(s).map((f) => (
                <FindingCard key={f.id} f={f} />
              ))}
            </div>
          </section>
        ) : null,
      )}

      {session.meta.warnings.length > 0 && (
        <details className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <summary className="cursor-pointer font-medium text-slate-800">Notes from reading the file ({session.meta.warnings.length})</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
            {session.meta.warnings.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        </details>
      )}

      <ColumnOverview />
      <RulesPanel />

      <section id="your-data" className="scroll-mt-20 space-y-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <CheckCircle2 className="h-5 w-5 text-teal-700" aria-hidden /> Your data
        </h2>
        <DataTable
          key={rowFilter?.label ?? 'all'}
          table={table}
          profiles={analysis.profiles}
          filter={rowFilter}
          onClearFilter={() => setRowFilter(null)}
          caption="Your data"
        />
      </section>
    </div>
  )
}
