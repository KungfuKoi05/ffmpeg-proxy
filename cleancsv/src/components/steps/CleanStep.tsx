import { ArrowRight, BookOpen, CheckCircle2, Save, Wrench } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ColumnProfile, Finding, Step, Table } from '../../engine/types'
import { plural } from '../../engine/values'
import { useApp } from '../../state'
import { DataTable } from '../DataTable'
import { FixCard } from '../FixCard'
import { ChangesCard, UndoRedoBar } from '../HistoryControls'
import { ApplyRecipeDialog, SaveRecipeDialog } from '../RecipeDialogs'
import { BasisBadge, SEVERITY } from './ProblemsStep'
import { Alert, Badge, Button, Card, Spinner } from '../ui'

function unitLabel(f: Finding): string {
  const unit = { rows: 'row', cells: 'cell', columns: 'column', values: 'value' }[f.unit]
  return `Affects ${plural(f.count, unit)}`
}

const FIX_TITLES: Record<Step['action'], string> = {
  removeDuplicates: 'Remove duplicate rows',
  removeEmptyRows: 'Remove empty rows',
  removeEmptyColumns: 'Remove empty columns',
  trimWhitespace: 'Remove extra spaces',
  cleanHeaders: 'Standardize column names',
  replaceMissing: 'Replace missing values',
  changeCase: 'Fix inconsistent capitalization',
  mergeValues: 'Fix inconsistent category names',
  formatDates: 'Convert dates to one format',
  cleanNumbers: 'Turn values into plain numbers',
  formatPhones: 'Standardize phone number formatting',
  lowercaseEmails: 'Make emails lowercase',
  addCheckColumn: 'Mark rows with a problem',
  findReplace: 'Find and replace',
  renameColumn: 'Rename a column',
  removeColumn: 'Remove a column',
}

function fixTitle(f: Finding): string {
  const base = baseFixTitle(f)
  return f.column && !base.includes(`“${f.column}”`) && f.id !== 'blank-cells' ? `${base} in “${f.column}”` : base
}

function baseFixTitle(f: Finding): string {
  if (!f.fix) return f.title
  if (f.id === 'near-duplicate-rows') return 'Remove rows that are almost the same'
  if (f.id.startsWith('repeated:')) return `Remove rows that repeat “${f.column}”`
  if (f.id === 'blank-cells') return 'Replace blank cells with a value'
  if (f.id === 'placeholders') return 'Make placeholder text (N/A, NULL…) empty'
  if (f.id.startsWith('emails:')) return 'Mark invalid email addresses'
  if (f.id.startsWith('bad-phones:')) return 'Mark incomplete phone numbers'
  return FIX_TITLES[f.fix.action]
}

const toolFinding = (needsChoice: Finding['needsChoice']): Finding => ({
  id: 'tool',
  severity: 'info',
  basis: 'confirmed',
  title: '',
  detail: '',
  why: '',
  suggestion: '',
  count: 0,
  unit: 'cells',
  needsChoice,
})

interface Tool {
  id: string
  label: string
  explain: string
  step: (t: Table, p: ColumnProfile[]) => Step
  needsChoice?: Finding['needsChoice']
}

const firstOf = (t: Table, p: ColumnProfile[], type?: ColumnProfile['type']) => (type && p.find((x) => x.type === type)?.name) || t.headers[0]

