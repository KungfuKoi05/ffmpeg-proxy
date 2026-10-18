import { describe, expect, it } from 'vitest'
import { ActionError, runStep, styleHeader } from './actions'
import type { Step } from './types'
import { freeze, grid, tableOf } from './test-helpers'

const run = (csv: string, step: Step) => {
  const t = freeze(tableOf(csv))
  const r = runStep(t, step)
  return { before: t, ...r }
}

describe('removing duplicate rows', () => {
  const csv = 'id,name\n1,Ada\n2,Grace\n1,Ada\n3,Linus\n1,Ada\n'

  it('removes exact copies and keeps the first', () => {
    const r = run(csv, { action: 'removeDuplicates', params: { columns: [], ignoreCase: false, ignoreSpaces: false, keep: 'first' } })
    expect(r.table.rows.map((x) => x.id)).toEqual([1, 2, 4])
    expect(r.affected).toBe(2)
    expect(r.changes.removedRows.map((x) => x.note)).toEqual(['same as row 1', 'same as row 1'])
  })

  it('can keep the last copy instead', () => {
    const r = run(csv, { action: 'removeDuplicates', params: { columns: [], ignoreCase: false, ignoreSpaces: false, keep: 'last' } })
    expect(r.table.rows.map((x) => x.id)).toEqual([2, 4, 5])
  })

  it('compares only the chosen columns', () => {
    const r = run('email,name\na@x.com,Ada\nb@x.com,Bob\na@x.com,Ada L.\n', {
      action: 'removeDuplicates',
      params: { columns: ['email'], ignoreCase: false, ignoreSpaces: false, keep: 'first' },
    })
    expect(r.table.rows.map((x) => x.cells[1])).toEqual(['Ada', 'Bob'])
    expect(r.changes.removedRows[0].cells).toEqual(['a@x.com', 'Ada L.'])
  })

  it('can ignore capitals and spaces when comparing', () => {
    const step: Step = { action: 'removeDuplicates', params: { columns: [], ignoreCase: true, ignoreSpaces: true, keep: 'first' } }
    const r = run('name,city\nJane Doe,Paris\n jane  doe ,PARIS\n', step)
    expect(r.table.rows).toHaveLength(1)
    const strict = run('name,city\nJane Doe,Paris\n jane  doe ,PARIS\n', {
      ...step,
      params: { ...step.params, ignoreCase: false, ignoreSpaces: false },
    } as Step)
    expect(strict.table.rows).toHaveLength(2)
  })

  it('never treats rows with an empty key as duplicates of each other', () => {
    const r = run('email,name\n,Ada\n,Bob\n', {
      action: 'removeDuplicates',
      params: { columns: ['email'], ignoreCase: false, ignoreSpaces: false, keep: 'first' },
    })
    expect(r.table.rows).toHaveLength(2)
  })

  it('returns the same table when there is nothing to remove', () => {
    const r = run('a\n1\n2\n', { action: 'removeDuplicates', params: { columns: [], ignoreCase: false, ignoreSpaces: false, keep: 'first' } })
    expect(r.table).toBe(r.before)
    expect(r.summary).toMatch(/No duplicate/)
  })
})

describe('whitespace', () => {
  it('trims the edges of every cell but keeps spaces inside', () => {
    const r = run('name,city\n"  JOHN SMITH  ",New  York\n', {
      action: 'trimWhitespace',
      params: { columns: [], collapseSpaces: false },
    })
    expect(r.table.rows[0].cells).toEqual(['JOHN SMITH', 'New  York'])
    expect(r.changes.cells).toEqual([{ rowId: 1, column: 'name', before: '  JOHN SMITH  ', after: 'JOHN SMITH' }])
  })

  it('squeezes double spaces only when asked', () => {
    const r = run('city\nNew  York\n', { action: 'trimWhitespace', params: { columns: [], collapseSpaces: true } })
    expect(r.table.rows[0].cells).toEqual(['New York'])
  })

  it('keeps line breaks inside cells', () => {
    const r = run('addr\n" 1 Main St\nApt 2 "\n', { action: 'trimWhitespace', params: { columns: [], collapseSpaces: true } })
    expect(r.table.rows[0].cells[0]).toBe('1 Main St\nApt 2')
  })

  it('shares unchanged rows with the previous table (no full copy)', () => {
    const r = run('a\nx\n y \nz\n', { action: 'trimWhitespace', params: { columns: [], collapseSpaces: false } })
    expect(r.table.rows[0]).toBe(r.before.rows[0])
    expect(r.table.rows[1]).not.toBe(r.before.rows[1])
    expect(r.table.rows[2]).toBe(r.before.rows[2])
  })
})

describe('empty rows and columns', () => {
  it('removes rows where every cell is empty', () => {
    const r = run('a,b\n1,2\n,\n  ,\n3,4\n', { action: 'removeEmptyRows', params: {} })
    expect(r.table.rows.map((x) => x.id)).toEqual([1, 4])
    expect(r.affected).toBe(2)
  })

  it('removes columns with no values', () => {
    const r = run('a,b,c\n1,,3\n4, ,6\n', { action: 'removeEmptyColumns', params: {} })
    expect(r.table.headers).toEqual(['a', 'c'])
    expect(r.table.rows[1].cells).toEqual(['4', '6'])
  })
})

