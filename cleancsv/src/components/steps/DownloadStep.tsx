import { CheckCircle2, Download, FileText, RefreshCw, Save, ShieldCheck, Undo2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { unresolvedCount } from '../../engine/analyze'
import { canUndo } from '../../engine/history'
import { countFormulaCells, defaultExportName, ensureCsvExtension, hasNonAscii, toCSV, verifyExport, type ExportOptions } from '../../engine/export'
import { buildReport } from '../../engine/report'
import type { Delimiter } from '../../engine/types'
import { saveText } from '../../lib/download'
import { useApp } from '../../state'
import { SaveRecipeDialog } from '../RecipeDialogs'
import { Alert, Button, Card, Checkbox, Dialog, Select, Spinner, Stat, TextInput } from '../ui'

export function DownloadStep() {
  const { session, table, analysis, analysisPending, undo, clearSession, addHistory, notify } = useApp()
  const [name, setName] = useState(() => defaultExportName(session?.meta.fileName ?? 'file.csv'))
  const [delimiter, setDelimiter] = useState<Delimiter>(session?.meta.delimiter ?? ',')
  const [bom, setBom] = useState(() => !!session && (session.meta.hadBom || hasNonAscii(session.original)))
  const [protect, setProtect] = useState(true)
  const [verified, setVerified] = useState<{ ok: boolean; text: string } | null>(null)
  const [confirmRestart, setConfirmRestart] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const formulaCells = useMemo(() => (table ? countFormulaCells(table) : 0), [table])
  if (!session || !table) return null
  if (!analysis) {
    return (
      <Card className="p-6">
        <Spinner label="Checking your file for problems… Big files can take a few seconds." />
      </Card>
    )
  }

  const opts: ExportOptions = { delimiter, lineEnding: '\r\n', bom, protectFormulas: protect }
  const exportName = ensureCsvExtension(name)
  const unresolved = analysis.findings.filter((f) => f.severity !== 'info')
  const cellChanges = session.entries.slice(0, session.cursor).reduce((n, e) => n + e.result.changes.cells.length, 0)

  const downloadCsv = async () => {
    const out = toCSV(table, opts)
    const check = verifyExport(out.text, table, opts)
    if (!check.ok) {
      setVerified({ ok: false, text: `We stopped the download because the file did not match what you see (${check.problem}). Please report this problem.` })
      return
    }
    const result = await saveText(exportName, out.text, 'text/csv;charset=utf-8')
    if (result.status === 'failed') {
      notify(result.message, 'error')
      return
    }
    if (result.status === 'declined') {
      notify('Nothing was saved, because you cancelled.', 'info')
      return
    }
    const checked = `${exportName} has ${table.rows.length.toLocaleString('en-US')} rows and ${table.headers.length} columns, matching what you see${out.protectedCells ? `, with ${out.protectedCells} formula-like cell(s) protected` : ''}.`
    setVerified({ ok: true, text: result.status === 'saved' ? `Saved. Checked before saving: ${checked}` : `Checked before saving: ${checked}` })
    addHistory({
      id: `h_${Date.now().toString(36)}`,
      fileName: session.meta.fileName,
      exportName,
      at: new Date().toISOString(),
      rowsBefore: session.original.rows.length,
      rowsAfter: table.rows.length,
      columnsBefore: session.original.headers.length,
      columnsAfter: table.headers.length,
      steps: session.entries.slice(0, session.cursor).map((e) => e.label),
    })
  }

  const downloadReport = async () => {
    const out = toCSV(table, opts)
    const report = buildReport(session, { exportName, protectedCells: out.protectedCells, unresolved })
    const reportName = exportName.replace(/\.(csv|tsv|txt)$/i, '') + '-change-report.txt'
    const result = await saveText(reportName, report, 'text/plain;charset=utf-8')
    if (result.status === 'failed') notify(result.message, 'error')
    else if (result.status === 'saved') notify(`Saved ${reportName}.`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" aria-hidden /> Your file is ready.
        </h2>
        <p className="mt-1 text-slate-600">Download it below. Nothing has been uploaded anywhere: the file is created on this device.</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Original rows" value={session.original.rows.length.toLocaleString('en-US')} />
        <Stat label="Final rows" value={<span data-testid="final-rows">{table.rows.length.toLocaleString('en-US')}</span>} />
        <Stat label="Changes applied" value={<span data-testid="steps-applied">{session.cursor}</span>} tone={session.cursor ? 'good' : undefined} />
        <Stat label="Unresolved warnings" value={analysisPending ? '…' : unresolvedCount(analysis.findings)} tone={unresolved.length ? 'warn' : 'good'} />
      </dl>
      <p className="text-sm text-slate-600">
        {session.cursor} step{session.cursor === 1 ? '' : 's'} changed {cellChanges.toLocaleString('en-US')} cell{cellChanges === 1 ? '' : 's'}
        {session.original.rows.length !== table.rows.length && ` and removed ${(session.original.rows.length - table.rows.length).toLocaleString('en-US')} row(s)`}.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-5">
          <h3 className="font-semibold text-slate-900">Download options</h3>
          <TextInput label="File name" value={name} onChange={setName} hint={`Will be saved as ${exportName}`} />
          <Select
            label="Separate values with"
            value={delimiter}
            onChange={(d) => setDelimiter(d as Delimiter)}
            options={[
              { value: ',', label: 'Commas (standard CSV)' },
              { value: ';', label: 'Semicolons (Excel in many European countries)' },
              { value: '\t', label: 'Tabs' },
              { value: '|', label: 'Pipes ( | )' },
            ]}
            hint={`Your original file used ${{ ',': 'commas', ';': 'semicolons', '\t': 'tabs', '|': 'pipes' }[session.meta.delimiter]}.`}
          />
          <Checkbox
            label="Make accented letters show correctly in Excel"
            hint="Adds an invisible marker (a byte-order mark) at the start of the file. Turn off if another program shows a strange character before the first column name."
            checked={bom}
            onChange={setBom}
          />
          <div className="rounded-lg border border-slate-200 p-3">
            <Checkbox
              label={
                <span className="inline-flex items-center gap-1 font-medium">
                  <ShieldCheck className="h-4 w-4 text-teal-700" aria-hidden /> Protect against spreadsheet formulas
                </span>
              }
              hint={
                formulaCells > 0
                  ? `${formulaCells} cell(s) start with =, +, -, or @. Excel or Google Sheets could run them as formulas. With this on, an apostrophe (') is added in front so they show as plain text. Turn it off only if you meant these to be formulas.`
                  : 'No cells in this file look like formulas, so nothing will be changed.'
              }
              checked={protect}
              onChange={setProtect}
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="primary" size="lg" onClick={() => void downloadCsv()}>
              <Download className="h-5 w-5" aria-hidden /> Download cleaned CSV
            </Button>
            <Button size="lg" onClick={() => void downloadReport()}>
              <FileText className="h-5 w-5" aria-hidden /> Download change report
            </Button>
          </div>
          {verified && (
            <Alert tone={verified.ok ? 'success' : 'error'} role={verified.ok ? 'status' : 'alert'}>
              {verified.text}
            </Alert>
          )}
        </Card>

        <div className="space-y-4">
          {unresolved.length > 0 ? (
            <Card className="p-5">
              <h3 className="font-semibold text-slate-900">Still worth checking ({unresolved.length})</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {unresolved.slice(0, 8).map((f) => (
                  <li key={f.id}>{f.title}</li>
                ))}
                {unresolved.length > 8 && <li>…and {unresolved.length - 8} more</li>}
              </ul>
              <p className="mt-2 text-xs text-slate-500">These are listed in the change report too. You can download anyway.</p>
            </Card>
          ) : (
            <Alert tone="success" title="No open warnings">Every problem we look for has been fixed or was not found.</Alert>
          )}
          <Card className="space-y-2 p-5">
            <h3 className="font-semibold text-slate-900">What next?</h3>
            <div className="flex flex-wrap gap-2">
              <Button onClick={undo} disabled={!canUndo(session)}>
                <Undo2 className="h-4 w-4" aria-hidden /> Undo last change
              </Button>
              <Button onClick={() => setSaveOpen(true)} disabled={session.cursor === 0}>
                <Save className="h-4 w-4" aria-hidden /> Save steps as a recipe
              </Button>
              <Button variant="ghost" onClick={() => setConfirmRestart(true)}>
                <RefreshCw className="h-4 w-4" aria-hidden /> Start over with a new file
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <SaveRecipeDialog open={saveOpen} onOpenChange={setSaveOpen} />
      <Dialog
        open={confirmRestart}
        onOpenChange={setConfirmRestart}
        title="Start over with a new file?"
        description="This closes the current file. Make sure you have downloaded it. Your saved recipes and history are kept."
        footer={
          <>
            <Button onClick={() => setConfirmRestart(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmRestart(false)
                clearSession()
              }}
            >
              Close this file
            </Button>
          </>
        }
      />
    </div>
  )
}
