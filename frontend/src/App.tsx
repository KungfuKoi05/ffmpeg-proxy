import { useCallback, useEffect, useRef, useState } from 'react'
import { api, RequestFailed, type ApiError, type Clip, type Job, type JobOptions, type SystemStatus } from './api'
import { ScissorsIcon } from './components/Icons'
import { DependencyNotice, ErrorNotice, LegalNotice } from './components/Notices'
import ProcessingView from './components/ProcessingView'
import ResultsView from './components/ResultsView'
import UrlForm from './components/UrlForm'

const POLL_INTERVAL = 1200
const TERMINAL = new Set(['COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED'])

export default function App() {
  const [system, setSystem] = useState<SystemStatus | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [clips, setClips] = useState<Clip[]>([])
  const [error, setError] = useState<ApiError | null>(null)
  const [starting, setStarting] = useState(false)
  const pollRef = useRef<number | null>(null)

  useEffect(() => {
    api.systemStatus().then(setSystem).catch(() => setSystem(null))
  }, [])

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  // Poll while a job is in flight. Any terminal status ends the loop.
  useEffect(() => {
    if (!job || TERMINAL.has(job.status)) return
    pollRef.current = window.setInterval(async () => {
      try {
        const next = await api.getJob(job.id)
        setJob(next)
        if (next.status === 'COMPLETED') {
          setClips(await api.getClips(next.id))
          stopPolling()
        } else if (TERMINAL.has(next.status)) {
          stopPolling()
        }
      } catch (err) {
        stopPolling()
        setError(
          err instanceof RequestFailed
            ? { code: err.code, message: err.message, hint: err.hint }
            : { code: 'unknown', message: 'Lost contact with the server.' },
        )
      }
    }, POLL_INTERVAL)
    return stopPolling
  }, [job, stopPolling])

  async function start(url: string, options: Partial<JobOptions>) {
    setError(null)
    setClips([])
    setStarting(true)
    try {
      setJob(await api.createJob(url, options))
    } catch (err) {
      setJob(null)
      setError(
        err instanceof RequestFailed
          ? { code: err.code, message: err.message, hint: err.hint }
          : { code: 'unknown', message: 'Something went wrong starting that job.' },
      )
    } finally {
      setStarting(false)
    }
  }

  async function cancel() {
    if (!job) return
    stopPolling()
    try {
      await api.cancelJob(job.id)
    } catch {
      /* the job may already have finished - reset either way */
    }
    reset()
  }

  function reset() {
    stopPolling()
    setJob(null)
    setClips([])
    setError(null)
  }

  const showResults = job?.status === 'COMPLETED'
  const showProgress = job !== null && !TERMINAL.has(job.status)
  const jobError = job?.status === 'FAILED' ? job.error : null
  const blocked = system !== null && !system.ready

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-ink-200/70 dark:border-ink-800/70">
        <div className="mx-auto flex max-w-6xl items-center gap-2.5 px-5 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <ScissorsIcon className="h-4 w-4" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Clip Generator</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:py-14">
        {!job && (
          <div className="mx-auto max-w-2xl">
            <h1 className="text-center text-3xl font-semibold tracking-tight sm:text-[2.6rem] sm:leading-[1.1]">
              Turn YouTube Videos<br className="hidden sm:block" /> Into Short Clips
            </h1>
            <p className="mx-auto mt-3.5 max-w-md text-center text-[15px] leading-relaxed text-ink-500 dark:text-ink-400">
              Paste a video link and automatically create 5–8 share-ready clips.
            </p>

            <div className="mt-8">
              <UrlForm onSubmit={start} busy={starting} disabled={blocked} />
            </div>

            <div className="mt-5 space-y-3">
              {system && <DependencyNotice status={system} />}
              {error && <ErrorNotice error={error} onDismiss={() => setError(null)} />}
              {jobError && <ErrorNotice error={jobError} onDismiss={reset} />}
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                ['30–60 seconds', 'Every clip is a complete thought, cut on sentence boundaries.'],
                ['Up to 1080p', 'No watermark, no upscaling, original audio preserved.'],
                ['Runs locally', 'Your video never leaves this machine.'],
              ].map(([title, body]) => (
                <div
                  key={title}
                  className="rounded-xl border border-ink-200/70 bg-white/60 p-4 dark:border-ink-800/70 dark:bg-ink-900/40"
                >
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="mt-1 text-[13px] leading-snug text-ink-500 dark:text-ink-400">{body}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {showProgress && job && <ProcessingView job={job} onCancel={cancel} />}

        {job && TERMINAL.has(job.status) && !showResults && (
          <div className="mx-auto max-w-2xl space-y-4">
            <ErrorNotice
              error={
                job.error ?? {
                  code: job.status.toLowerCase(),
                  message:
                    job.status === 'CANCELLED'
                      ? 'That job was cancelled.'
                      : 'That job is no longer available.',
                }
              }
            />
            <button
              onClick={reset}
              className="rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-medium transition hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-800"
            >
              Try another video
            </button>
          </div>
        )}

        {showResults && job && <ResultsView job={job} clips={clips} onReset={reset} />}
      </main>

      <footer className="border-t border-ink-200/70 px-5 py-6 dark:border-ink-800/70">
        <LegalNotice />
      </footer>
    </div>
  )
}
