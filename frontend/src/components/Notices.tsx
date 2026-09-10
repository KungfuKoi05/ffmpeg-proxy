import type { ApiError, SystemStatus } from '../api'
import { AlertIcon } from './Icons'

export function ErrorNotice({ error, onDismiss }: { error: ApiError; onDismiss?: () => void }) {
  return (
    <div
      role="alert"
      className="animate-rise flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
    >
      <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{error.message}</p>
        {error.hint && <p className="mt-1 text-sm opacity-80">{error.hint}</p>}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-md px-2 text-lg leading-none opacity-60 transition hover:opacity-100"
        >
          ×
        </button>
      )}
    </div>
  )
}

/** Shown only when a required tool is missing, with the exact install command. */
export function DependencyNotice({ status }: { status: SystemStatus }) {
  const missing = status.dependencies.filter((d) => d.required && !d.available)
  if (missing.length === 0) return null

  return (
    <div
      role="alert"
      className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100"
    >
      <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <div className="min-w-0">
        <p className="text-sm font-semibold">
          {missing.map((d) => d.name).join(' and ')} {missing.length > 1 ? 'are' : 'is'} not
          installed, so clips can't be created yet.
        </p>
        <ul className="mt-2 space-y-1.5">
          {missing.map((dep) => (
            <li key={dep.name} className="text-sm">
              <code className="rounded bg-amber-100 px-1.5 py-0.5 text-[12px] dark:bg-amber-900/50">
                {dep.install_hint}
              </code>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs opacity-80">Restart the app after installing.</p>
      </div>
    </div>
  )
}

export function LegalNotice() {
  return (
    <p className="mx-auto max-w-xl text-center text-xs leading-relaxed text-ink-400 dark:text-ink-500">
      Use this for videos you own or otherwise have permission to download and edit. You are
      responsible for having the necessary rights to the content you process.
    </p>
  )
}
