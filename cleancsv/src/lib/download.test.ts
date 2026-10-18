import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.resetModules()
})

const hostWith = (save: () => Promise<{ status: string }>) => ({ use: vi.fn(async (name: string) => (name === 'downloads' ? { save } : null)) })

describe('saving files', () => {
  it('uses the host save feature on claude.ai pages and reports a real save', async () => {
    const save = vi.fn(async () => ({ status: 'saved' }))
    vi.stubGlobal('claude', hostWith(save))
    const { saveText } = await import('./download')
    expect(await saveText('cleaned.csv', 'a,b\r\n', 'text/csv')).toEqual({ status: 'saved' })
    expect(save).toHaveBeenCalledWith({ filename: 'cleaned.csv', data: 'a,b\r\n' })
  })

  it('does not claim a save when the viewer cancels', async () => {
    vi.stubGlobal('claude', hostWith(() => Promise.reject({ code: 'declined', message: 'no' })))
    const { saveText } = await import('./download')
    expect(await saveText('cleaned.csv', 'x', 'text/csv')).toEqual({ status: 'declined' })
  })

  it('explains a file type the host refuses', async () => {
    vi.stubGlobal('claude', hostWith(() => Promise.reject({ code: 'rejected_extension', message: 'no' })))
    const { saveText } = await import('./download')
    const r = await saveText('cleaned.tsv', 'x', 'text/csv')
    expect(r.status).toBe('failed')
    expect(r.status === 'failed' && r.message).toMatch(/\.csv or \.txt/)
  })

  it('falls back to a normal browser download elsewhere', async () => {
    // jsdom has no createObjectURL, so provide one for this test.
    const create = vi.fn(() => 'blob:x')
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const { saveText } = await import('./download')
    expect(await saveText('cleaned.csv', 'x', 'text/csv')).toEqual({ status: 'started' })
    expect(create).toHaveBeenCalled()
    expect(click).toHaveBeenCalled()
  })
})