describe('column names', () => {
  it('tidies spaces', () => {
    const r = run(' First  Name ,Email \nA,b\n', { action: 'cleanHeaders', params: { style: 'tidy' } })
    expect(r.table.headers).toEqual(['First Name', 'Email'])
    expect(r.changes.headers).toHaveLength(2)
  })

  it('converts between styles', () => {
    expect(styleHeader(' first_name ', 'title')).toBe('First Name')
    expect(styleHeader('First Name', 'snake')).toBe('first_name')
    expect(styleHeader('orderID', 'snake')).toBe('order_id')
    expect(styleHeader('E-mail Address', 'snake')).toBe('e_mail_address')
    expect(styleHeader('customer SKU', 'title')).toBe('Customer SKU')
    expect(styleHeader('Prénom', 'snake')).toBe('prénom')
  })

  it('keeps names unique after restyling', () => {
    const r = run('Name,name ,NAME\n1,2,3\n', { action: 'cleanHeaders', params: { style: 'lower' } })
    expect(r.table.headers).toEqual(['name', 'name (2)', 'name (3)'])
  })

  it('renames a column and refuses duplicates or blanks', () => {
    const t = freeze(tableOf('a,b\n1,2\n'))
    expect(runStep(t, { action: 'renameColumn', params: { column: 'a', to: 'Alpha' } }).table.headers).toEqual(['Alpha', 'b'])
    expect(() => runStep(t, { action: 'renameColumn', params: { column: 'a', to: 'b' } })).toThrow(ActionError)
    expect(() => runStep(t, { action: 'renameColumn', params: { column: 'a', to: '  ' } })).toThrow(ActionError)
  })

  it('explains a missing column instead of crashing', () => {
    const t = freeze(tableOf('a\n1\n'))
    expect(() => runStep(t, { action: 'changeCase', params: { column: 'Name', mode: 'upper' } })).toThrow(/no column called "Name"/)
  })
})

describe('missing values', () => {
  it('replaces only the placeholders the user chose', () => {
    const r = run('a,b\nN/A,None\nnull,x\n,y\n', {
      action: 'replaceMissing',
      params: { columns: [], placeholders: ['N/A', 'NULL'], includeBlank: false, replaceWith: '' },
    })
    expect(grid(r.table).slice(1)).toEqual([
      ['', 'None'],
      ['', 'x'],
      ['', 'y'],
    ])
  })

  it('fills blank cells with a value', () => {
    const r = run('a,b\n,1\n  ,2\nx,3\n', {
      action: 'replaceMissing',
      params: { columns: ['a'], placeholders: [], includeBlank: true, replaceWith: 'Unknown' },
    })
    expect(r.table.rows.map((x) => x.cells[0])).toEqual(['Unknown', 'Unknown', 'x'])
  })
})

describe('capitalization', () => {
  const csv = "name\nJOHN SMITH\nmary-jane o'neil\nAlice\n"
  it('title case', () => {
    const r = run(csv, { action: 'changeCase', params: { column: 'name', mode: 'title' } })
    expect(r.table.rows.map((x) => x.cells[0])).toEqual(['John Smith', "Mary-Jane O'Neil", 'Alice'])
    expect(r.affected).toBe(2)
  })
  it('upper, lower, sentence', () => {
    expect(run(csv, { action: 'changeCase', params: { column: 'name', mode: 'upper' } }).table.rows[2].cells[0]).toBe('ALICE')
    expect(run(csv, { action: 'changeCase', params: { column: 'name', mode: 'lower' } }).table.rows[0].cells[0]).toBe('john smith')
    expect(run('t\nHELLO THERE. HOW ARE YOU\n', { action: 'changeCase', params: { column: 't', mode: 'sentence' } }).table.rows[0].cells[0]).toBe(
      'Hello there. How are you',
    )
  })
})

describe('combining similar values', () => {
  it('maps the chosen values to one name and leaves others alone', () => {
    const r = run('cat\nElectronics\nelectronics\nELECTRONICS \nToys\n', {
      action: 'mergeValues',
      params: { column: 'cat', groups: [{ from: ['electronics', 'ELECTRONICS '], to: 'Electronics' }] },
    })
    expect(r.table.rows.map((x) => x.cells[0])).toEqual(['Electronics', 'Electronics', 'Electronics', 'Toys'])
    expect(r.affected).toBe(2)
  })
})

