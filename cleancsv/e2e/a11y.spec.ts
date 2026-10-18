import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { loadSample } from './helpers'

async function scan(page: Page, where: string) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const problems = r.violations.map((v) => `${where}: ${v.id} (${v.impact}) ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)
  expect(problems).toEqual([])
}

test('no automatically detectable accessibility problems on the main screens', async ({ page }) => {
  await page.goto('/')
  await scan(page, 'upload')
  await loadSample(page)
  await scan(page, 'problems')
  await page.getByRole('button', { name: 'Start cleaning', exact: true }).click()
  await page.getByTestId('fix-similar:Category').getByRole('button', { name: 'Preview' }).click()
  await scan(page, 'clean')
  await page.getByRole('button', { name: 'Download', exact: true }).click()
  await scan(page, 'download')
  for (const name of ['Cleaning History', 'Saved Recipes', 'Help']) {
    await page.getByRole('link', { name: new RegExp(name) }).click()
    await scan(page, name)
  }
})

test('the main workflow can be done with the keyboard alone', async ({ page }) => {
  await page.goto('/')
  const sample = page.getByRole('button', { name: 'Try a sample file' })
  for (let i = 0; i < 20 && !(await sample.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab')
  await expect(sample).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('row-count')).toHaveText('23')
  const go = page.getByRole('button', { name: 'Find problems', exact: true })
  await go.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('findings-heading')).toBeVisible()
})
