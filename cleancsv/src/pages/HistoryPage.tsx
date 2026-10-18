import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../state'
import { ChangesList } from '../components/HistoryControls'
import { Alert, Button, Card, Dialog } from '../components/ui'

export function HistoryPage() {
  const { session, history, clearHistory, navigate, storageOk } = useApp()
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Cleaning history</h1>
        <p className="mt-2 text-slate-600">
          This list is saved only in this browser on this device. It records file names, row counts and the steps you used, never the contents of your files.
        </p>
      </header>
      {!storageOk && <Alert tone="warning">Your browser is blocking local storage, so history cannot be kept after you close this tab.</Alert>}

      <Card className="p-5">
        <h2 className="font-semibold text-slate-900">Current file</h2>
        {session ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-slate-600">
              {session.meta.fileName}: {session.original.rows.length.toLocaleString('en-US')} rows when opened.
            </p>
            <ChangesList />
            <details className="text-sm">
              <summary className="cursor-pointer text-slate-700">Everything that happened in this session ({session.events.length})</summary>
              <ol className="mt-2 space-y-1 pl-1 text-slate-600">
                {session.events.map((e, i) => (
                  <li key={i}>
                    <span className="tabular-nums text-slate-400">{new Date(e.at).toLocaleTimeString('en-US')}</span> · {e.kind}: {e.label}
                  </li>
                ))}
              </ol>
            </details>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            No file open.{' '}
            <button type="button" className="font-medium text-teal-800 underline" onClick={() => navigate('clean')}>
              Clean a file
            </button>
          </p>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900">Past downloads ({history.length})</h2>
          <Button size="sm" variant="danger" disabled={history.length === 0} onClick={() => setConfirm(true)}>
            <Trash2 className="h-4 w-4" aria-hidden /> Clear history
          </Button>
        </div>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">Files you download appear here.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {history.map((h) => (
              <li key={h.id} className="py-3 text-sm">
                <p className="font-medium text-slate-900">
                  {h.fileName} → {h.exportName}
                </p>
                <p className="text-slate-600">
                  {new Date(h.at).toLocaleString('en-US')} · {h.rowsBefore.toLocaleString('en-US')} → {h.rowsAfter.toLocaleString('en-US')} rows · {h.steps.length} step
                  {h.steps.length === 1 ? '' : 's'}
                </p>
                {h.steps.length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-slate-500">Steps</summary>
                    <ol className="mt-1 list-decimal pl-5 text-slate-600">
                      {h.steps.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ol>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Clear cleaning history?"
        description="This removes the list of past downloads from this browser. Your recipes are kept."
        footer={
          <>
            <Button onClick={() => setConfirm(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                clearHistory()
                setConfirm(false)
              }}
            >
              Clear history
            </Button>
          </>
        }
      />
    </div>
  )
}
