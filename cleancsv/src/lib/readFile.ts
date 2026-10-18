// Reads a chosen file and parses it, in a Web Worker when the browser supports it.
// The file's contents stay on this device: nothing here makes a network request.

import { parseBytes, type ParseOptions } from '../engine/parse'
import { MAX_BYTES, formatBytes } from '../engine/limits'
import type { ParseResult } from '../engine/types'

export interface Source {
  name: string
  size: number
  read: () => Promise<Uint8Array>
}

function readBlob(file: Blob): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer()
  // Older browsers (Safari before 14) only have FileReader.
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as ArrayBuffer)
    r.onerror = () => reject(r.error)
    r.readAsArrayBuffer(file)
  })
}

export function sourceFromFile(file: File): Source {
  return {
    name: file.name,
    size: file.size,
    read: async () => new Uint8Array(await readBlob(file)),
  }
}

export function sourceFromText(name: string, text: string): Source {
  const bytes = new TextEncoder().encode(text)
  return { name, size: bytes.byteLength, read: async () => bytes.slice() }
}

let worker: Worker | null = null
let nextId = 1

function getWorker(): Worker | null {
  if (worker) return worker
  if (typeof Worker === 'undefined') return null
  try {
    worker = new Worker(new URL('../engine/parse.worker.ts', import.meta.url), { type: 'module' })
    return worker
  } catch {
    return null
  }
}

function parseInWorker(w: Worker, bytes: Uint8Array, opts: ParseOptions): Promise<ParseResult> {
  const id = nextId++
  return new Promise((resolve, reject) => {
    const onMessage = (e: MessageEvent<{ id: number; result: ParseResult }>) => {
      if (e.data.id !== id) return
      w.removeEventListener('message', onMessage)
      w.removeEventListener('error', onError)
      resolve(e.data.result)
    }
    const onError = (e: ErrorEvent) => {
      w.removeEventListener('message', onMessage)
      w.removeEventListener('error', onError)
      e.preventDefault()
      reject(new Error('worker failed'))
    }
    w.addEventListener('message', onMessage)
    w.addEventListener('error', onError)
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    w.postMessage({ id, buffer, opts }, [buffer])
  })
}

export async function readAndParse(source: Source, opts: Omit<ParseOptions, 'fileName'>): Promise<ParseResult> {
  if (source.size > MAX_BYTES) {
    return {
      ok: false,
      error: {
        title: 'This file is too large',
        message: `This file is ${formatBytes(source.size)}. CleanCSV works inside your browser and can handle files up to ${formatBytes(MAX_BYTES)}. Try splitting the file into smaller parts.`,
      },
    }
  }
  let bytes: Uint8Array
  try {
    bytes = await source.read()
  } catch {
    return {
      ok: false,
      error: { title: 'We could not open this file', message: 'Your browser could not read it. If it is on a network drive or in cloud storage, download it to your device first.' },
    }
  }
  const full = { ...opts, fileName: source.name }
  const w = getWorker()
  if (w) {
    try {
      return await parseInWorker(w, bytes, full)
    } catch {
      worker?.terminate()
      worker = null
      // Fall through and parse on the main thread.
    }
  }
  try {
    return parseBytes(bytes, full)
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof RangeError
          ? { title: 'This file is too large for your browser', message: 'Your browser ran out of memory while reading it. Try a smaller file, or close other tabs and try again.' }
          : { title: 'We could not read this file', message: 'Something unexpected went wrong while reading it.' },
    }
  }
}
