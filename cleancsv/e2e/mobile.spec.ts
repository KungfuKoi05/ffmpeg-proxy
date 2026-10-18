import { expect, test } from '@playwright/test'
import { loadSample } from './helpers'

test('works on a phone: menu, workflow, no sideways page scrolling', async ({ page }) => {
  await loadSample(page)
  const noOverflow = async () => {
    const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
    expect(sw).toBeLessThanOrEqual(iw)
  }
  await noOverflow()
  await page.getByRole('button', { name: 'Start cleaning', exact: true }).click()
  await page.getByTestId('fix-extra-spaces').getByRole('button', { name: 'Apply fix' }).click()
  await expect(page.getByTestId('change-count')).toHaveText('1 change applied')
  await noOverflow()
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('link', { name: 'Help' }).click()
  await expect(page.getByRole('heading', { name: 'Help', level: 1 })).toBeVisible()
  await noOverflow()
})
