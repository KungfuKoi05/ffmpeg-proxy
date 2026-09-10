import { useState } from 'react'
import { formatBytes, type Clip } from '../api'
import { DownloadIcon, PlayIcon } from './Icons'

interface Props {
  clip: Clip
}

/** Human labels for the scoring signals, so "why this clip" is inspectable. */
const SIGNAL_LABELS: Record<string, string> = {
  hook: 'Strong opening',
  completeness: 'Complete thought',
  density: 'Information density',
  coherence: 'Stays on topic',
  duration_fit: 'Good length',
  boundary: 'Clean edges',
  payoff: 'Satisfying ending',
  emotion: 'Emotional intensity',
  question_answer: 'Question and answer',
}

export default function ClipCard({ clip }: Props) {
  const [playing, setPlaying] = useState(false)
  const [showWhy, setShowWhy] = useState(false)
  const [playbackFailed, setPlaybackFailed] = useState(false)

  const topSignals = Object.entries(clip.score_breakdown ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .filter(([, value]) => value > 0.4)

  const vertical = (clip.width ?? 16) / (clip.height ?? 9) < 0.8

  return (
    <article className="animate-rise flex flex-col overflow-hidden rounded-xl border border-ink-200 bg-white shadow-sm transition hover:shadow-md dark:border-ink-800 dark:bg-ink-900">
      <div
        className={`relative w-full bg-ink-900 ${vertical ? 'aspect-[9/16]' : 'aspect-video'}`}
      >
        {playbackFailed ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
            <p className="text-xs text-white/80">
              This browser can't play the clip inline.
            </p>
            <a
              href={clip.download_url}
              download
              className="rounded-md bg-white/15 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/25"
            >
              Download it instead
            </a>
          </div>
        ) : playing ? (
          <video
            src={clip.preview_url}
            poster={clip.thumbnail_url ?? undefined}
            controls
            autoPlay
            playsInline
            preload="metadata"
            onError={() => setPlaybackFailed(true)}
            className="h-full w-full bg-black object-contain"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Play clip ${clip.index}: ${clip.title}`}
            className="group h-full w-full"
          >
            {clip.thumbnail_url ? (
              <img src={clip.thumbnail_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-ink-800" />
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition group-hover:bg-black/40">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-ink-900 shadow-lg transition group-hover:scale-105">
                <PlayIcon className="ml-0.5 h-6 w-6" />
              </span>
            </span>
          </button>
        )}

        <span className="pointer-events-none absolute left-2.5 top-2.5 rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
          Clip {String(clip.index).padStart(2, '0')}
        </span>
        <span className="pointer-events-none absolute bottom-2.5 right-2.5 rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white">
          {clip.duration_label}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-sm font-semibold leading-snug" title={clip.title}>
          {clip.title}
        </h3>

        <p className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-ink-500 dark:text-ink-400">
          <span className="tabular-nums">
            {clip.start_label} → {clip.end_label}
          </span>
          <span aria-hidden="true">·</span>
          <span>{clip.width}×{clip.height}</span>
          <span aria-hidden="true">·</span>
          <span>{formatBytes(clip.filesize)}</span>
          {clip.has_captions && (
            <>
              <span aria-hidden="true">·</span>
              <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[11px] dark:bg-ink-800" title="Captions burned in">
                CC
              </span>
            </>
          )}
        </p>

        {topSignals.length > 0 && (
          <div className="mt-2.5">
            <button
              type="button"
              onClick={() => setShowWhy((v) => !v)}
              className="text-[11px] text-ink-500 underline-offset-2 transition hover:text-ink-800 hover:underline dark:text-ink-400 dark:hover:text-ink-200"
            >
              {showWhy ? 'Hide' : 'Why this clip?'}
            </button>
            {showWhy && (
              <ul className="mt-1.5 space-y-1">
                {topSignals.map(([key, value]) => (
                  <li key={key} className="flex items-center gap-2 text-[11px] text-ink-500 dark:text-ink-400">
                    <span className="h-1 w-10 shrink-0 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                      <span
                        className="block h-full rounded-full bg-brand-500"
                        style={{ width: `${Math.round(value * 100)}%` }}
                      />
                    </span>
                    {SIGNAL_LABELS[key] ?? key}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-auto flex gap-2 pt-4">
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-ink-200 px-3 py-2 text-sm font-medium transition hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-800"
          >
            <PlayIcon className="h-3.5 w-3.5" /> Preview
          </button>
          <a
            href={clip.download_url}
            download
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-ink-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-ink-800 dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-white"
          >
            <DownloadIcon className="h-3.5 w-3.5" /> Download
          </a>
        </div>
      </div>
    </article>
  )
}
