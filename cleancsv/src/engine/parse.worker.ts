// Runs file reading off the main thread so the page stays responsive on big files.
import { parseBytes, type ParseOptions } from './parse'
import type { ParseResult } from './types'

interface Request {
  id: number
  buffer: ArrayBuffer
  opts: ParseOptions
}

self.onmessage = (e: MessageEvent<Request>) => {
  const { id, buffer, opts } = e.data
  let result: ParseResult
  try {
    result = parseBytes(new Uint8Array(buffer), opts)
  } catch (err) {
    result = {
      ok: false,
      error:
        err instanceof RangeError
          ? { title: 'This file is too large for your browser', message: 'Your browser ran out of memory while reading it. Try a smaller file, or close other tabs and try again.' }
          : { title: 'We could not read this file', message: 'Something unexpected went wrong while reading it. The file may be damaged.' },
    }
  }
  ;(self as unknown as Worker).postMessage({ id, result })
}
