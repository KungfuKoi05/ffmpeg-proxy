import { describe, expect, it } from 'vitest'
import { makeUniqueHeaders, parseBytes, parseText } from './parse'
import { MAX_BYTES, MAX_CELLS } from './limits'
import { grid, load } from './test-helpers'

describe('reading CSV files', () => {
  it('imports a valid CSV with headers and rows', () => {
    const { table, meta } = load('name,age\nAda,36\nGrace,45\n')
    expect(table.headers).toEqual(['name', 'age'])
    expect(table.rows.map((r) => r.cells)).toEqual([
      ['Ada', '36'],
      ['Grace', '45'],
    ])
    expect(table.rows.map((r) => r.id)).toEqual([1, 2])
    expect(meta.rowCount).toBe(2)
    expect(meta.columnCount).toBe(2)
    expect(meta.delimiter).toBe(',')
    expect(meta.encoding).toBe('utf-8')
    expect(meta.warnings).toEqual([])
  })

  it('rejects an empty file', () => {
    const r = parseBytes(new Uint8Array(0), { fileName: 'empty.csv' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.title).toMatch(/empty/i)
  })

  it('rejects a file that only has blank space', () => {
    const r = parseText('   \n\n  \n')
    expect(r.ok).toBe(false)
  })

  it('rejects a file with column names but no rows', () => {
    const r = parseText('a,b,c\n')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.title).toMatch(/no rows/i)
  })

  it('keeps commas inside quoted values', () => {
    const { table } = load('name,address\n"Smith, John","1 Main St, Springfield"\n')
    expect(table.rows[0].cells).toEqual(['Smith, John', '1 Main St, Springfield'])
  })

  it('keeps line breaks inside quoted values', () => {
    const { table } = load('name,note\nAda,"line one\nline two"\nGrace,ok\n')
    expect(table.rows).toHaveLength(2)
    expect(table.rows[0].cells[1]).toBe('line one\nline two')
    expect(table.rows[1].cells).toEqual(['Grace', 'ok'])
  })

  it('reads escaped quotation marks', () => {
    const { table } = load('quote\n"She said ""hi"""\n')
    expect(table.rows[0].cells[0]).toBe('She said "hi"')
  })

  it('detects semicolon and tab separated files', () => {
    expect(load('a;b\n1;2\n').meta.delimiter).toBe(';')
    expect(load('a\tb\n1\t2\n').meta.delimiter).toBe('\t')
    expect(load('a|b\n1|2\n').meta.delimiter).toBe('|')
  })

  it('lets the user force a separator', () => {
    const r = parseText('a;b,c\n1;2,3\n', { delimiter: ',' })
    expect(r.ok && r.table.headers).toEqual(['a;b', 'c'])
  })

  it('reads Unicode and non-English text', () => {
    const { table } = load('名前,ville,emoji\n山田太郎,Zürich,🎉\nJosé,São Paulo,ñ\n')
    expect(table.headers).toEqual(['名前', 'ville', 'emoji'])
    expect(table.rows[0].cells).toEqual(['山田太郎', 'Zürich', '🎉'])
    expect(table.rows[1].cells).toEqual(['José', 'São Paulo', 'ñ'])
  })

  it('strips a UTF-8 byte-order mark and remembers it', () => {
    const { table, meta } = load('﻿name\nAda\n')
    expect(table.headers).toEqual(['name'])
    expect(meta.hadBom).toBe(true)
  })

  it('falls back to Windows-1252 for files that are not UTF-8, and says so', () => {
    // "Café" encoded as Windows-1252: é is the single byte 0xE9
    const bytes = new Uint8Array([0x6e, 0x61, 0x6d, 0x65, 0x0a, 0x43, 0x61, 0x66, 0xe9, 0x0a])
    const r = parseBytes(bytes, { fileName: 'old.csv' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.table.rows[0].cells[0]).toBe('Café')
    expect(r.meta.encoding).toBe('windows-1252')
    expect(r.meta.warnings.some((w) => w.kind === 'encoding-fallback')).toBe(true)
  })

  it('reads UTF-16 files with a byte-order mark', () => {
    const text = 'a,b\nü,2\n'
    const bytes = new Uint8Array(2 + text.length * 2)
    bytes[0] = 0xff
    bytes[1] = 0xfe
    for (let i = 0; i < text.length; i++) bytes[2 + i * 2] = text.charCodeAt(i)
    const r = parseBytes(bytes, { fileName: 'u16.csv' })
    expect(r.ok && r.table.rows[0].cells).toEqual(['ü', '2'])
  })

  it('refuses Excel files with instructions', () => {
    const r = parseBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]), { fileName: 'book.xlsx' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.message).toMatch(/Save As|CSV/)
  })

  it('refuses binary data', () => {
    const bytes = new Uint8Array(2000).map((_, i) => (i * 7) % 32)
    const r = parseBytes(bytes, { fileName: 'blob.csv' })
    expect(r.ok).toBe(false)
  })

  it('keeps blank lines as empty rows so they can be found', () => {
    const { table } = load('a,b\n1,2\n\n3,4\n')
    expect(table.rows).toHaveLength(3)
    expect(table.rows[1].cells).toEqual(['', ''])
  })

  it('handles Windows and old Mac line endings', () => {
    expect(load('a,b\r\n1,2\r\n').table.rows[0].cells).toEqual(['1', '2'])
    expect(load('a,b\r\n1,2\r\n').meta.lineEnding).toBe('\r\n')
  })
})

