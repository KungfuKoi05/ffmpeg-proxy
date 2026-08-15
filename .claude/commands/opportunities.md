---
description: Show the ranked opportunity pipeline
---

Run `node tools/score.js` and read `business/data/opportunities.json` plus
`business/opportunities/RUBRIC.md`.

Print the ranked table: rank, name, industry, score, deal size, status
(`live` / `shortlist` / `killed` / `research-needed`), and the single strongest piece of evidence
for each of the top 10.

Then state: what is #1 and why, what changed since last review, which opportunities are capped by the
`[ASSUMPTION]` integrity rule and need research, and which should be killed now.

If asked to add opportunities, delegate to the `scout` agent. Never add an opportunity without at
least one evidence-tagged demand signal.