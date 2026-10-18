import { Redo2, RotateCcw, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { canRedo, canUndo } from '../engine/history'
import { useApp } from '../state'
import { Button, Card, Dialog, cx } from './ui'

export function UndoRedoBar() {
  const { session, undo, redo, reset } = useApp()
  const [confirmReset, setConfirmReset] = useState(false)
  if (!session) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={undo} disabled={!canUndo(session)} title="Undo (Ctrl+Z)">
        <Undo2 className="h-4 w-4" aria-hidden /> Undo
      </Button>
      <Button size="sm" onClick={redo} disabled={!canRedo(session)} title="Redo (Ctrl+Shift+Z)">
        <Redo2 className="h-4 w-4" aria-hidden /> Redo
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setConfirmReset(true)} disabled={session.cursor === 0}>
        <RotateCcw className="h-4 w-4" aria-hidden /> Reset to original
      </Button>
      <span className="text-sm text-slate-600" data-testid="change-count">
        {session.cursor === 0 ? 'No changes yet' : `${session.cursor} change${session.cursor === 1 ? '' : 's'} applied`}
      </span>
      <Dialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Go back to the original file?"
        description="All your changes will be undone and the data will be exactly as it was when you opened it. You can still redo the steps afterwards."
        footer={
          <>
            <Button onClick={() => setConfirmReset(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                reset()
                setConfirmReset(false)
              }}
            >
              Reset to original
            </Button>
          </>
        }
      />
    </div>
  )
}

export function ChangesList() {
  const { session } = useApp()
  if (!session) return null
  if (session.entries.length === 0) {
    return <p className="text-sm text-slate-500">No changes yet. Every change you apply is listed here and can be undone.</p>
  }
  return (
    <ol className="space-y-2">
      {session.entries.map((e, i) => {
        const applied = i < session.cursor
        return (
          <li key={e.id} className={cx('rounded-lg border p-2 text-sm', applied ? 'border-slate-200 bg-white' : 'border-dashed border-slate-300 bg-slate-50 text-slate-500')}>
            <p className={cx('font-medium', applied ? 'text-slate-900' : 'line-through')}>
              {i + 1}. {e.label}
            </p>
            <p className="text-slate-600">{applied ? e.result.summary : 'Undone (press Redo to bring it back)'}</p>
          </li>
        )
      })}
    </ol>
  )
}

export function ChangesCard() {
  return (
    <Card className="p-4">
      <h2 className="mb-3 font-semibold text-slate-900">Changes made</h2>
      <ChangesList />
    </Card>
  )
}
