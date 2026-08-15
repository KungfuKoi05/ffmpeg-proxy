---
description: Full company status - business, revenue, cash, bottleneck, agent activity, next 5 actions
---

Read `business/MASTER_PLAN.md`, `business/KPI_DASHBOARD.md`, `business/data/ledger.json`,
`business/data/pipeline.json`, `business/APPROVALS.md`, and `business/EXPERIMENT_LOG.md`.

Run `node tools/kpi.js` and `node tools/ledger.js` first so the numbers are current, not remembered.

Then report exactly this, concisely — no preamble:

**COMPANY STATUS**
- Current business (and stage: discovery / validation / launch / operate)
- Revenue this month, MRR
- Customers: active, in pipeline, churned
- Cash: starting / spent / remaining
- **Current bottleneck** — exactly one, the thing most limiting growth right now
- Current running experiment (ID + what it tests + when it reads out)
- Biggest opportunity
- Biggest risk
- What each of the six agents is working on
- **Next 5 actions**, ordered by leverage, each marked `[agent]` or `[FOUNDER]`
- Progress to $10,000/month, as a percentage and as a one-line explanation of the gap

If anything is waiting on the founder, list it under **NEEDS YOU** at the top with the cost of delay.
Never report a number you did not read from a file. If a metric is unmeasured, print `not yet measured`.
