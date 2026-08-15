'use strict';

// Funnel math: measured conversion where we have it, assumptions clearly labeled where we do not,
// and the outreach volume required to reach the revenue target - checked against founder capacity.
// Usage: node tools/pipeline.js

const { readJSON, writeDoc, money, pct, table, stamp } = require('./lib');

// A rate is only "measured" once its denominator is large enough to mean anything.
const MIN_SAMPLE = 20;

function rate(numerator, denominator) {
  if (!denominator || denominator < MIN_SAMPLE) return null;
  return numerator / denominator;
}

function main() {
  const p = readJSON('pipeline.json');
  const f = p.funnel;
  const a = p.assumed_rates;

  const stages = [
    ['Reply rate', rate(f.replies, f.prospects_contacted), a.reply_rate, `${f.replies}/${f.prospects_contacted}`],
    ['Reply -> conversation', rate(f.conversations, f.replies), a.conversation_rate, `${f.conversations}/${f.replies}`],
    ['Conversation -> proposal', rate(f.proposals, f.conversations), a.proposal_rate, `${f.proposals}/${f.conversations}`],
    ['Proposal -> customer', rate(f.customers, f.proposals), a.close_rate, `${f.customers}/${f.proposals}`],
  ];

  const effective = stages.map(([, m, assumed]) => (m === null ? assumed : m));
  const endToEnd = effective.reduce((acc, r) => acc * r, 1);

  const customersNeeded = Math.ceil(p.target_mrr / p.price_per_customer);
  const prospectsNeeded = Math.ceil(customersNeeded / endToEnd);

  // Founder capacity check - the constraint that actually decides whether a plan is real.
  const weeklyCapacityMinutes = p.founder_hours_per_week * 60 * (p.share_of_time_on_outreach ?? 0.5);
  const touchesPerWeek = Math.floor(weeklyCapacityMinutes / p.minutes_per_touch);
  const weeksToTarget = touchesPerWeek > 0 ? Math.ceil(prospectsNeeded / touchesPerWeek) : Infinity;

  const rateRows = stages.map(([name, m, assumed, sample]) => [
    name,
    m === null ? '_unmeasured_' : `**${pct(m)}**`,
    pct(assumed),
    m === null ? `${sample} (need ${MIN_SAMPLE}+)` : sample,
    m === null ? '`[ASSUMPTION]`' : '`[EXPERIMENT]`',
  ]);

  const anyMeasured = stages.some(([, m]) => m !== null);

  const doc = [
    '# Acquisition Model',
    '',
    stamp(),
    '',
    '## Conversion rates',
    '',
    table(['Stage', 'Measured', 'Assumed', 'Sample', 'Basis'], rateRows),
    '',
    anyMeasured
      ? '_Measured rates override assumptions above._'
      : '_Nothing measured yet. Every number below rests on `[ASSUMPTION]` and exists to be falsified,' +
        ' not believed. The first 50 sends replace the top row with fact._',
    '',
    '## Path to target',
    '',
    table(['Quantity', 'Value'], [
      ['Target MRR', money(p.target_mrr)],
      ['Price per customer', `${money(p.price_per_customer)}/mo`],
      ['Customers needed', String(customersNeeded)],
      ['End-to-end conversion', pct(endToEnd)],
      ['Prospects to contact', String(prospectsNeeded)],
      ['Founder hours/week', String(p.founder_hours_per_week)],
      ['Minutes per personalized touch', String(p.minutes_per_touch)],
      ['Sustainable touches/week', String(touchesPerWeek)],
      ['Weeks of outreach at that rate', Number.isFinite(weeksToTarget) ? String(weeksToTarget) : 'never'],
    ]),
    '',
    '## Capacity verdict',
    '',
    Number.isFinite(weeksToTarget) && weeksToTarget <= 26
      ? `**Feasible.** ${prospectsNeeded} prospects at ${touchesPerWeek}/week reaches the target in ` +
        `~${weeksToTarget} weeks inside the founder's ${p.founder_hours_per_week} hrs/week.`
      : `**Not feasible as configured.** ${prospectsNeeded} prospects at ${touchesPerWeek}/week takes ` +
        `${weeksToTarget} weeks. Do not fix this with volume the founder cannot produce — raise the ` +
        `price, narrow the niche, or improve reply rate.`,
    '',
    `_Sensitivity: at half the assumed reply rate, prospects needed doubles to ` +
      `${prospectsNeeded * 2} and the timeline doubles with it. Price is the lever that fixes this, not effort._`,
    '',
  ].join('\n');

  writeDoc('business/analytics/acquisition-model.md', doc);

  console.log(`End-to-end conversion: ${pct(endToEnd)}${anyMeasured ? '' : ' (all assumed)'}`);
  console.log(`Customers needed: ${customersNeeded} at ${money(p.price_per_customer)}/mo`);
  console.log(`Prospects to contact: ${prospectsNeeded}`);
  console.log(`Sustainable touches/week: ${touchesPerWeek} -> ~${weeksToTarget} weeks`);
  console.log('\nWrote business/analytics/acquisition-model.md');
}

main();
