// The settings form for each kind of cleaning step. Every control changes the step,
// and the preview below it updates from the real result.

import type { ReactNode } from 'react'
import type { CaseMode, CheckKind, DateOrder, DateOutput, Finding, HeaderStyle, PhoneFormat, Step, Table } from '../engine/types'
import { STRONG_PLACEHOLDERS, WEAK_PLACEHOLDERS } from '../engine/values'
import { PHONE_COUNTRIES } from '../engine/phones'
import { styleHeader } from '../engine/actions'
import type { ValueCluster } from '../engine/clusters'
import { Badge, Checkbox, RadioGroup, Select, ShowValue, TextInput } from './ui'

type SetStep = (s: Step) => void

function ColumnSelect({ table, value, onChange, label = 'Column' }: { table: Table; value: string; onChange: (v: string) => void; label?: string }) {
  return <Select label={label} value={value} onChange={onChange} options={table.headers.map((h) => ({ value: h, label: h }))} />
}

function ColumnsPicker({ table, value, onChange, allLabel = 'All columns' }: { table: Table; value: string[]; onChange: (v: string[]) => void; allLabel?: string }) {
  const some = value.length > 0
  return (
    <div className="space-y-2">
      <RadioGroup
        legend="Which columns?"
        value={some ? 'some' : 'all'}
        onChange={(v) => onChange(v === 'all' ? [] : [table.headers[0]])}
        options={[
          { value: 'all', label: allLabel },
          { value: 'some', label: 'Only the columns I pick' },
        ]}
      />
      {some && (
        <div className="grid max-h-48 grid-cols-1 gap-1.5 overflow-y-auto rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
          {table.headers.map((h) => (
            <Checkbox
              key={h}
              label={<ShowValue value={h} className="font-sans text-sm" />}
              checked={value.includes(h)}
              onChange={(on) => {
                const next = on ? [...value, h] : value.filter((x) => x !== h)
                onChange(next.length ? table.headers.filter((x) => next.includes(x)) : [h])
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export interface ClusterChoice {
  on: boolean
  include: string[]
  target: string
}

export function clusterChoices(clusters: ValueCluster[]): ClusterChoice[] {
  return clusters.map((c) => ({ on: c.preselected, include: c.values.map((v) => v.value), target: c.suggested }))
}

export function groupsFromChoices(clusters: ValueCluster[], choices: ClusterChoice[]) {
  return clusters
    .map((_, i) => choices[i])
    .filter((ch) => ch.on && ch.target.trim() !== '')
    .map((ch) => ({ from: ch.include.filter((v) => v !== ch.target), to: ch.target }))
    .filter((g) => g.from.length > 0)
}

const KIND_LABEL: Record<ValueCluster['kind'], { text: string; tone: 'success' | 'guess' | 'check' }> = {
  case: { text: 'Only capitals or spaces differ', tone: 'success' },
  synonym: { text: 'Known alternative names', tone: 'guess' },
  spelling: { text: 'Similar spelling: check carefully', tone: 'check' },
}

function ClusterEditor({ clusters, choices, onChange }: { clusters: ValueCluster[]; choices: ClusterChoice[]; onChange: (c: ClusterChoice[]) => void }) {
  const set = (i: number, patch: Partial<ClusterChoice>) => onChange(choices.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-700">Tick each group that really is the same thing. Nothing is combined until you press Apply.</p>
      {clusters.map((cl, i) => {
        const ch = choices[i]
        return (
          <div key={i} className="rounded-lg border border-slate-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Checkbox label={<span className="font-medium">Combine this group</span>} checked={ch.on} onChange={(on) => set(i, { on })} />
              <Badge tone={KIND_LABEL[cl.kind].tone}>{KIND_LABEL[cl.kind].text}</Badge>
            </div>
            <div className="mt-3 space-y-2 pl-6">
              <ul className="space-y-1">
                {cl.values.map((v) =>
                  ch.on ? (
                    <li key={v.value}>
                      <Checkbox
                        label={
                          <span>
                            <ShowValue value={v.value} className="font-sans text-sm" />{' '}
                            <span className="text-slate-500">({v.count.toLocaleString('en-US')} rows)</span>
                          </span>
                        }
                        checked={ch.include.includes(v.value)}
                        onChange={(on) => set(i, { include: on ? [...ch.include, v.value] : ch.include.filter((x) => x !== v.value) })}
                      />
                    </li>
                  ) : (
                    <li key={v.value} className="text-sm text-slate-700">
                      <ShowValue value={v.value} className="font-sans text-sm" /> <span className="text-slate-500">({v.count.toLocaleString('en-US')} rows)</span>
                    </li>
                  ),
                )}
              </ul>
              {ch.on && <TextInput label="Change the ticked values to" value={ch.target} onChange={(target) => set(i, { target })} />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const DATE_OUTPUTS: { value: DateOutput; label: string }[] = [
  { value: 'YYYY-MM-DD', label: '2026-03-04 (year-month-day, safest)' },
  { value: 'MM/DD/YYYY', label: '03/04/2026 (month/day/year, US)' },
  { value: 'DD/MM/YYYY', label: '04/03/2026 (day/month/year)' },
  { value: 'D MMM YYYY', label: '4 Mar 2026' },
  { value: 'MMM D, YYYY', label: 'Mar 4, 2026' },
]

export function StepOptions({
  step,
  onChange,
  table,
  finding,
  clusterState,
  orderChosen,
  onOrderChosen,
}: {
  step: Step
  onChange: SetStep
  table: Table
  finding?: Finding
  clusterState?: { choices: ClusterChoice[]; setChoices: (c: ClusterChoice[]) => void }
  orderChosen: boolean
  onOrderChosen: () => void
}): ReactNode {
  switch (step.action) {
    case 'removeDuplicates': {
      const p = step.params
      return (
        <div className="space-y-4">
          <ColumnsPicker
            table={table}
            value={p.columns}
            allLabel="Rows count as duplicates only if every column matches"
            onChange={(columns) => onChange({ ...step, params: { ...p, columns } })}
          />
          <Checkbox label="Ignore capital letters when comparing" checked={p.ignoreCase} onChange={(ignoreCase) => onChange({ ...step, params: { ...p, ignoreCase } })} />
          <Checkbox label="Ignore extra spaces when comparing" checked={p.ignoreSpaces} onChange={(ignoreSpaces) => onChange({ ...step, params: { ...p, ignoreSpaces } })} />
          <RadioGroup
            legend="Which copy should stay?"
            value={p.keep}
            onChange={(keep) => onChange({ ...step, params: { ...p, keep } })}
            options={[
              { value: 'first', label: 'Keep the first one (highest in the file)' },
              { value: 'last', label: 'Keep the last one (lowest in the file)' },
            ]}
          />
          {p.columns.length > 0 && <p className="text-xs text-slate-500">Rows where the chosen columns are all empty are always kept.</p>}
        </div>
      )
    }
    case 'trimWhitespace': {
      const p = step.params
      return (
        <div className="space-y-4">
          <ColumnsPicker table={table} value={p.columns} onChange={(columns) => onChange({ ...step, params: { ...p, columns } })} />
          <Checkbox
            label="Also replace double spaces inside values with a single space"
            hint="Spaces at the start and end are always removed. Line breaks inside cells are kept."
            checked={p.collapseSpaces}
            onChange={(collapseSpaces) => onChange({ ...step, params: { ...p, collapseSpaces } })}
          />
        </div>
      )
    }
    case 'cleanHeaders': {
      const example = (s: HeaderStyle) => table.headers.slice(0, 3).map((h) => styleHeader(h, s) || '…').join(', ')
      return (
        <RadioGroup
          legend="Style for column names"
          value={step.params.style}
          onChange={(style: HeaderStyle) => onChange({ ...step, params: { style } })}
          options={[
            { value: 'tidy', label: 'Just remove extra spaces', hint: example('tidy') },
            { value: 'title', label: 'Title Case', hint: example('title') },
            { value: 'snake', label: 'lower_case_with_underscores (good for databases)', hint: example('snake') },
            { value: 'lower', label: 'lowercase', hint: example('lower') },
          ]}
        />
      )
    }
    case 'replaceMissing': {
      const p = step.params
      const found = finding?.id === 'placeholders' ? (finding.examples ?? []) : []
      const options = [...new Set([...found, ...STRONG_PLACEHOLDERS, ...WEAK_PLACEHOLDERS])]
      const has = (x: string) => p.placeholders.some((y) => y.toLowerCase() === x.toLowerCase())
      return (
        <div className="space-y-4">
          <Checkbox
            label="Empty cells"
            checked={p.includeBlank}
            onChange={(includeBlank) => onChange({ ...step, params: { ...p, includeBlank } })}
          />
          <fieldset>
            <legend className="mb-1 text-sm font-medium text-slate-800">Text that means “no value”</legend>
            <p className="mb-2 text-xs text-slate-500">
              {found.length > 0 ? 'Found in your file: ' + found.slice(0, 6).map((f) => `"${f}"`).join(', ') + '. ' : ''}
              Some words, like “None” or “NA”, can be real answers, so they start unticked.
            </p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {options.map((o) => (
                <Checkbox
                  key={o}
                  label={<span className="font-mono text-[13px]">{o}</span>}
                  checked={has(o)}
                  onChange={(on) =>
                    onChange({ ...step, params: { ...p, placeholders: on ? [...p.placeholders, o] : p.placeholders.filter((y) => y.toLowerCase() !== o.toLowerCase()) } })
                  }
                />
              ))}
            </div>
          </fieldset>
          <TextInput
            label="Replace them with"
            value={p.replaceWith}
            placeholder="Leave empty to make the cells empty"
            hint={p.includeBlank ? 'For empty cells, type a value such as “Unknown” or “0”.' : 'Leave this empty to make the matching cells empty.'}
            onChange={(replaceWith) => onChange({ ...step, params: { ...p, replaceWith } })}
          />
          <ColumnsPicker table={table} value={p.columns} onChange={(columns) => onChange({ ...step, params: { ...p, columns } })} />
        </div>
      )
    }
    case 'changeCase': {
      const p = step.params
      return (
        <div className="space-y-4">
          <ColumnSelect table={table} value={p.column} onChange={(column) => onChange({ ...step, params: { ...p, column } })} />
          <RadioGroup
            legend="Change to"
            value={p.mode}
            onChange={(mode: CaseMode) => onChange({ ...step, params: { ...p, mode } })}
            options={[
              { value: 'title', label: 'Title Case (John Smith)' },
              { value: 'upper', label: 'UPPERCASE (JOHN SMITH)' },
              { value: 'lower', label: 'lowercase (john smith)' },
              { value: 'sentence', label: 'Sentence case (John smith)' },
            ]}
          />
        </div>
      )
    }
    case 'mergeValues':
      if (finding?.clusters && clusterState) {
        return <ClusterEditor clusters={finding.clusters} choices={clusterState.choices} onChange={clusterState.setChoices} />
      }
      return <p className="text-sm text-slate-600">This step combines values chosen earlier.</p>
    case 'formatDates': {
      const p = step.params
      const needOrder = finding?.needsChoice === 'dateOrder' && !orderChosen
      return (
        <div className="space-y-4">
          <ColumnSelect table={table} value={p.column} onChange={(column) => onChange({ ...step, params: { ...p, column } })} />
          {finding?.hint && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{finding.hint}</p>}
          <Select
            label="How should dates like 03/04/2026 be read?"
            value={needOrder ? '' : p.order}
            placeholder={needOrder ? 'Choose… (required)' : undefined}
            onChange={(v) => {
              onOrderChosen()
              onChange({ ...step, params: { ...p, order: v as DateOrder } })
            }}
            options={[
              { value: 'MDY', label: 'Month first: 03/04/2026 is March 4 (US style)' },
              { value: 'DMY', label: 'Day first: 03/04/2026 is 3 April (UK, Europe, most of the world)' },
              { value: 'YMD', label: 'Only convert dates that are not ambiguous' },
            ]}
          />
          <Select label="Change them to" value={p.output} onChange={(v) => onChange({ ...step, params: { ...p, output: v as DateOutput } })} options={DATE_OUTPUTS} />
        </div>
      )
    }
    case 'cleanNumbers': {
      const p = step.params
      return (
        <div className="space-y-4">
          <ColumnSelect table={table} value={p.column} onChange={(column) => onChange({ ...step, params: { ...p, column } })} />
          {finding?.hint && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{finding.hint}</p>}
          <RadioGroup
            legend="Which symbol marks decimals?"
            value={p.decimal}
            onChange={(decimal: '.' | ',') => onChange({ ...step, params: { ...p, decimal } })}
            options={[
              { value: '.', label: 'A dot: 1,234.50 means one thousand two hundred thirty-four and a half' },
              { value: ',', label: 'A comma: 1.234,50 means the same (common in Europe)' },
            ]}
          />
        </div>
      )
    }
    case 'formatPhones': {
      const p = step.params
      return (
        <div className="space-y-4">
          <ColumnSelect table={table} value={p.column} onChange={(column) => onChange({ ...step, params: { ...p, column } })} />
          <Select
            label="Country for numbers without a + code"
            value={p.country}
            onChange={(country) => onChange({ ...step, params: { ...p, country } })}
            options={PHONE_COUNTRIES.map((c) => ({ value: c.code, label: c.name }))}
          />
          <RadioGroup
            legend="Format"
            value={p.format}
            onChange={(format: PhoneFormat) => onChange({ ...step, params: { ...p, format } })}
            options={[
              { value: 'INTERNATIONAL', label: 'International, readable: +1 555 010 0101' },
              { value: 'E164', label: 'International, no spaces: +15550100101 (best for texting tools)' },
              { value: 'NATIONAL', label: 'National: (555) 010-0101' },
            ]}
          />
        </div>
      )
    }
    case 'lowercaseEmails':
      return <ColumnSelect table={table} value={step.params.column} onChange={(column) => onChange({ ...step, params: { column } })} />
    case 'addCheckColumn': {
      const p = step.params
      return (
        <div className="space-y-4">
          <ColumnSelect table={table} value={p.column} onChange={(column) => onChange({ ...step, params: { ...p, column } })} />
          <Select
            label="Check that each value is"
            value={p.check}
            onChange={(v) => onChange({ ...step, params: { ...p, check: v as CheckKind } })}
            options={[
              { value: 'email', label: 'a valid-looking email address' },
              { value: 'phone', label: 'a complete phone number' },
              { value: 'date', label: 'a date we can read' },
              { value: 'number', label: 'a number' },
            ]}
          />
          <p className="text-xs text-slate-500">A new column is added next to it with “OK” or the problem, so you can filter it in your spreadsheet. The original values are not changed.</p>
        </div>
      )
    }
    case 'findReplace': {
      const p = step.params
      return (
        <div className="space-y-4">
          <TextInput label="Find" value={p.find} autoFocus onChange={(find) => onChange({ ...step, params: { ...p, find } })} />
          <TextInput label="Replace with" value={p.replace} placeholder="Leave empty to delete the text" onChange={(replace) => onChange({ ...step, params: { ...p, replace } })} />
          <Checkbox label="Match capital letters exactly" checked={p.matchCase} onChange={(matchCase) => onChange({ ...step, params: { ...p, matchCase } })} />
          <Checkbox label="Only replace cells that contain exactly this text and nothing else" checked={p.wholeCell} onChange={(wholeCell) => onChange({ ...step, params: { ...p, wholeCell } })} />
          <ColumnsPicker table={table} value={p.columns} onChange={(columns) => onChange({ ...step, params: { ...p, columns } })} />
        </div>
      )
    }
    case 'renameColumn': {
      const p = step.params
      return (
        <div className="space-y-4">
          <ColumnSelect table={table} value={p.column} onChange={(column) => onChange({ ...step, params: { ...p, column } })} />
          <TextInput label="New name" value={p.to} autoFocus onChange={(to) => onChange({ ...step, params: { ...p, to } })} />
        </div>
      )
    }
    case 'removeColumn':
      return <ColumnSelect table={table} value={step.params.column} onChange={(column) => onChange({ ...step, params: { column } })} />
    case 'removeEmptyRows':
    case 'removeEmptyColumns':
      return null
  }
}
