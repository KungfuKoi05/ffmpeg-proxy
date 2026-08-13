'use strict';

// Capital ledger: every dollar in and out, and the balance that gates all spending.
// Usage: node tools/ledger.js

const { readJSON, writeDoc, money, table, stamp } = require('./lib');

function main() {
  const l = readJSON('ledger.json');

  const expenses = l.entries.filter((e) => e.type === 'expense');
  const revenue = l.entries.filter((e) => e.type === 'revenue');

  const spent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const earned = revenue.reduce((sum, e) => sum + e.amount, 0);
  const remaining = l.starting_capital - spent;
  const profit = earned - spent;

  const unapproved = expenses.filter((e) => !e.approved_by);
  if (unapproved.length) {
    console.error(`INTEGRITY FAILURE: ${unapproved.length} expense(s) recorded without an approver.`);
    unapproved.forEach((e) => console.error(`  ${e.date} ${money(e.amount)} ${e.description}`));
    process.exitCode = 1;
  }

  const rows = l.entries.length
    ? l.entries.map((e) => [
        e.date,
        e.type,
        (e.type === 'expense' ? '-' : '+') + money(e.amount),
        e.description,
        e.approved_by || '**UNAPPROVED**',
      ])
    : [];

  const doc = [
    '# Capital Ledger',
    '',
    stamp(),
    '',
    table(['Metric', 'Amount'], [
      ['Starting capital', money(l.starting_capital)],
      ['Money spent', money(spent)],
      ['**Money remaining**', `**${money(remaining)}**`],
      ['Revenue', money(earned)],
      ['Profit', money(profit)],
    ]),
    '',
    `**Spend authorization:** ${l.spend_policy}`,
    '',
    '## Entries',
    '',
    table(['Date', 'Type', 'Amount', 'Description', 'Approved by'], rows),
    '',
    l.entries.length
      ? ''
      : '_No money has moved. Every dollar of the $100 is intact, as intended — the launch runs on ' +
        'free tiers until a customer pays._',
    '',
  ].join('\n');

  writeDoc('business/BUDGET.md', doc);

  console.log(`Starting ${money(l.starting_capital)} | Spent ${money(spent)} | Remaining ${money(remaining)}`);
  console.log(`Revenue ${money(earned)} | Profit ${money(profit)}`);
  console.log(`Policy: ${l.spend_policy}`);
  console.log('\nWrote business/BUDGET.md');
}

main();
