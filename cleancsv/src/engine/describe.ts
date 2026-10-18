// Plain-English names for cleaning steps, used in history, recipes and the change report.

import type { Step } from './types'

const list = (cols: string[]) => (cols.length === 0 ? 'all columns' : cols.map((c) => `"${c}"`).join(', '))

export function describeStep(step: Step): string {
  switch (step.action) {
    case 'removeDuplicates': {
      const p = step.params
      const by = p.columns.length === 0 ? 'identical rows' : `rows with the same ${list(p.columns)}`
      const extras = [p.ignoreCase && 'ignoring capitalization', p.ignoreSpaces && 'ignoring extra spaces'].filter(Boolean)
      return `Remove duplicate ${by}${extras.length ? ` (${extras.join(', ')})` : ''}, keeping the ${p.keep} one`
    }
    case 'removeEmptyRows':
      return 'Remove empty rows'
    case 'removeEmptyColumns':
      return 'Remove empty columns'
    case 'trimWhitespace':
      return `Remove extra spaces in ${list(step.params.columns)}${step.params.collapseSpaces ? ' (including double spaces inside)' : ''}`
    case 'cleanHeaders':
      return {
        tidy: 'Tidy column names (remove extra spaces)',
        title: 'Standardize column names to Title Case',
        snake: 'Standardize column names to lower_case_with_underscores',
        lower: 'Standardize column names to lowercase',
      }[step.params.style]
    case 'replaceMissing': {
      const p = step.params
      const what = [p.includeBlank && 'empty cells', p.placeholders.length && p.placeholders.map((x) => `"${x}"`).join(', ')]
        .filter(Boolean)
        .join(' and ')
      return p.replaceWith === '' ? `Make ${what} empty in ${list(p.columns)}` : `Replace ${what} with "${p.replaceWith}" in ${list(p.columns)}`
    }
    case 'changeCase':
      return `Change "${step.params.column}" to ${{ title: 'Title Case', upper: 'UPPERCASE', lower: 'lowercase', sentence: 'Sentence case' }[step.params.mode]}`
    case 'mergeValues': {
      const n = step.params.groups.length
      return `Combine similar values in "${step.params.column}" (${n} group${n === 1 ? '' : 's'})`
    }
    case 'formatDates':
      return `Change dates in "${step.params.column}" to ${step.params.output} (reading them as ${
        { MDY: 'month/day/year', DMY: 'day/month/year', YMD: 'year-month-day' }[step.params.order]
      })`
    case 'cleanNumbers':
      return `Turn "${step.params.column}" into plain numbers (decimal mark "${step.params.decimal}")`
    case 'formatPhones':
      return `Format phone numbers in "${step.params.column}" as ${
        { E164: '+15550100100', INTERNATIONAL: 'international', NATIONAL: 'national' }[step.params.format]
      } (country: ${step.params.country})`
    case 'lowercaseEmails':
      return `Make emails in "${step.params.column}" lowercase`
    case 'addCheckColumn':
      return `Add a column that marks problems in "${step.params.column}" (${step.params.check} check)`
    case 'findReplace': {
      const p = step.params
      return p.wholeCell
        ? `Replace cells that are exactly "${p.find}" with "${p.replace}" in ${list(p.columns)}`
        : `Replace "${p.find}" with "${p.replace}" in ${list(p.columns)}`
    }
    case 'renameColumn':
      return `Rename "${step.params.column}" to "${step.params.to}"`
    case 'removeColumn':
      return `Remove the column "${step.params.column}"`
  }
}
