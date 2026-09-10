import type { Job } from '../api'
import { CheckIcon, SpinnerIcon } from './Icons'

interface Props {
  job: Job
  onCancel: () => void
}

/** The pipeline stages, in the order the backend walks through them. */
const STAGES = [
  { key: 'DOWNLOADING', label: 'Downloading video' },
  { key: 'ANALYZING', label: 'Retrieving transcript' },
  { key: 'SELECTING_CLIPS', label: 'Finding interesting moments' },
  { key: 'PROCESSING', label: 'Creating clips' },
] as const

const ORDER = ['QUEUED', 'DOWNLOADING', 'ANALYZING', 'SELECTING_CLIPS', 'PROCESSING', 'COMPLETED']

export default function ProcessingView({ job, onCancel }: Props) {
  const current = ORDER.indexOf(job.status)

  return (
    <section className="animate-rise mx-auto w-full max-w-2xl">
      <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm dark:border-ink-800 dark:bg-ink-900">
        <div className="flex gap-4 p-5">
          {job.video.thumbnail_url && (
            <img
              src={job.video.thumbnail_url}
              alt=""
              className="h-[72px] w-32 shrink-0 rounded-lg bg-ink-100 object-cover dark:bg-ink-800"
            />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold" title={job.video.title ?? ''}>
              {job.video.title ?? 'Loading video…'}
            </h2>
            <p className="mt-1 truncate text-sm text-ink-500 dark:text-ink-400">
              {[job.video.channel, job.video.duration_label, job.video.resolution]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>

        <div className="px-5">
          <div className="relative h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
            <div
              className="h-full rounded-full bg-brand-600 transition-[width] duration-500 ease-out"
              style={{ width: `${Math.max(2, job.progress)}%` }}
              role="progressbar"
              aria-valuenow={Math.round(job.progress)}
              aria-valuemin={0}
              aria-valuemax={100}
            />
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="animate-sheen h-full w-1/3 bg-linear-to-r from-transparent via-white/45 to-transparent" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <p className="text-sm font-medium">{job.stage}</p>
            <p className="text-sm tabular-nums text-ink-500 dark:text-ink-400">
              {Math.round(job.progress)}%
            </p>
          </div>
        </div>

        <ol className="mt-5 space-y-2.5 border-t border-ink-100 px-5 py-5 dark:border-ink-800">
          {STAGES.map((stage) => {
            const position = ORDER.indexOf(stage.key)
            const done = current > position
            const active = current === position
            return (
              <li key={stage.key} className="flex items-center gap-3 text-sm">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    done
                      ? 'bg-brand-600 text-white'
                      : active
                        ? 'bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300'
                        : 'bg-ink-100 text-ink-400 dark:bg-ink-800 dark:text-ink-500'
                  }`}
                >
                  {done ? <CheckIcon className="h-3 w-3" /> : active ? <SpinnerIcon className="h-3 w-3" /> : null}
                </span>
                <span
                  className={
                    done || active
                      ? 'text-ink-800 dark:text-ink-100'
                      : 'text-ink-400 dark:text-ink-500'
                  }
                >
                  {stage.label}
                </span>
              </li>
            )
          })}
        </ol>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-ink-500 dark:text-ink-400">
          You can leave this page open — processing continues on your machine.
        </p>
        <button
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-sm text-ink-500 transition hover:bg-ink-100 hover:text-ink-800 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100"
        >
          Cancel
        </button>
      </div>
    </section>
  )
}
