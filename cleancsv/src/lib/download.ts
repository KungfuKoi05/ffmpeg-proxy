// Saves text as a file on the user's device. Nothing is sent anywhere.
//
// Two ways to save:
// - When CleanCSV runs inside a claude.ai page, normal downloads are blocked there, and the
//   page offers files through the host's `downloads` feature instead. The viewer confirms
//   each save, so we can tell whether it happened.
// - Everywhere else, a normal browser download. Browsers do not report whether the user
//   kept the file, so the result is "started".

export type SaveOutcome =
  | { status: 'saved' }
  | { status: 'started' }
  | { status: 'declined' }
  | { status: 'failed'; message: string }

interface HostDownloads {
  save(req: { filename: string; data: string }): Promise<{ status: string }>
}

let host: Promise<HostDownloads | null> | null = null

function hostDownloads(): Promise<HostDownloads | null> {
  const c = (globalThis as { claude?: { use?: (name: string) => Promise<unknown> } }).claude
  if (typeof c?.use !== 'function') return Promise.resolve(null)
  host ??= c.use('downloads').then(
    (d) => (d as HostDownloads | null) ?? null,
    () => null,
  )
  return host
}

function browserDownload(name: string, text: string, type: string): boolean {
  try {
    const blob = new Blob([text], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return true
  } catch {
    return false
  }
}

export async function saveText(name: string, text: string, type: string): Promise<SaveOutcome> {
  const h = await hostDownloads()
  if (h) {
    try {
      await h.save({ filename: name, data: text })
      return { status: 'saved' }
    } catch (e) {
      const code = (e as { code?: string })?.code
      if (code === 'declined') return { status: 'declined' }
      if (code === 'rate_limited') return { status: 'failed', message: 'A save is already waiting for your answer. Finish that one first.' }
      if (code === 'rejected_extension') return { status: 'failed', message: 'This page can only save files ending in .csv or .txt. Change the file name and try again.' }
      return { status: 'failed', message: 'Saving files is not available here.' }
    }
  }
  return browserDownload(name, text, type) ? { status: 'started' } : { status: 'failed', message: 'Your browser blocked the download. Try again, or allow downloads for this page.' }
}