describe('dates', () => {
  const csv = 'd\n2026-03-04\n03/14/2026\n"March 5, 2026"\n2026-02-30\nsoon\n'
  it('converts readable dates and leaves unreadable ones unchanged', () => {
    const r = run(csv, { action: 'formatDates', params: { column: 'd', order: 'MDY', output: 'YYYY-MM-DD' } })
    expect(r.table.rows.map((x) => x.cells[0])).toEqual(['2026-03-04', '2026-03-14', '2026-03-05', '2026-02-30', 'soon'])
    expect(r.skipped.map((s) => s.value)).toEqual(['2026-02-30', 'soon'])
    expect(r.summary).toMatch(/left unchanged/)
  })

  it('uses the chosen order for ambiguous dates', () => {
    const mdy = run('d\n03/04/2026\n', { action: 'formatDates', params: { column: 'd', order: 'MDY', output: 'YYYY-MM-DD' } })
    const dmy = run('d\n03/04/2026\n', { action: 'formatDates', params: { column: 'd', order: 'DMY', output: 'YYYY-MM-DD' } })
    expect(mdy.table.rows[0].cells[0]).toBe('2026-03-04')
    expect(dmy.table.rows[0].cells[0]).toBe('2026-04-03')
  })

  it('leaves dates that contradict the chosen order unchanged instead of guessing', () => {
    const r = run('d\n25/03/2026\n', { action: 'formatDates', params: { column: 'd', order: 'MDY', output: 'YYYY-MM-DD' } })
    expect(r.table.rows[0].cells[0]).toBe('25/03/2026')
    expect(r.skipped).toHaveLength(1)
  })

  it('keeps the time of day', () => {
    const r = run('d\n2026-03-04 14:30\n', { action: 'formatDates', params: { column: 'd', order: 'MDY', output: 'MMM D, YYYY' } })
    expect(r.table.rows[0].cells[0]).toBe('Mar 4, 2026 14:30')
  })
})

describe('numbers', () => {
  it('removes currency symbols and thousands separators without rounding', () => {
    const r = run('p\n"$1,234.50"\n€99\n(45.00)\n12\nabout 5\n', { action: 'cleanNumbers', params: { column: 'p', decimal: '.' } })
    expect(r.table.rows.map((x) => x.cells[0])).toEqual(['1234.50', '99', '-45.00', '12', 'about 5'])
    expect(r.skipped.map((s) => s.value)).toEqual(['about 5'])
  })

  it('reads comma decimals when told to', () => {
    const r = run('p\n"1.234,56 €"\n"12,5"\n', { action: 'cleanNumbers', params: { column: 'p', decimal: ',' } })
    expect(r.table.rows.map((x) => x.cells[0])).toEqual(['1234.56', '12.5'])
  })

  it('keeps leading zeros', () => {
    const r = run('p\n007\n', { action: 'cleanNumbers', params: { column: 'p', decimal: '.' } })
    expect(r.table.rows[0].cells[0]).toBe('007')
  })
})

describe('phones', () => {
  it('formats readable numbers and leaves the rest alone', () => {
    const r = run('ph\n(555) 010-0101\n555.010.0102\n+44 20 7946 0958\n12\n', {
      action: 'formatPhones',
      params: { column: 'ph', country: 'US', format: 'E164' },
    })
    expect(r.table.rows.map((x) => x.cells[0])).toEqual(['+15550100101', '+15550100102', '+442079460958', '12'])
  })
})

describe('emails', () => {
  it('lowercases emails without touching other text', () => {
    const r = run('e\nAda@Example.COM\nnot an email\n', { action: 'lowercaseEmails', params: { column: 'e' } })
    expect(r.table.rows.map((x) => x.cells[0])).toEqual(['ada@example.com', 'not an email'])
  })

  it('adds a check column instead of rewriting bad emails', () => {
    const r = run('e,n\nada@example.com,1\nada@example,2\n,3\n', { action: 'addCheckColumn', params: { column: 'e', check: 'email' } })
    expect(r.table.headers).toEqual(['e', 'e check', 'n'])
    expect(r.table.rows.map((x) => x.cells[1])).toEqual(['OK', 'Problem: missing a dot in the part after @', ''])
    expect(r.table.rows[1].cells[0]).toBe('ada@example')
  })
})

describe('find and replace', () => {
  it('replaces text inside cells, case-insensitively by default', () => {
    const r = run('a\nThe Cat\ncat food\n', {
      action: 'findReplace',
      params: { columns: [], find: 'cat', replace: 'dog', matchCase: false, wholeCell: false },
    })
    expect(r.table.rows.map((x) => x.cells[0])).toEqual(['The dog', 'dog food'])
  })

  it('treats special characters literally', () => {
    const r = run('a\n$5.00 (each)\n', {
      action: 'findReplace',
      params: { columns: [], find: '(each)', replace: '', matchCase: true, wholeCell: false },
    })
    expect(r.table.rows[0].cells[0]).toBe('$5.00 ')
  })

  it('can match whole cells only', () => {
    const r = run('a\nyes\nyes please\n', {
      action: 'findReplace',
      params: { columns: [], find: 'yes', replace: 'Y', matchCase: false, wholeCell: true },
    })
    expect(r.table.rows.map((x) => x.cells[0])).toEqual(['Y', 'yes please'])
  })
})
