---
description: Generate the daily CEO report
---

Read `business/MASTER_PLAN.md`, `business/KPI_DASHBOARD.md`, `business/EXPERIMENT_LOG.md`,
`business/DECISION_LOG.md`, `business/data/pipeline.json`, and the most recent file in
`business/reports/`.

Write today's report to `business/reports/YYYY-MM-DD.md` and print it. Structure:

**YESTERDAY** — what actually happened, with numbers. Not what was planned.
**TODAY** — what is being worked on, by which agent.
**REVENUE** — revenue this month, MRR, change since last report.
**PIPELINE** — prospects contacted, replies, conversations booked, proposals out, customers won.
**EXPERIMENTS** — what is running, what read out, what the result was.
**LESSONS** — what we learned that changes behavior. Skip if nothing changed; do not pad.
**PROBLEMS** — what is blocking growth, ranked.
**DECISIONS NEEDED** — what requires founder approval, with the cost of waiting.
**NEXT MOVE** — the single highest-leverage action, and who owns it.

Rules: every number comes from a file, never from memory. If a day produced nothing, say so plainly —
a report that invents activity is worse than a short one. Tag any claim that is not measured.
