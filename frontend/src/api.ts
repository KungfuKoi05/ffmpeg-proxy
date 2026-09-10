/**
 * API client.
 *
 * The owner token is a capability: the server issues one with the first job
 * and every later request carries it. Media URLs already embed it as a query
 * parameter because <video> and <a download> cannot send headers.
 */

export type AspectRatio = '16:9' | '9:16' | '1:1'
export type Quality = '1080p' | '720p' | 'highest'

export interface JobOptions {
  aspect_ratio: AspectRatio
  captions: boolean
  quality: Quality
  clip_count: number | null
  min_clip_seconds: number
  max_clip_seconds: number
}

export interface VideoInfo {
  video_id: string | null
  title: string | null
  channel: string | null
  duration: number | null
  duration_label: string | null
  thumbnail_url: string | null
  resolution: string | null
  source_url: string
}

export interface ApiError {
  code: string
  message: string
  hint?: string | null
}

export interface Job {
  id: string
  /** 'youtube' for a downloaded video, 'upload' for a file the user provided. */
  source_kind: 'youtube' | 'upload'
  status:
    | 'QUEUED' | 'DOWNLOADING' | 'ANALYZING' | 'SELECTING_CLIPS'
    | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | 'CANCELLED'
  stage: string
  progress: number
  created_at: string
  completed_at: string | null
  expires_at: string | null
  video: VideoInfo
  options: JobOptions
  clip_count: number
  transcript_source: string | null
  analysis: Record<string, unknown> | null
  error: ApiError | null
  download_all_url: string | null
}

export interface Clip {
  id: string
  job_id: string
  index: number
  title: string
  start: number
  end: number
  start_label: string
  end_label: string
  duration: number
  duration_label: string
  width: number | null
  height: number | null
  resolution: string
  filesize: number | null
  has_captions: boolean
  score: number
  score_breakdown: Record<string, number> | null
  selected_by: string
  transcript_excerpt: string | null
  preview_url: string
  download_url: string
  thumbnail_url: string | null
  subtitle_url: string | null
}

export interface VideoPreview {
  video: VideoInfo
  can_process: boolean
  reason: string | null
}

export interface Dependency {
  name: string
  available: boolean
  version: string | null
  required: boolean
  install_hint: string | null
}

export interface SystemStatus {
  ready: boolean
  dependencies: Dependency[]
  limits: Record<string, number>
  features: Record<string, unknown>
  storage: Record<string, unknown>
}

const TOKEN_KEY = 'clipgen.owner-token'

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* private browsing - the cookie still covers us */
  }
}

export class RequestFailed extends Error {
  code: string
  hint: string

  constructor(error: ApiError) {
    super(error.message)
    this.code = error.code
    this.hint = error.hint ?? ''
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  if (token) headers.set('X-Owner-Token', token)

  let response: Response
  try {
    response = await fetch(path, { ...init, headers, credentials: 'include' })
  } catch {
    throw new RequestFailed({
      code: 'offline',
      message: "We couldn't reach the app's server.",
      hint: 'Make sure the backend is running, then try again.',
    })
  }

  if (response.status === 204) return undefined as T

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    const detail = body?.detail
    if (detail && typeof detail === 'object' && 'message' in detail) {
      throw new RequestFailed(detail as ApiError)
    }
    throw new RequestFailed({
      code: `http_${response.status}`,
      message: typeof detail === 'string' ? detail : 'Something went wrong.',
    })
  }
  return body as T
}

export const api = {
  systemStatus: () => request<SystemStatus>('/api/system/status'),

  previewVideo: (url: string) =>
    request<VideoPreview>('/api/jobs/preview', {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),

  async createJob(url: string, options: Partial<JobOptions>): Promise<Job> {
    const result = await request<{ job: Job; owner_token: string }>('/api/jobs', {
      method: 'POST',
      body: JSON.stringify({ url, options }),
    })
    setToken(result.owner_token)
    return result.job
  },

  /**
   * Start a job from a local file. Uses FormData rather than JSON so the
   * browser streams the upload instead of buffering a base64 copy.
   */
  async createJobFromUpload(file: File, options: Partial<JobOptions>): Promise<Job> {
    const form = new FormData()
    form.append('file', file)
    if (options.aspect_ratio) form.append('aspect_ratio', options.aspect_ratio)
    if (options.quality) form.append('quality', options.quality)
    form.append('captions', String(options.captions ?? false))
    if (options.clip_count != null) form.append('clip_count', String(options.clip_count))
    if (options.min_clip_seconds != null) form.append('min_clip_seconds', String(options.min_clip_seconds))
    if (options.max_clip_seconds != null) form.append('max_clip_seconds', String(options.max_clip_seconds))

    const token = getToken()
    const headers = new Headers()
    if (token) headers.set('X-Owner-Token', token)
    // Content-Type is deliberately unset: the browser must add the multipart
    // boundary itself.

    let response: Response
    try {
      response = await fetch('/api/jobs/upload', {
        method: 'POST',
        body: form,
        headers,
        credentials: 'include',
      })
    } catch {
      throw new RequestFailed({
        code: 'offline',
        message: "We couldn't reach the app's server.",
        hint: 'Make sure the backend is running, then try again.',
      })
    }

    const body = await response.json().catch(() => null)
    if (!response.ok) {
      const detail = body?.detail
      if (detail && typeof detail === 'object' && 'message' in detail) {
        throw new RequestFailed(detail as ApiError)
      }
      throw new RequestFailed({ code: `http_${response.status}`, message: 'That upload failed.' })
    }
    setToken(body.owner_token)
    return body.job as Job
  },

  getJob: (jobId: string) => request<Job>(`/api/jobs/${jobId}`),
  getClips: (jobId: string) => request<Clip[]>(`/api/jobs/${jobId}/clips`),
  cancelJob: (jobId: string) => request<Job>(`/api/jobs/${jobId}/cancel`, { method: 'POST' }),
  deleteJob: (jobId: string) => request<void>(`/api/jobs/${jobId}`, { method: 'DELETE' }),
}

export function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
