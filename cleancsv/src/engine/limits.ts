// File size limits, chosen from measurements (see README "Performance"):
//   100,000 rows x 10 columns (9 MB): read ~0.2-3 s, problem check ~2-3 s in the background, fixes ~0.2-0.3 s.
//   300,000 rows x 10 columns (28 MB): works, but the first check takes ~7 s and fixes ~1 s.
//   500,000 rows x 10 columns (47 MB): the problem check used ~1.9 GB of memory in Node, too much for many tabs.
// Everything runs in the browser tab, so the real ceiling is the device's memory.

/** Files above this size show a "this may be slow" note. */
export const SOFT_LIMIT_BYTES = 10 * 1024 * 1024

/** Files above this size are refused before reading. */
export const MAX_BYTES = 50 * 1024 * 1024

/** Tables with more cells (rows x columns) than this are refused. */
export const MAX_CELLS = 3_500_000

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} bytes`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`
  return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`
}
