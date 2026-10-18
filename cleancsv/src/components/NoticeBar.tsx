import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useEffect } from 'react'
import { useApp } from '../state'
import { cx } from './ui'

/** A small message at the bottom of the screen after each change, with an Undo button. */
export function NoticeBar() {
  const { notice, dismissNotice, undo, session } = useApp()
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(dismissNotice, notice.tone === 'error' ? 12_000 : 7_000)
    return () => clearTimeout(t)
  }, [notice, dismissNotice])

  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-4">
      {notice && (
        <div
          key={notice.id}
          className={cx(
            'pointer-events-auto flex max-w-xl items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg',
            notice.tone === 'error' ? 'border-red-200 bg-red-50 text-red-900' : 'border-slate-200 bg-white text-slate-900',
          )}
        >
          {notice.tone === 'error' ? (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
          ) : notice.tone === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
          ) : (
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden />
          )}
          <p className="min-w-0 flex-1">{notice.text}</p>
          {notice.undoable && session && session.cursor > 0 && (
            <button
              type="button"
              className="font-semibold text-teal-800 underline-offset-2 hover:underline"
              onClick={() => {
                undo()
              }}
            >
              Undo
            </button>
          )}
          <button type="button" onClick={dismissNotice} className="rounded p-0.5 text-slate-500 hover:bg-slate-100" aria-label="Dismiss message">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
