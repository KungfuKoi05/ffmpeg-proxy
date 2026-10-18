import { expect, test } from '@playwright/test'
import { fix, uploadText } from './helpers'

function synthetic(rows: number): string {
  const cats = ['Electronics', 'electronics', 'Toys', 'Books', 'Home & Garden', 'TOYS']
  const out = ['id,name,email,phone,signup,country,category,total,notes,flag']
  for (let i = 0; i < rows; i++) {
    out.push(
      [
        `C-${i}`,
        i % 50 === 0 ? ` Person ${i} ` : `Person ${i}`,
        i % 97 === 0 ? `p${i}@example` : `p${i}@example.com`,
        `(555) 010-${String(i % 10000).padStart(4, '0')}`,
        `2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
        i % 3 ? 'USA' : 'Canada',
        cats[i % cats.length],
        `"$${(i % 5000).toLocaleString('en-US')}.50"`,
        i % 10 ? '' : 'N/A',
        i % 2 ? 'yes' : 'no',
      ].join(','),
    )
  }
  return out.join('\n')
}

// LARGE_ROWS=300000 npx playwright test e2e/large.spec.ts  checks a bigger file by hand.
const ROWS = Number(process.env.LARGE_ROWS ?? 100_000)

test(`a ${ROWS.toLocaleString('en-US')}-row file stays usable`, async ({ page }) => {
  test.setTimeout(300_000)
  await page.goto('/')
  const text = synthetic(ROWS)
  let t = Date.now()
  await uploadText(page, 'big.csv', text)
  await expect(page.getByTestId('row-count')).toHaveText(ROWS.toLocaleString('en-US'), { timeout: 120_000 })
  const readMs = Date.now() - t

  t = Date.now()
  await page.getByRole('button', { name: 'Find problems', exact: true }).click()
  await expect(page.getByTestId('findings-heading')).toContainText('things worth checking', { timeout: 180_000 })
  const checkMs = Date.now() - t

  await page.getByRole('button', { name: 'Start cleaning', exact: true }).click()
  t = Date.now()
  await fix(page, 'extra-spaces').getByRole('button', { name: 'Apply fix' }).click()
  await expect(page.getByTestId('change-count')).toHaveText('1 change applied')
  const applyMs = Date.now() - t
  // While the problem list refreshes in the background, the page must still respond.
  t = Date.now()
  await page.getByRole('button', { name: 'Undo', exact: true }).first().click()
  await expect(page.getByTestId('change-count')).toHaveText('No changes yet')
  const undoMs = Date.now() - t

  console.log(`${ROWS.toLocaleString('en-US')} rows (${(text.length / 1048576).toFixed(1)} MB): read ${readMs} ms, first check ${checkMs} ms, apply ${applyMs} ms, undo ${undoMs} ms`)
  if (ROWS <= 100_000) {
    expect(applyMs).toBeLessThan(5_000)
    expect(undoMs).toBeLessThan(5_000)
  }
})
