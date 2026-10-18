import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

async function openSample(user: ReturnType<typeof userEvent.setup>) {
  render(<App />)
  await user.click(screen.getByRole('button', { name: 'Try a sample file' }))
  await screen.findByText('sample-customers.csv')
  expect(screen.getByTestId('row-count')).toHaveTextContent('23')
  await user.click(screen.getByRole('button', { name: 'Find problems' }))
  await screen.findByTestId('findings-heading')
}

describe('CleanCSV app', () => {
  it('starts on the upload step with the privacy promise and a sample button', () => {
    render(<App />)
    expect(screen.getByText('Drop your CSV file here')).toBeInTheDocument()
    expect(screen.getByText(/never uploads it anywhere/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try a sample file' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Step 2: Find problems' })).toBeDisabled()
  })

  it('reads an uploaded file (without a Web Worker) and shows its size', async () => {
    const user = userEvent.setup()
    render(<App />)
    const file = new File(['name,email\nAda,ada@example.com\nGrace,grace@example\n'], 'people.csv', { type: 'text/csv' })
    await user.upload(screen.getByLabelText('Choose a CSV file'), file)
    expect(await screen.findByText('people.csv')).toBeInTheDocument()
    expect(screen.getByTestId('row-count')).toHaveTextContent('2')
    expect(screen.getByTestId('column-count')).toHaveTextContent('2')
  })

  it('shows a clear error for an empty file', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.upload(screen.getByLabelText('Choose a CSV file'), new File([''], 'empty.csv', { type: 'text/csv' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This file is empty')
  })

  it('finds problems, applies a fix, and undoes it with the keyboard', async () => {
    const user = userEvent.setup()
    await openSample(user)
    expect(screen.getByTestId('findings-heading')).toHaveTextContent(/Your file has \d+ things worth checking/)
    expect(screen.getByTestId('finding-duplicate-rows')).toHaveTextContent('1 duplicate row')

    await user.click(screen.getByRole('button', { name: 'Start cleaning' }))
    const card = screen.getByTestId('fix-extra-spaces')
    await user.click(within(card).getByRole('button', { name: 'Preview' }))
    expect(within(card).getByTestId('preview-summary')).toHaveTextContent('Will remove extra spaces in 2 cells')
    await user.click(within(card).getByRole('button', { name: 'Apply fix' }))
    expect(screen.getByTestId('change-count')).toHaveTextContent('1 change applied')

    await user.keyboard('{Control>}z{/Control}')
    expect(screen.getByTestId('change-count')).toHaveTextContent('No changes yet')
    await user.keyboard('{Control>}y{/Control}')
    expect(screen.getByTestId('change-count')).toHaveTextContent('1 change applied')
  })

  it('asks before removing rows and shows which rows will go', async () => {
    const user = userEvent.setup()
    await openSample(user)
    await user.click(within(screen.getByTestId('finding-duplicate-rows')).getByRole('button', { name: 'Preview fix' }))
    const card = await screen.findByTestId('fix-duplicate-rows')
    expect(within(card).getByText('These rows will be removed')).toBeInTheDocument()
    expect(within(card).getByText(/same as row 1/)).toBeInTheDocument()
    await user.click(within(card).getByRole('button', { name: 'Apply fix: remove 1 row' }))
    expect(screen.getByTestId('change-count')).toHaveTextContent('1 change applied')
  })

  it('confirms before resetting to the original', async () => {
    const user = userEvent.setup()
    await openSample(user)
    await user.click(screen.getByRole('button', { name: 'Start cleaning' }))
    await user.click(within(screen.getByTestId('fix-empty-rows')).getByRole('button', { name: 'Apply fix' }))
    await user.click(within(screen.getByTestId('fix-empty-rows')).getByRole('button', { name: /Apply fix: remove 1 row/ }))
    expect(screen.getByTestId('change-count')).toHaveTextContent('1 change applied')
    await user.click(screen.getByRole('button', { name: 'Reset to original' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Reset to original' }))
    expect(screen.getByTestId('change-count')).toHaveTextContent('No changes yet')
  })

  it('saves a recipe to this browser', async () => {
    const user = userEvent.setup()
    await openSample(user)
    await user.click(screen.getByRole('button', { name: 'Start cleaning' }))
    await user.click(within(screen.getByTestId('fix-extra-spaces')).getByRole('button', { name: 'Apply fix' }))
    await user.click(screen.getByRole('button', { name: 'Save steps as a recipe' }))
    await user.type(screen.getByLabelText('Recipe name'), 'Trim it')
    await user.click(screen.getByRole('button', { name: 'Save recipe' }))
    const saved = JSON.parse(localStorage.getItem('cleancsv.recipes.v1') ?? '[]')
    expect(saved).toHaveLength(1)
    expect(saved[0].name).toBe('Trim it')
    expect(saved[0].steps[0].action).toBe('trimWhitespace')
    // File contents are never stored.
    expect(JSON.stringify(localStorage)).not.toContain('ava.thompson@example.com')
  })

  it('still works when the browser blocks local storage', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const user = userEvent.setup()
    await openSample(user)
    await user.click(screen.getByRole('button', { name: 'Start cleaning' }))
    await user.click(within(screen.getByTestId('fix-extra-spaces')).getByRole('button', { name: 'Apply fix' }))
    await user.click(screen.getByRole('button', { name: 'Save steps as a recipe' }))
    expect(screen.getByText(/blocking local storage/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save recipe' }))
    expect(screen.getByText(/for this tab only/)).toBeInTheDocument()
    spy.mockRestore()
  })

  it('shows the download summary with real counts', async () => {
    const user = userEvent.setup()
    await openSample(user)
    await user.click(screen.getByRole('button', { name: 'Step 4: Download' }))
    expect(screen.getByRole('heading', { name: /Your file is ready/ })).toBeInTheDocument()
    expect(screen.getByTestId('final-rows')).toHaveTextContent('23')
    expect(screen.getByTestId('steps-applied')).toHaveTextContent('0')
    expect(screen.getByLabelText(/Protect against spreadsheet formulas/)).toBeChecked()
    await waitFor(() => expect(screen.getByText(/1 cell\(s\) start with =/)).toBeInTheDocument())
  })
})
