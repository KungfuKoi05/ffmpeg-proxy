'use strict';

// Scores every opportunity against the rubric and writes the ranked list.
// Usage: node tools/score.js

const { readJSON, writeDoc, table, stamp } = require('./lib');

const KILL_THRESHOLD = 60;
const ASSUMPTION_SHARE_CAP = 0.4; // >40% of earned points from [ASSUMPTION] -> capped
const CAPPED_MAX = 70;

function scoreOne(opp, weights) {
  let earned = 0;
  let assumed = 0;
  const missing = [];

  for (const [factor, weight] of Object.entries(weights)) {
    const cell = opp.scores && opp.scores[factor];
    if (!cell) {
      missing.push(factor);
      continue;
    }
    const points = Math.max(0, Math.min(1, Number(cell.raw))) * weight;
    earned += points;
    if (String(cell.tag).toUpperCase() === 'ASSUMPTION') assumed += points;
  }

  const raw = Math.round(earned * 10) / 10;
  const assumptionShare = earned > 0 ? assumed / earned : 0;
  const capped = assumptionShare > ASSUMPTION_SHARE_CAP && raw > CAPPED_MAX;

  return {
    raw,
    total: capped ? CAPPED_MAX : raw,
    capped,
    assumptionShare,
    missing,
    killed: Boolean(opp.kill_flags && opp.kill_flags.length),
  };
}

function main() {
  const db = readJSON('opportunities.json');
  const weights = db.weights;

  const weightTotal = Object.values(weights).reduce((a, b) => a + b, 0);
  if (weightTotal !== 100) {
    console.error(`Rubric weights sum to ${weightTotal}, expected 100. Fix business/data/opportunities.json.`);
    process.exit(1);
  }

  const scored = db.opportunities
    .map((opp) => ({ ...opp, result: scoreOne(opp, weights) }))
    .sort((a, b) => b.result.total - a.result.total);

  const rows = scored.map((o, i) => {
    const r = o.result;
    const flags = [
      r.killed ? 'KILLED' : '',
      r.capped ? 'capped (assumption-heavy)' : '',
      r.missing.length ? `missing: ${r.missing.length}` : '',
    ].filter(Boolean).join('; ');

    return [
      String(i + 1),
      o.id,
      o.name,
      o.industry,
      r.killed ? '--' : r.total.toFixed(1),
      o.price_hypothesis || '?',
      o.status,
      flags || '-',
    ];
  });

  const live = scored.filter((o) => !o.result.killed && o.result.total >= KILL_THRESHOLD);
  const below = scored.filter((o) => !o.result.killed && o.result.total < KILL_THRESHOLD);
  const killed = scored.filter((o) => o.result.killed);

  const doc = [
    '# Ranked Opportunities',
    '',
    stamp(),
    '',
    `**Scored:** ${scored.length} | **Above kill threshold (${KILL_THRESHOLD}):** ${live.length} | ` +
      `**Below threshold:** ${below.length} | **Killed on disqualifiers:** ${killed.length}`,
    '',
    table(['#', 'ID', 'Opportunity', 'Industry', 'Score', 'Price hypothesis', 'Status', 'Flags'], rows),
    '',
    '## Rubric',
    '',
    table(['Factor', 'Weight'], Object.entries(weights).map(([k, v]) => [k.replace(/_/g, ' '), String(v)])),
    '',
    `Kill threshold **${KILL_THRESHOLD}**. Opportunities drawing more than ` +
      `${ASSUMPTION_SHARE_CAP * 100}% of earned points from \`[ASSUMPTION]\` are capped at ` +
      `${CAPPED_MAX} until researched — optimism must not outrank evidence.`,
    '',
    '## Disqualified',
    '',
    killed.length
      ? killed.map((o) => `- **${o.id} ${o.name}** — ${o.kill_flags.join('; ')}`).join('\n')
      : '_None._',
    '',
  ].join('\n');

  writeDoc('business/opportunities/RANKED.md', doc);

  console.log(`Scored ${scored.length} opportunities -> business/opportunities/RANKED.md\n`);
  scored.slice(0, 10).forEach((o, i) => {
    const r = o.result;
    console.log(
      `${String(i + 1).padStart(2)}. ${(r.killed ? 'KILL' : r.total.toFixed(1)).padStart(5)}  ` +
      `${o.id}  ${o.name}${r.capped ? '  [capped]' : ''}`
    );
  });
}

main();
