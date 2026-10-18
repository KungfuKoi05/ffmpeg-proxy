import { expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

/** Fails the test if the page tries to contact any server other than itself. */
export function guardNetwork(page: Page, baseURL: string) {
  const outside: string[] = []
  page.on('request', (r) => {
    const u = r.url()
    if (!u.startsWith(baseURL) && !u.startsWith('blob:') && !u.startsWith('data:')) outside.push(u)
  })
  return () => expect(outside, 'requests to other servers').toEqual([])
}

export function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  return () => expect(errors, 'browser errors').toEqual([])
}

export async function loadSample(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try a sample file' }).click()
  await expect(page.getByTestId('row-count')).toHaveText('23')
  await page.getByRole('button', { name: 'Find problems', exact: true }).click()
  await expect(page.getByTestId('findings-heading')).toContainText('things worth checking')
}

export async function uploadText(page: Page, name: string, text: string | Buffer) {
  await page.getByLabel('Choose a CSV file').setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.isBuffer(text) ? text : Buffer.from(text, 'utf-8') })
}

export async function downloadOf(page: Page, click: () => Promise<void>): Promise<{ name: string; text: string }> {
  const wait = page.waitForEvent('download')
  await click()
  const d = await wait
  const path = await d.path()
  return { name: d.suggestedFilename(), text: readFileSync(path!, 'utf-8') }
}

export function fix(page: Page, id: string) {
  return page.getByTestId(`fix-${id}`)
}
