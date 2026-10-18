import { expect, test } from '@playwright/test'
import { collectErrors, downloadOf, fix, guardNetwork, loadSample, uploadText } from './helpers'

test('the whole workflow on the sample file: find, fix, undo, download, save a recipe', async ({ page, baseURL }) => {
  const checkNetwork = guardNetwork(page, baseURL!)
  const checkErrors = collectErrors(page)
  await loadSample(page)

  // Step 2: real findings with plain-English explanations.
  await expect(page.getByTestId('finding-duplicate-rows')).toContainText('1 duplicate row')
  await expect(page.getByTestId('finding-formulas')).toContainText('spreadsheet formula')
  await expect(page.getByTestId('finding-dates:Signup Date')).toBeVisible()

  // "Show these rows" filters the table.
  await page.getByTestId('finding-extra-spaces').getByRole('button', { name: /Show these 3 rows/ }).click()
  await expect(page.getByText('Showing only:')).toBeVisible()
  await page.getByRole('button', { name: 'Show all rows' }).click()

  // "Preview fix" jumps to the matching fix card, already open.
  await page.getByTestId('finding-duplicate-rows').getByRole('button', { name: 'Preview fix' }).click()
  const dup = fix(page, 'duplicate-rows')
  await expect(dup.getByTestId('preview-summary')).toHaveText('Will remove 1 duplicate row')
  await expect(dup).toContainText('Row 9 (same as row 1)')
  await dup.getByRole('button', { name: 'Apply fix: remove 1 row' }).click()
  await expect(page.getByTestId('change-count')).toHaveText('1 change applied')
  await expect(page.getByText('Rows 1–22 of 22')).toBeVisible()

  // A non-destructive fix applies straight from the card.
  await fix(page, 'extra-spaces').getByRole('button', { name: 'Apply fix' }).click()
  await expect(page.getByTestId('change-count')).toHaveText('2 changes applied')
  await expect(page.getByText('Highlighted cells were changed by the last step.')).toBeVisible()

  // Undo and redo.
  await page.getByRole('button', { name: 'Undo', exact: true }).first().click()
  await expect(page.getByTestId('change-count')).toHaveText('1 change applied')
  await page.keyboard.press('Control+Shift+Z')
  await expect(page.getByTestId('change-count')).toHaveText('2 changes applied')
  await page.keyboard.press('Control+z')
  await expect(page.getByTestId('change-count')).toHaveText('1 change applied')
  await page.keyboard.press('Control+y')
  await expect(page.getByTestId('change-count')).toHaveText('2 changes applied')

  // Dates: the column proves month-first, so the order is suggested; the preview shows real conversions.
  const dates = fix(page, 'dates:Signup Date')
  await dates.getByRole('button', { name: 'Preview' }).click()
  await expect(dates).toContainText('We think these are month/day/year')
  await expect(dates).toContainText('will stay exactly as they are')
  await dates.getByRole('button', { name: 'Apply fix' }).click()
  await expect(page.getByTestId('change-count')).toHaveText('3 changes applied')

  // Categories: case-only groups are ticked, the spelling group is not until the user ticks it.
  const cats = fix(page, 'similar:Category')
  await cats.getByRole('button', { name: 'Apply fix' }).click()
  await expect(cats.getByText('Check the settings and the preview below')).toBeVisible()
  const spelling = cats.locator('div.rounded-lg.border', { hasText: 'Similar spelling' })
  await spelling.getByLabel('Combine this group').check()
  await expect(cats.getByLabel(/Electroncs/)).toBeChecked()
  await cats.getByRole('button', { name: 'Apply fix' }).click()
  await expect(page.getByTestId('change-count')).toHaveText('4 changes applied')

  // Step 4: download and check the actual file contents.
  await page.getByRole('button', { name: 'Download', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your file is ready.' })).toBeVisible()
  await expect(page.getByTestId('final-rows')).toHaveText('22')
  await expect(page.getByTestId('steps-applied')).toHaveText('4')

  const csv = await downloadOf(page, () => page.getByRole('button', { name: 'Download cleaned CSV' }).click())
  expect(csv.name).toBe('cleaned-sample-customers.csv')
  const lines = csv.text.replace(/^﻿/, '').trim().split(/\r\n/)
  expect(lines).toHaveLength(23)
  expect(lines.filter((l) => l.startsWith('C-1001,'))).toHaveLength(1)
  expect(csv.text).toContain('2026-01-22')
  expect(csv.text).not.toContain('01/22/2026')
  expect(csv.text).toContain(`"'=HYPERLINK(""http://example.com"",""click"")"`)
  expect(csv.text).not.toContain('Electroncs')
  expect(csv.text).toContain('Liam Carter,')
  await expect(page.getByText(/Checked before saving/)).toBeVisible()

  const report = await downloadOf(page, () => page.getByRole('button', { name: 'Download change report' }).click())
  expect(report.name).toBe('cleaned-sample-customers-change-report.txt')
  expect(report.text).toContain('Rows:           23 before, 22 after')
  expect(report.text).toContain('Row 9 removed (same as row 1)')
  expect(report.text).toContain('Row 2, "Name": "  Liam Carter" -> "Liam Carter"')

  // Save as a recipe and find it on the recipes page.
  await page.getByRole('button', { name: 'Save steps as a recipe' }).click()
  await page.getByLabel('Recipe name').fill('Customer export cleanup')
  await page.getByRole('button', { name: 'Save recipe' }).click()
  await page.getByRole('link', { name: /Saved Recipes/ }).click()
  await expect(page.getByTestId('recipe-card')).toContainText('Customer export cleanup')
  await expect(page.getByTestId('recipe-card')).toContainText('4 steps')

  // The download was recorded in history (metadata only).
  await page.getByRole('link', { name: 'Cleaning History' }).click()
  await expect(page.getByText('sample-customers.csv → cleaned-sample-customers.csv')).toBeVisible()

  checkNetwork()
  checkErrors()
})

test('reset to original restores the exact data', async ({ page }) => {
  await loadSample(page)
  await page.getByRole('button', { name: 'Start cleaning', exact: true }).click()
  await fix(page, 'extra-spaces').getByRole('button', { name: 'Apply fix' }).click()
  await expect(page.getByTestId('change-count')).toHaveText('1 change applied')
  await expect(page.getByRole('cell', { name: 'Liam Carter', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Reset to original' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Reset to original' }).click()
  await expect(page.getByTestId('change-count')).toHaveText('No changes yet')
  await expect(page.getByRole('cell', { name: /Liam Carter \(has leading spaces\)/ })).toBeVisible()
})

test('reads quoted commas, line breaks and non-English text from an uploaded file', async ({ page }) => {
  await page.goto('/')
  await uploadText(page, 'contacts.csv', 'Name,Address,Note\n"Smith, John","1 Main St\nApt 2","Said ""hi"""\nJosé Müller,Zürich,名前 🎉\n')
  await expect(page.getByTestId('row-count')).toHaveText('2')
  await expect(page.getByTestId('column-count')).toHaveText('3')
  await expect(page.getByRole('cell', { name: 'Smith, John' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Said "hi"' })).toBeVisible()
  await expect(page.getByRole('cell', { name: '名前 🎉' })).toBeVisible()
})

test('explains unreadable files instead of importing them', async ({ page }) => {
  await page.goto('/')
  await uploadText(page, 'empty.csv', '')
  await expect(page.getByRole('alert')).toContainText('This file is empty')
  await uploadText(page, 'book.xlsx', Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]))
  await expect(page.getByRole('alert')).toContainText('Excel or zip file')
  await expect(page.getByRole('button', { name: 'Find problems', exact: true })).toHaveCount(0)
})

test('a broken quote must be confirmed before continuing', async ({ page }) => {
  await page.goto('/')
  await uploadText(page, 'broken.csv', 'a,b\n1,"oops\n3,4\n')
  const go = page.getByRole('button', { name: 'Find problems', exact: true })
  await expect(page.getByText(/is never closed/)).toBeVisible()
  await expect(go).toBeDisabled()
  await page.getByLabel(/I checked the preview/).check()
  await expect(go).toBeEnabled()
})

test('ambiguous dates cannot be converted until the user chooses an order', async ({ page }) => {
  await page.goto('/')
  await uploadText(page, 'dates.csv', 'Order Date,Item\n03/04/2026,A\n05/06/2026,B\n07/08/2026,C\n')
  await page.getByRole('button', { name: 'Find problems', exact: true }).click()
  await expect(page.getByTestId('finding-dates:Order Date')).toContainText('could be read two ways')
  await page.getByTestId('finding-dates:Order Date').getByRole('button', { name: 'Preview fix' }).click()
  const card = fix(page, 'dates:Order Date')
  await expect(card).toContainText('Mar 4, 2026 if month first, or Apr 3, 2026 if day first')
  await expect(card.getByRole('button', { name: 'Apply fix' })).toBeDisabled()
  await card.getByLabel('How should dates like 03/04/2026 be read?').selectOption('DMY')
  await expect(card.getByRole('cell', { name: '2026-04-03' })).toBeVisible()
  await card.getByRole('button', { name: 'Apply fix' }).click()
  await expect(page.getByRole('cell', { name: '2026-06-05' })).toBeVisible()
})

test('a saved recipe replays on a new file and explains missing columns', async ({ page }) => {
  await page.goto('/')
  await uploadText(page, 'week1.csv', 'Name ,Category\n ada ,toys\nAda,Toys\n')
  await page.getByRole('button', { name: 'Find problems', exact: true }).click()
  await page.getByRole('button', { name: 'Start cleaning', exact: true }).click()
  await fix(page, 'header-spaces').getByRole('button', { name: 'Apply fix' }).click()
  await fix(page, 'extra-spaces').getByRole('button', { name: 'Apply fix' }).click()
  await expect(page.getByTestId('change-count')).toHaveText('2 changes applied')
  await page.getByRole('button', { name: 'Save steps as a recipe' }).click()
  await page.getByLabel('Recipe name').fill('Weekly export')
  await page.getByRole('button', { name: 'Save recipe' }).click()

  // Week 2: same layout.
  await page.getByRole('button', { name: /Step 1: Upload/ }).click()
  await uploadText(page, 'week2.csv', 'Name ,Category\n bob ,Books\n')
  await page.getByRole('dialog').getByRole('button', { name: 'Discard changes and open' }).click()
  await page.getByRole('button', { name: 'Find problems', exact: true }).click()
  await page.getByRole('button', { name: 'Start cleaning', exact: true }).click()
  await page.getByRole('button', { name: /Apply a saved recipe/ }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('On this file: Renamed 1 column')
  await expect(dialog).toContainText('On this file: Removed extra spaces in 1 cell')
  await dialog.getByRole('button', { name: 'Apply all 2 steps' }).click()
  await expect(page.getByTestId('change-count')).toHaveText('2 changes applied')
  await expect(page.getByRole('cell', { name: 'bob', exact: true })).toBeVisible()

  // Week 3: a column is missing, so the recipe explains instead of running blindly.
  await page.getByRole('button', { name: /Step 1: Upload/ }).click()
  await uploadText(page, 'week3.csv', 'Full Name,Type\nx,y\n')
  await page.getByRole('dialog').getByRole('button', { name: 'Discard changes and open' }).click()
  await page.getByRole('button', { name: 'Find problems', exact: true }).click()
  await page.getByRole('link', { name: /Saved Recipes/ }).click()
  await page.getByRole('button', { name: 'Use on the open file' }).click()
  const d2 = page.getByRole('dialog')
  await expect(d2).toContainText('Some columns do not match the expected layout')
  await expect(d2).toContainText('does not have “Name ”')
})
