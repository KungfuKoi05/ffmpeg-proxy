import { useState } from 'react'
import { storage } from '../lib/storage'
import { MAX_BYTES, SOFT_LIMIT_BYTES, formatBytes } from '../engine/limits'
import { useApp } from '../state'
import { Button, Card, Dialog } from '../components/ui'

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Is my file uploaded anywhere?',
    a: 'No. CleanCSV runs entirely inside your web browser. Your file is read and cleaned on your device and is never sent to a server, an AI service or an analytics service. You can even disconnect from the internet after the page has loaded.',
  },
  {
    q: 'What is a CSV file?',
    a: 'A CSV ("comma-separated values") file is a plain text spreadsheet: one row per line, with commas between the values. Excel, Google Sheets, Numbers, and most online tools can save or export one. In Excel use File → Save As → CSV UTF-8.',
  },
  {
    q: 'Will CleanCSV change my data without asking?',
    a: 'No. CleanCSV only finds problems and suggests fixes. Nothing changes until you press "Apply fix", and you can preview every fix first. The only automatic adjustment is giving a name to columns that have no name or a repeated name, which is shown to you when the file is opened.',
  },
  {
    q: 'How do I undo a mistake?',
    a: 'Press Undo (or Ctrl+Z / Cmd+Z) to step back one change at a time, Redo to go forward again, or "Reset to original" to go back to the file exactly as you opened it. Reset can be redone too.',
  },
  {
    q: 'What does "Our guess: please check" mean?',
    a: 'Some findings are certain, like two rows being identical. Others are educated guesses, like "this column looks like dates" or "USA and United States are probably the same". Guesses are labelled so you can decide.',
  },
  {
    q: 'Why does it ask me how to read dates?',
    a: 'A date like 03/04/2026 means March 4 in the US but 3 April in most other countries. If nothing in the column settles it (such as a 25 in the first position), CleanCSV asks you instead of guessing. Converting to 2026-03-04 (year-month-day) avoids the confusion in future.',
  },
  {
    q: 'Why did some cells get an apostrophe at the start?',
    a: 'Cells that start with =, +, -, or @ can be run as formulas by Excel or Google Sheets, which is a known way to attack people who open a CSV. With "Protect against spreadsheet formulas" on, CleanCSV adds an apostrophe in front so they display as text. Plain numbers like -5 and phone numbers like +1 555 010 0100 are not changed. You can turn this off on the Download step.',
  },
  {
    q: 'What is the change report?',
    a: 'A text file that lists every change: which row and column, what the value was before and after, which rows were removed and why, and what still needs checking. It is made from the changes that were actually applied.',
  },
  {
    q: 'How big a file can I clean?',
    a: `Up to ${formatBytes(MAX_BYTES)}. Files over ${formatBytes(SOFT_LIMIT_BYTES)} work but some fixes can take a few seconds. Because everything happens in your browser, very large files depend on your device's memory. Phones handle less than laptops.`,
  },
  {
    q: 'Can it open Excel (.xlsx) files?',
    a: 'Not yet. Save the sheet as CSV from Excel or Google Sheets first. This keeps CleanCSV small and avoids reading complex file formats.',
  },
  {
    q: 'Where are my recipes and history stored?',
    a: 'In this browser on this device (local storage). They are not synced to other devices. Use Export on a recipe to copy it elsewhere. Recipes store the steps and their settings, such as the category names you chose to combine or the text you typed into Find and replace, but never your rows. History stores file names, row counts and step names, never file contents.',
  },
  {
    q: 'Keyboard shortcuts',
    a: 'Ctrl+Z (Cmd+Z on Mac): undo. Ctrl+Shift+Z or Ctrl+Y: redo. Tab and Shift+Tab move between controls; Enter or Space presses buttons; Escape closes dialogs.',
  },
]

export function HelpPage() {
  const { setRecipes, clearHistory, notify } = useApp()
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Help</h1>
        <p className="mt-2 text-slate-600">Plain answers to common questions.</p>
      </header>
      <div className="space-y-3">
        {FAQ.map((f) => (
          <Card key={f.q} className="p-0">
            <details className="group p-4">
              <summary className="cursor-pointer font-medium text-slate-900">{f.q}</summary>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{f.a}</p>
            </details>
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <h2 className="font-semibold text-slate-900">Privacy controls</h2>
        <p className="mt-1 text-sm text-slate-600">Remove everything CleanCSV has saved in this browser: recipes and cleaning history. Open files are kept in memory only and disappear when you close the tab.</p>
        <Button className="mt-3" variant="danger" onClick={() => setConfirm(true)}>
          Clear all saved data
        </Button>
      </Card>
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Clear all saved data?"
        description="This deletes every saved recipe and your cleaning history from this browser. It cannot be undone."
        footer={
          <>
            <Button onClick={() => setConfirm(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                storage.clearAll()
                setRecipes([])
                clearHistory()
                setConfirm(false)
                notify('All saved data was removed from this browser.', 'info')
              }}
            >
              Delete everything
            </Button>
          </>
        }
      />
    </div>
  )
}
