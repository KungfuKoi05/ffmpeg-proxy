import { useState } from 'react'
import type { AspectRatio, JobOptions, Quality } from '../api'
import { ChevronIcon, ScissorsIcon, SpinnerIcon } from './Icons'

interface Props {
  onSubmit: (url: string, options: Partial<JobOptions>) => void
  busy: boolean
  disabled: boolean
}

const ASPECTS: { value: AspectRatio; label: string; note: string }[] = [
  { value: '9:16', label: 'Vertical', note: 'TikTok · Reels · Shorts' },
  { value: '16:9', label: 'Landscape', note: 'Original framing' },
  { value: '1:1', label: 'Square', note: 'Feed posts' },
]

const QUALITIES: { value: Quality; label: string }[] = [
  { value: '1080p', label: 'Up to 1080p' },
  { value: '720p', label: 'Up to 720p' },
  { value: 'highest', label: 'Highest available' },
]

export default function UrlForm({ onSubmit, busy, disabled }: Props) {
  const [url, setUrl] = useState('')
  const [open, setOpen] = useState(false)
  const [aspect, setAspect] = useState<AspectRatio>('9:16')
  const [captions, setCaptions] = useState(false)
  const [quality, setQuality] = useState<Quality>('1080p')
  const [clipCount, setClipCount] = useState<number | null>(null)
  const [maxLength, setMaxLength] = useState(60)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!url.trim() || busy || disabled) return
    onSubmit(url.trim(), {
      aspect_ratio: aspect,
      captions,
      quality,
      clip_count: clipCount,
      min_clip_seconds: 30,
      max_clip_seconds: maxLength,
    })
  }

  return (
    <form onSubmit={submit} className="w-full">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <input
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a YouTube link"
            aria-label="YouTube video URL"
            disabled={disabled}
            className="w-full rounded-xl border border-ink-200 bg-white px-4 py-3.5 text-base text-ink-900 shadow-sm outline-none transition placeholder:text-ink-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/12 disabled:opacity-60 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-100 dark:placeholder:text-ink-500"
          />
        </div>
        <button
          type="submit"
          disabled={!url.trim() || busy || disabled}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-500/25 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {busy ? <SpinnerIcon /> : <ScissorsIcon className="h-4.5 w-4.5" />}
          {busy ? 'Starting…' : 'Generate Clips'}
        </button>
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm text-ink-500 transition hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200"
        >
          <ChevronIcon className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          Options
        </button>
      </div>

      {open && (
        <div className="animate-rise mt-2 grid gap-5 rounded-xl border border-ink-200 bg-white p-5 dark:border-ink-800 dark:bg-ink-900/60 sm:grid-cols-2">
          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
              Format
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {ASPECTS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setAspect(option.value)}
                  aria-pressed={aspect === option.value}
                  className={`rounded-lg border px-2 py-2.5 text-left transition ${
                    aspect === option.value
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/12'
                      : 'border-ink-200 hover:border-ink-300 dark:border-ink-800 dark:hover:border-ink-700'
                  }`}
                >
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-tight text-ink-500 dark:text-ink-400">
                    {option.note}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
              Quality
            </legend>
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value as Quality)}
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500 dark:border-ink-800 dark:bg-ink-900"
            >
              {QUALITIES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <p className="mt-1.5 text-[11px] leading-snug text-ink-500 dark:text-ink-400">
              We never upscale — a lower-resolution source stays at its real resolution.
            </p>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
              Number of clips
            </legend>
            <select
              value={clipCount ?? 'auto'}
              onChange={(e) => setClipCount(e.target.value === 'auto' ? null : Number(e.target.value))}
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500 dark:border-ink-800 dark:bg-ink-900"
            >
              <option value="auto">Automatic (5–8)</option>
              {[3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>{n} clips</option>
              ))}
            </select>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
              Clip length
            </legend>
            <label className="flex items-center gap-3">
              <input
                type="range"
                min={40}
                max={60}
                step={5}
                value={maxLength}
                onChange={(e) => setMaxLength(Number(e.target.value))}
                className="h-1.5 flex-1 cursor-pointer accent-brand-600"
              />
              <span className="w-20 shrink-0 text-sm tabular-nums text-ink-600 dark:text-ink-300">
                30–{maxLength}s
              </span>
            </label>
          </fieldset>

          <label className="flex cursor-pointer items-start gap-3 sm:col-span-2">
            <input
              type="checkbox"
              checked={captions}
              onChange={(e) => setCaptions(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded accent-brand-600"
            />
            <span>
              <span className="block text-sm font-medium">Burn captions into the video</span>
              <span className="mt-0.5 block text-xs leading-snug text-ink-500 dark:text-ink-400">
                Off by default. A matching subtitle file is always included with each clip.
              </span>
            </span>
          </label>
        </div>
      )}
    </form>
  )
}
