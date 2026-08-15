'use strict';

// Integrity linter. Enforces the rule that keeps this system honest:
// a [FACT] must carry a source, and structured data must parse.
// Usage: node tools/validate.js   (exits non-zero on any violation)

const fs = require('fs');
const path = require('path');
const { ROOT, DATA } = require('./lib');

const VALID_TAGS = ['FACT', 'ESTIMATE', 'ASSUMPTION', 'EXPERIMENT'];
const TAG_RE = /\[(FACT|ESTIMATE|ASSUMPTION|EXPERIMENT)(:[^\]]*)?\]/g;
const URL_RE = /https?:\/\/\S+/;

const errors = [];
const warnings = [];
let tagCount = 0;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

function checkMarkdown(file) {
  const rel = path.relative(ROOT, file);
  const lines = fs.readFileSync(file, 'utf8').split('\n');

  lines.forEach((line, i) => {
    // A tag inside inline code refers to the tag itself rather than asserting anything,
    // so strip code spans before looking for claims. This is what lets the rulebooks
    // document `[FACT: url]` without tripping the rule they describe.
    const claim = line.replace(/`[^`]*`/g, '');

    for (const match of claim.matchAll(TAG_RE)) {
      tagCount++;
      const [full, tag, rest] = match;
      const payload = (rest || '').slice(1).trim();

      if (tag === 'FACT' && !URL_RE.test(payload)) {
        errors.push(`${rel}:${i + 1}  [FACT] without a source URL -> ${full}`);
      }
      if (tag === 'ESTIMATE' && !payload) {
        errors.push(`${rel}:${i + 1}  [ESTIMATE] without stated reasoning -> ${full}`);
      }
      if (tag === 'EXPERIMENT' && !payload) {
        errors.push(`${rel}:${i + 1}  [EXPERIMENT] without an experiment ID -> ${full}`);
      }
    }
  });
}

function checkJSON() {
  if (!fs.existsSync(DATA)) return;
  for (const name of fs.readdirSync(DATA).filter((f) => f.endsWith('.json'))) {
    try {
      JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'));
    } catch (err) {
      errors.push(`business/data/${name}  invalid JSON: ${err.message}`);
    }
  }
}

function checkSecrets() {
  const env = path.join(ROOT, '.env');
  if (fs.existsSync(env)) {
    const ignored = fs.existsSync(path.join(ROOT, '.gitignore')) &&
      fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8').includes('.env');
    if (!ignored) errors.push('.env exists but is not gitignored - secrets are at risk of being committed');
  }
}

function checkLeads() {
  const leads = path.join(ROOT, 'business', 'customers', 'leads.csv');
  if (!fs.existsSync(leads)) return;

  const rows = fs.readFileSync(leads, 'utf8').trim().split('\n').slice(1);
  rows.forEach((row, i) => {
    if (!row.trim()) return;
    if (!URL_RE.test(row)) {
      warnings.push(`business/customers/leads.csv:${i + 2}  lead row has no verifiable URL`);
    }
    if (/example\.com|placeholder|TBD|john doe/i.test(row)) {
      errors.push(`business/customers/leads.csv:${i + 2}  placeholder data in a lead row - leads must be real`);
    }
  });
}

function main() {
  const businessDir = path.join(ROOT, 'business');
  const files = fs.existsSync(businessDir) ? walk(businessDir) : [];
  files.forEach(checkMarkdown);
  checkJSON();
  checkSecrets();
  checkLeads();

  console.log(`Checked ${files.length} markdown files, ${tagCount} evidence tags.`);

  if (warnings.length) {
    console.log(`\n${warnings.length} warning(s):`);
    warnings.forEach((w) => console.log(`  ! ${w}`));
  }

  if (errors.length) {
    console.error(`\n${errors.length} integrity error(s):`);
    errors.forEach((e) => console.error(`  x ${e}`));
    console.error('\nEvery [FACT] needs a URL. Unverified claims must be tagged [ASSUMPTION] instead.');
    process.exit(1);
  }

  console.log(`\nIntegrity check passed. Valid tags: ${VALID_TAGS.join(', ')}.`);
}

main();