const TOOLS: Tool[] = [
  { id: 'find', label: 'Find and replace', explain: 'Change text in one column or everywhere.', step: () => ({ action: 'findReplace', params: { columns: [], find: '', replace: '', matchCase: false, wholeCell: false } }) },
  { id: 'dedupe', label: 'Remove duplicates', explain: 'Remove rows that repeat the same values, in all or some columns.', step: () => ({ action: 'removeDuplicates', params: { columns: [], ignoreCase: false, ignoreSpaces: true, keep: 'first' } }) },
  { id: 'trim', label: 'Remove extra spaces', explain: 'Trim spaces at the start and end of cells.', step: () => ({ action: 'trimWhitespace', params: { columns: [], collapseSpaces: false } }) },
  { id: 'case', label: 'Change capitalization', explain: 'Make a column Title Case, UPPERCASE or lowercase.', step: (t, p) => ({ action: 'changeCase', params: { column: firstOf(t, p, 'text'), mode: 'title' } }) },
  { id: 'fill', label: 'Fill empty cells', explain: 'Put a value such as “Unknown” in empty cells.', needsChoice: 'fillValue', step: (t) => ({ action: 'replaceMissing', params: { columns: [t.headers[0]], placeholders: [], includeBlank: true, replaceWith: '' } }) },
  { id: 'dates', label: 'Format dates', explain: 'Convert a column of dates to one format.', needsChoice: 'dateOrder', step: (t, p) => ({ action: 'formatDates', params: { column: firstOf(t, p, 'date'), order: 'MDY', output: 'YYYY-MM-DD' } }) },
  { id: 'numbers', label: 'Clean up numbers', explain: 'Remove currency symbols and thousands separators.', step: (t, p) => ({ action: 'cleanNumbers', params: { column: firstOf(t, p, 'number'), decimal: '.' } }) },
  { id: 'phones', label: 'Format phone numbers', explain: 'Write every phone number the same way.', step: (t, p) => ({ action: 'formatPhones', params: { column: firstOf(t, p, 'phone'), country: 'US', format: 'INTERNATIONAL' } }) },
  { id: 'check', label: 'Mark rows with a problem', explain: 'Add a column that says whether each email, phone, date or number looks valid.', step: (t, p) => ({ action: 'addCheckColumn', params: { column: firstOf(t, p, 'email'), check: 'email' } }) },
  { id: 'headers', label: 'Standardize column names', explain: 'Use one naming style for every column.', step: () => ({ action: 'cleanHeaders', params: { style: 'title' } }) },
  { id: 'rename', label: 'Rename a column', explain: 'Give one column a new name.', step: (t) => ({ action: 'renameColumn', params: { column: t.headers[0], to: '' } }) },
  { id: 'remove', label: 'Remove a column', explain: 'Delete a column you do not need.', step: (t) => ({ action: 'removeColumn', params: { column: t.headers[t.headers.length - 1] } }) },
]

function ToolsPanel({ table, profiles }: { table: Table; profiles: ColumnProfile[] }) {
  const { recipes, session } = useApp()
  const [tool, setTool] = useState<Tool | null>(null)
  const [recipeOpen, setRecipeOpen] = useState(false)
  return (
    <Card className="p-4">
      <h2 className="flex items-center gap-2 font-semibold text-slate-900">
        <Wrench className="h-4 w-4 text-slate-500" aria-hidden /> More cleaning tools
      </h2>
      {tool ? (
        <div className="mt-3">
          <FixCard
            key={`${tool.id}-${session?.cursor}`}
            id={`tool-${tool.id}`}
            title={tool.label}
            explanation={tool.explain}
            initial={tool.step(table, profiles)}
            finding={tool.needsChoice ? toolFinding(tool.needsChoice) : undefined}
            table={table}
            startOpen
            onDone={() => setTool(null)}
          />
        </div>
      ) : (
        <ul className="mt-3 grid gap-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {TOOLS.map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => setTool(t)} className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600">
                {t.label}
              </button>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => setRecipeOpen(true)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-teal-800 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600">
              <BookOpen className="h-4 w-4" aria-hidden /> Apply a saved recipe {recipes.length > 0 && `(${recipes.length})`}
            </button>
          </li>
        </ul>
      )}
      <ApplyRecipeDialog open={recipeOpen} onOpenChange={setRecipeOpen} />
    </Card>
  )
}

