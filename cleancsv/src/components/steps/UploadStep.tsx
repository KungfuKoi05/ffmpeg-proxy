import { ArrowRight, FileSpreadsheet, FlaskConical, Lock, Upload as UploadIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { DELIMITERS, ENCODINGS, delimiterName } from '../../engine/parse'
import { MAX_BYTES, formatBytes } from '../../engine/limits'
import { SAMPLE_CSV, SAMPLE_FILE_NAME, SAMPLE_PROBLEMS } from '../../engine/sample'
import type { Delimiter } from '../../engine/types'
import { readAndParse, sourceFromFile, sourceFromText, type Source } from '../../lib/readFile'
import { useApp } from '../../state'
import { DataTable } from '../DataTable'
import { Alert, Button, Card, Checkbox, Dialog, Select, Spinner, cx } from '../ui'

export function UploadStep() {
  const { upload, setUpload, startSession, setStep, session, clearSession } = useApp()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [confirmedBlocking, setConfirmedBlocking] = useState(false)
  const [replacePrompt, setReplacePrompt] = useState<{ source: Source; encoding: string; delimiter: string } | null>(null)

  const parse = async (source: Source, encoding = 'auto', delimiter = 'auto') => {
    setConfirmedBlocking(false)
    setUpload({ source, encoding, delimiter, result: null, parsing: true })
    const result = await readAndParse(source, { encoding, delimiter: delimiter as Delimiter | 'auto' })
    setUpload((u) => (u && u.source === source ? { ...u, result, parsing: false } : u))
  }

  const choose = (source: Source, encoding = 'auto', delimiter = 'auto') => {
    if (session && session.cursor > 0) setReplacePrompt({ source, encoding, delimiter })
    else {
      if (session) clearSession()
      void parse(source, encoding, delimiter)
    }
  }

  // A hosted demo can set window.CLEANCSV_START_WITH_SAMPLE so the page opens with the sample loaded.
  useEffect(() => {
    const g = globalThis as { CLEANCSV_START_WITH_SAMPLE?: boolean }
    if (g.CLEANCSV_START_WITH_SAMPLE && !upload && !session) {
      g.CLEANCSV_START_WITH_SAMPLE = false
      void parse(sourceFromText(SAMPLE_FILE_NAME, SAMPLE_CSV))
    }
    // Runs once on first show.
  }, [])

  const onFiles = (files: FileList | null) => {
    const f = files?.[0]
    if (f) choose(sourceFromFile(f))
  }

  const result = upload?.result
  const ok = result?.ok ? result : null
  const blocking = ok?.meta.warnings.some((w) => w.blocking) ?? false
  const isSample = upload?.source.name === SAMPLE_FILE_NAME

  // Coming back to this step must not throw away the changes already made to the same file.
  const sameFile = !!ok && !!session && session.original === ok.table
  const proceed = () => {
    if (!ok) return
    if (!sameFile) startSession(ok.table, ok.meta)
    setStep(2)
  }

  return (
    <div className="space-y-6">
      {session && !upload && (
        <Alert tone="info" title={`You are working on ${session.meta.fileName}`} action={<Button variant="primary" size="sm" onClick={() => setStep(2)}>Continue with this file <ArrowRight className="h-4 w-4" aria-hidden /></Button>}>
          Choosing a new file below will replace it.
        </Alert>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          onFiles(e.dataTransfer.files)
        }}
        className={cx(
          'rounded-2xl border-2 border-dashed bg-white px-6 py-12 text-center transition-colors',
          dragging ? 'border-teal-600 bg-teal-50' : 'border-slate-300',
        )}
      >
        <UploadIcon className="mx-auto h-10 w-10 text-teal-700" aria-hidden />
        <p className="mt-4 text-xl font-semibold text-slate-900">Drop your CSV file here</p>
        <p className="mt-1 text-slate-600">Or choose a file from your device.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button variant="primary" size="lg" onClick={() => inputRef.current?.click()}>
            <FileSpreadsheet className="h-5 w-5" aria-hidden /> Choose a file
          </Button>
          <Button size="lg" onClick={() => choose(sourceFromText(SAMPLE_FILE_NAME, SAMPLE_CSV))}>
            <FlaskConical className="h-5 w-5" aria-hidden /> Try a sample file
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
          className="sr-only"
          aria-label="Choose a CSV file"
          onChange={(e) => {
            onFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <p className="mt-6 text-sm text-slate-500">
          CSV, TSV or TXT files, up to {formatBytes(MAX_BYTES)}. Excel files: save as CSV first.
        </p>
        <p className="mx-auto mt-3 flex max-w-md items-start justify-center gap-2 text-sm text-slate-600">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden />
          <span>Your file stays on this device. CleanCSV reads it inside your browser and never uploads it anywhere.</span>
        </p>
      </div>

      {upload?.parsing && (
        <Card className="p-4">
          <Spinner label={`Reading ${upload.source.name}…`} />
        </Card>
      )}

      {result && !result.ok && (
        <Alert tone="error" title={result.error.title} role="alert" action={<Button size="sm" onClick={() => inputRef.current?.click()}>Choose another file</Button>}>
          {result.error.message}
        </Alert>
      )}

      {ok && upload && (
        <Card className="space-y-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{ok.meta.fileName}</h2>
              <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-slate-600 sm:grid-cols-4">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Size</dt>
                  <dd>{formatBytes(ok.meta.fileSize)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Rows</dt>
                  <dd data-testid="row-count">{ok.meta.rowCount.toLocaleString('en-US')}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Columns</dt>
                  <dd data-testid="column-count">{ok.meta.columnCount.toLocaleString('en-US')}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Separated by</dt>
                  <dd>{delimiterName(ok.meta.delimiter)}</dd>
                </div>
              </dl>
            </div>
            <Button variant="primary" size="lg" onClick={proceed} disabled={blocking && !confirmedBlocking}>
              {sameFile ? 'Continue' : 'Find problems'} <ArrowRight className="h-5 w-5" aria-hidden />
            </Button>
          </div>

          {isSample && (
            <Alert tone="info" title="This is a made-up sample file">
              <p>All names, emails and phone numbers are fictional. It has these problems for you to find and fix:</p>
              <ul className="mt-1 list-disc pl-5">
                {SAMPLE_PROBLEMS.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </Alert>
          )}

          {ok.meta.warnings.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-900">Notes from reading the file</h3>
              {ok.meta.warnings.map((w, i) => (
                <Alert key={i} tone={w.severity === 'important' ? 'warning' : 'info'} role={w.blocking ? 'alert' : undefined}>
                  {w.message}
                </Alert>
              ))}
              {blocking && (
                <Checkbox
                  label="I checked the preview below and want to continue with this file anyway"
                  checked={confirmedBlocking}
                  onChange={setConfirmedBlocking}
                />
              )}
            </div>
          )}

          <details className="rounded-lg border border-slate-200 p-3 text-sm" open={ok.meta.warnings.some((w) => w.kind === 'encoding-fallback' || w.kind === 'replacement-characters' || w.blocking)}>
            <summary className="cursor-pointer font-medium text-slate-800">Letters look wrong, or columns are not split correctly?</summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Select
                label="Text encoding"
                value={upload.encoding}
                onChange={(enc) => choose(upload.source, enc, upload.delimiter)}
                options={ENCODINGS.map((e) => ({ value: e.value, label: e.label }))}
                hint={`Currently read as ${ok.meta.encoding}.`}
              />
              <Select
                label="Values are separated by"
                value={upload.delimiter}
                onChange={(d) => choose(upload.source, upload.encoding, d)}
                options={DELIMITERS.map((d) => ({ value: d.value, label: d.label }))}
                hint={`Currently split on ${delimiterName(ok.meta.delimiter)}s.`}
              />
            </div>
          </details>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">First rows</h3>
            <DataTable table={ok.table} caption="Preview of the first rows" maxRows={5} />
          </div>
        </Card>
      )}

      <Dialog
        open={!!replacePrompt}
        onOpenChange={(o) => !o && setReplacePrompt(null)}
        title="Replace the file you are cleaning?"
        description={`You have made ${session?.cursor ?? 0} change(s) to ${session?.meta.fileName ?? 'this file'}. Opening a new file will discard them unless you download first.`}
        footer={
          <>
            <Button onClick={() => setReplacePrompt(null)}>Keep working</Button>
            <Button
              variant="danger"
              onClick={() => {
                const req = replacePrompt
                setReplacePrompt(null)
                clearSession()
                if (req) void parse(req.source, req.encoding, req.delimiter)
              }}
            >
              Discard changes and open
            </Button>
          </>
        }
      />
    </div>
  )
}