describe('malformed CSV files', () => {
  it('keeps extra values in new columns instead of dropping them, and warns', () => {
    const { table, meta } = load('a,b\n1,2\n3,4,5\n')
    expect(table.headers).toEqual(['a', 'b', 'Extra 1'])
    expect(table.rows[1].cells).toEqual(['3', '4', '5'])
    expect(table.rows[0].cells).toEqual(['1', '2', ''])
    const w = meta.warnings.find((x) => x.kind === 'extra-cells')
    expect(w?.rows).toEqual([2])
  })

  it('pads short rows and warns', () => {
    const { table, meta } = load('a,b,c\n1,2\n')
    expect(table.rows[0].cells).toEqual(['1', '2', ''])
    expect(meta.warnings.some((w) => w.kind === 'missing-cells')).toBe(true)
  })

  it('flags an unclosed quote as a blocking problem instead of pretending all is well', () => {
    const r = parseText('a,b\n1,"oops\n3,4\n5,6\n')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const w = r.meta.warnings.find((x) => x.kind === 'unclosed-quote')
    expect(w).toBeDefined()
    expect(w?.blocking).toBe(true)
  })

  it('names blank and repeated column names so they can be told apart', () => {
    const { table, meta } = load('Name,,Email,Email\na,b,c,d\n')
    expect(table.headers).toEqual(['Name', 'Column 2', 'Email', 'Email (2)'])
    expect(meta.originalHeaders).toEqual(['Name', '', 'Email', 'Email'])
    expect(meta.warnings.some((w) => w.kind === 'renamed-headers')).toBe(true)
  })
})

describe('unique header naming', () => {
  it('makes every name unique and fills blanks', () => {
    expect(makeUniqueHeaders(['id', 'id', 'id', '', ' '])).toEqual(['id', 'id (2)', 'id (3)', 'Column 4', 'Column 5'])
  })
  it('leaves already-unique names alone', () => {
    expect(makeUniqueHeaders(['a', 'b', 'A'])).toEqual(['a', 'b', 'A'])
  })
})

describe('large files', () => {
  it('has sensible default limits', () => {
    expect(MAX_BYTES).toBeGreaterThanOrEqual(50 * 1024 * 1024)
    expect(MAX_CELLS).toBeGreaterThanOrEqual(3_000_000)
  })

  it('refuses files over the size limit before reading them', () => {
    const bytes = new TextEncoder().encode('a,b\n1,2\n3,4\n')
    const r = parseBytes(bytes, { fileName: 'huge.csv', limits: { maxBytes: 10, maxCells: 1000 } })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.title).toMatch(/too large/i)
      expect(r.error.message).toMatch(/splitting/i)
    }
  })

  it('refuses tables with too many cells, with a clear message', () => {
    const lines = ['a,b,c']
    for (let i = 0; i < 100; i++) lines.push(`${i},x,y`)
    const r = parseText(lines.join('\n'), { limits: { maxBytes: 1e9, maxCells: 250 } })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.title).toMatch(/too many cells/i)
  })

  it('refuses huge files early, before parsing them fully', () => {
    const lines = ['a,b,c']
    for (let i = 0; i < 1000; i++) lines.push(`${i},x,y`)
    const r = parseText(lines.join('\n'), { limits: { maxBytes: 1e9, maxCells: 100 } })
    expect(r.ok).toBe(false)
  })

  it('reads a 50,000 row file', () => {
    const lines = ['id,name,email']
    for (let i = 0; i < 50_000; i++) lines.push(`${i},Person ${i},p${i}@example.com`)
    const { table } = load(lines.join('\n'))
    expect(table.rows).toHaveLength(50_000)
    expect(grid(table)[50_000]).toEqual(['49999', 'Person 49999', 'p49999@example.com'])
  })
})