export function CleanStep() {
  const { analysis, analysisPending, table, session, setStep, rowFilter, setRowFilter, pendingRecipe, setPendingRecipe } = useApp()
  const [saveOpen, setSaveOpen] = useState(false)
  const highlight = useMemo(() => {
    const set = new Set<string>()
    if (!session || session.cursor === 0) return set
    const last = session.entries[session.cursor - 1]
    for (const c of last.result.changes.cells.slice(0, 50_000)) set.add(`${c.rowId}:${c.column}`)
    return set
  }, [session])
  if (!table || !session) return null
  if (!analysis) {
    return (
      <Card className="p-6">
        <Spinner label="Checking your file for problems… Big files can take a few seconds." />
      </Card>
    )
  }

  const fixable = analysis.findings.filter((f) => f.fix)
  const manual = analysis.findings.filter((f) => !f.fix && !f.fixAtExport && f.severity !== 'info')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Clean the file</h2>
          <p className="mt-1 text-slate-600">Preview each fix to see exactly what will change. Everything can be undone.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setSaveOpen(true)} disabled={session.cursor === 0}>
            <Save className="h-4 w-4" aria-hidden /> Save steps as a recipe
          </Button>
          <Button variant="primary" size="lg" onClick={() => setStep(4)}>
            Download <ArrowRight className="h-5 w-5" aria-hidden />
          </Button>
        </div>
      </div>
      <div className="sticky top-14 z-20 -mx-4 border-y border-slate-200 bg-slate-50/95 px-4 py-2 backdrop-blur lg:top-0">
        <UndoRedoBar />
      </div>
      {analysisPending && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
          <Spinner label="Updating the list of problems after your last change…" />
        </div>
      )}


      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Recommended fixes ({fixable.length})</h2>
          {fixable.length === 0 && (
            <Alert tone="success" title="No recommended fixes left">
              Use the tools below for anything else, or go to Download.
            </Alert>
          )}
          {fixable.map((f) => (
            <FixCard
              key={`${f.id}-${session.cursor}`}
              id={f.id}
              title={fixTitle(f)}
              explanation={f.detail}
              countLabel={unitLabel(f)}
              badge={
                <>
                  <Badge tone={SEVERITY[f.severity].tone}>{SEVERITY[f.severity].label}</Badge>
                  <BasisBadge basis={f.basis} />
                </>
              }
              initial={f.fix!}
              finding={f}
              table={table}
            />
          ))}
          {manual.length > 0 && (
            <Alert tone="info" title={`${manual.length} problem${manual.length === 1 ? '' : 's'} need${manual.length === 1 ? 's' : ''} a person to fix`}>
              <ul className="list-disc pl-4">
                {manual.map((f) => (
                  <li key={f.id}>
                    {f.title}{' '}
                    {f.rowIds && (
                      <button type="button" className="font-medium text-teal-800 underline" onClick={() => setRowFilter({ label: f.title, rowIds: f.rowIds ?? [] })}>
                        Show rows
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </Alert>
          )}
          <ToolsPanel table={table} profiles={analysis.profiles} />
          <ChangesCard />
        </div>
        <div className="min-w-0 space-y-2 self-start lg:sticky lg:top-16">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            <CheckCircle2 className="h-4 w-4 text-teal-700" aria-hidden /> Your data, as it is now
          </h2>
          <DataTable
            key={rowFilter?.label ?? 'all'}
            table={table}
            profiles={analysis.profiles}
            filter={rowFilter}
            onClearFilter={() => setRowFilter(null)}
            highlight={highlight}
            caption="Your data, as it is now"
          />
        </div>
      </div>
      <SaveRecipeDialog open={saveOpen} onOpenChange={setSaveOpen} />
      <ApplyRecipeDialog key={pendingRecipe ?? "none"} open={!!pendingRecipe} onOpenChange={(o) => !o && setPendingRecipe(null)} initialId={pendingRecipe} />
    </div>
  )
}
