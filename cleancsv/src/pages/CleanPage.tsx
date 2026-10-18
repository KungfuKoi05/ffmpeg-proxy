import { Check } from 'lucide-react'
import { useEffect } from 'react'
import { useApp, type StepNo } from '../state'
import { UploadStep } from '../components/steps/UploadStep'
import { ProblemsStep } from '../components/steps/ProblemsStep'
import { CleanStep } from '../components/steps/CleanStep'
import { DownloadStep } from '../components/steps/DownloadStep'
import { cx } from '../components/ui'

const STEPS: { n: StepNo; label: string }[] = [
  { n: 1, label: 'Upload' },
  { n: 2, label: 'Find problems' },
  { n: 3, label: 'Clean' },
  { n: 4, label: 'Download' },
]

function Stepper({ current, enabled, onPick }: { current: StepNo; enabled: boolean; onPick: (n: StepNo) => void }) {
  return (
    <nav aria-label="Steps" className="mb-6">
      <ol className="grid grid-cols-4 gap-2">
        {STEPS.map(({ n, label }) => {
          const active = n === current
          const done = n < current
          const clickable = enabled || n === 1
          return (
            <li key={n}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onPick(n)}
                aria-current={active ? 'step' : undefined}
                className={cx(
                  'flex w-full flex-col items-start gap-1 rounded-lg border-t-4 px-1 pt-2 text-left text-sm transition-colors sm:flex-row sm:items-center sm:gap-2',
                  active ? 'border-teal-700 text-teal-900' : done ? 'border-teal-300 text-slate-700' : 'border-slate-200 text-slate-500',
                  clickable ? 'hover:text-teal-900' : 'cursor-not-allowed',
                )}
              >
                <span
                  className={cx(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    active ? 'bg-teal-700 text-white' : done ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-500',
                  )}
                  aria-hidden
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : n}
                </span>
                <span className="font-medium">
                  <span className="sr-only">Step {n}: </span>
                  {label}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function isTyping(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

export function CleanPage() {
  const { session, step, setStep, undo, redo } = useApp()
  const current: StepNo = session ? step : 1

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!session || isTyping(e.target) || !(e.ctrlKey || e.metaKey)) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [session, undo, redo])

  useEffect(() => {
    window.scrollTo?.(0, 0)
  }, [current])

  return (
    <div>
      {current === 1 && (
        <header className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Clean a messy spreadsheet</h1>
          <p className="mt-2 max-w-2xl text-lg text-slate-600">Upload your CSV file. See what is wrong with it. Fix it with a few clicks. Download a clean file.</p>
        </header>
      )}
      {current !== 1 && session && (
        <p className="mb-2 truncate text-sm text-slate-500">
          File: <span className="font-medium text-slate-700">{session.meta.fileName}</span>
        </p>
      )}
      <Stepper current={current} enabled={!!session} onPick={setStep} />
      {current === 1 && <UploadStep />}
      {current === 2 && <ProblemsStep />}
      {current === 3 && <CleanStep />}
      {current === 4 && <DownloadStep />}
    </div>
  )
}
