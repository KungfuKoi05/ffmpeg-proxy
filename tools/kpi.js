'use strict';

// Renders KPI_DASHBOARD.md from the JSON sources. Unmeasured metrics print as such -
// this dashboard never estimates into a KPI slot.
// Usage: node tools/kpi.js

const { readJSON, writeDoc, money, pct, measured, table, stamp } = require('./lib');

const BAR_WIDTH = 40;

function progressBar(current, target) {
  const ratio = Math.max(0, Math.min(1, current / target));
  const filled = Math.round(ratio * BAR_WIDTH);
  return `\`[${'#'.repeat(filled)}${'.'.repeat(BAR_WIDTH - filled)}]\` **${(ratio * 100).toFixed(1)}%**`;
}

function main() {
  const k = readJSON('kpis.json');
  const l = readJSON('ledger.json');
  const p = readJSON('pipeline.json');

  const spent = l.entries.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  const revenue = l.entries.filter((e) => e.type === 'revenue').reduce((s, e) => s + e.amount, 0);
  const f = p.funnel;

  const ratio = (n, d) => (d ? pct(n / d) : measured(null));

  const doc = [
    '# KPI Dashboard',
    '',
    stamp(),
    '',
    `## Progress to ${money(p.target_mrr)}/month`,
    '',
    progressBar(k.revenue.mrr || 0, p.target_mrr),
    '',
    `Current MRR **${money(k.revenue.mrr || 0)}** of ${money(p.target_mrr)} target — ` +
      `gap of ${money(p.target_mrr - (k.revenue.mrr || 0))}, which is ` +
      `${Math.ceil((p.target_mrr - (k.revenue.mrr || 0)) / p.price_per_customer)} more customers at ` +
      `${money(p.price_per_customer)}/mo.`,
    '',
    '## Revenue',
    '',
    table(['Metric', 'Value'], [
      ['MRR', measured(k.revenue.mrr, money)],
      ['ARR', measured(k.revenue.mrr, (v) => money(v * 12))],
      ['Revenue this month', measured(k.revenue.this_month, money)],
      ['Revenue growth MoM', measured(k.revenue.growth_mom, pct)],
      ['Revenue to date', money(revenue)],
    ]),
    '',
    '## Customers',
    '',
    table(['Metric', 'Value'], [
      ['Leads sourced', String(k.customers.leads_sourced ?? 0)],
      ['Qualified leads', String(k.customers.qualified ?? 0)],
      ['Conversations held', String(f.conversations ?? 0)],
      ['Paying customers', String(k.customers.paying ?? 0)],
      ['Churned', String(k.customers.churned ?? 0)],
      ['Retention', measured(k.customers.retention, pct)],
    ]),
    '',
    '## Sales',
    '',
    table(['Metric', 'Value'], [
      ['Prospects contacted', String(f.prospects_contacted ?? 0)],
      ['Reply rate', ratio(f.replies, f.prospects_contacted)],
      ['Conversation booking rate', ratio(f.conversations, f.replies)],
      ['Close rate', ratio(f.customers, f.proposals)],
      ['Average deal value', measured(k.sales.avg_deal_value, money)],
      ['CAC', measured(k.sales.cac, money)],
    ]),
    '',
    '## Operations',
    '',
    table(['Metric', 'Value'], [
      ['Fulfillment time per delivery', measured(k.operations.fulfillment_minutes, (v) => `${v} min`)],
      ['Cost per customer served', measured(k.operations.cost_per_customer, money)],
      ['Gross margin', measured(k.operations.gross_margin, pct)],
      ['Automation percentage', measured(k.operations.automation_pct, pct)],
      ['Founder hours/week', measured(k.operations.founder_hours_week, (v) => `${v} hrs`)],
    ]),
    '',
    '## Capital',
    '',
    table(['Metric', 'Value'], [
      ['Starting capital', money(l.starting_capital)],
      ['Spent', money(spent)],
      ['Remaining', money(l.starting_capital - spent)],
    ]),
    '',
    '---',
    '',
    `**Current bottleneck:** ${k.bottleneck || 'not yet identified'}`,
    '',
    `**Last updated:** ${k.last_updated || 'never'}`,
    '',
    `_\`${measured(null)}\` means exactly that — no metric here is estimated, projected, or inferred._`,
    '',
  ].join('\n');

  writeDoc('business/KPI_DASHBOARD.md', doc);

  console.log(`MRR ${money(k.revenue.mrr || 0)} / ${money(p.target_mrr)} target`);
  console.log(`Customers: ${k.customers.paying ?? 0} paying, ${k.customers.leads_sourced ?? 0} leads sourced`);
  console.log(`Cash remaining: ${money(l.starting_capital - spent)}`);
  console.log(`Bottleneck: ${k.bottleneck || 'not yet identified'}`);
  console.log('\nWrote business/KPI_DASHBOARD.md');
}

main();
