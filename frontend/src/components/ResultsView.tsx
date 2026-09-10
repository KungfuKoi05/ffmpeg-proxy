import type { Clip, Job } from '../api'
import ClipCard from './ClipCard'
import { DownloadIcon } from './Icons'

interface Props {
  job: Job
  clips: Clip[]
  onReset: () => void
}

const TRANSCRIPT_LABELS: Record<string, string> = {
  youtube_subtitles: "the video's own captions",
  whisper: 'audio transcribed on this machine',
  none: 'audio analysis (no transcript was available)',
}

export default function ResultsView({ job, clips, onReset }: Props) {
  const vertical = clips.length > 0 && (clips[0].width ?? 16) / (clips[0].height ?? 9) < 0.8

  return (
    <section className="animate-rise w-full">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">
            {clips.length} {clips.length === 1 ? 'clip' : 'clips'} ready
          </h2>
          <p className="mt-1 truncate text-sm text-ink-500 dark:text-ink-400">
            From “{job.video.title}”
            {job.transcript_source && (
              <> · found using {TRANSCRIPT_LABELS[job.transcript_source] ?? job.transcript_source}</>
            )}
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            onClick={onReset}
            className="rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-medium transition hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-800"
          >
            New video
          </button>
          {job.download_all_url && (
            <a
              href={job.download_all_url}
              download
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
            >
              <DownloadIcon className="h-4 w-4" /> Download All
            </a>
          )}
        </div>
      </div>

      <div
        className={`mt-6 grid gap-5 ${
          vertical
            ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        }`}
      >
        {clips.map((clip) => (
          <ClipCard key={clip.id} clip={clip} />
        ))}
      </div>

      {clips.length > 0 && clips.length < 5 && (
        <p className="mt-6 rounded-lg border border-ink-200 bg-white p-4 text-sm text-ink-600 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-300">
          We found {clips.length} {clips.length === 1 ? 'section' : 'sections'} worth clipping in
          this video rather than the usual 5–8. Producing fewer good clips beats padding the set
          with weak ones.
        </p>
      )}
    </section>
  )
}
