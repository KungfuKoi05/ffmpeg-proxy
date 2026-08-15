---
description: Approve a pending item from the approvals queue
---

Read `business/APPROVALS.md`. Show pending items with cost, what each unblocks, and the free
alternative that was rejected.

If the founder names an item, mark it approved with the date, then execute it and log the result. If
it involves money, record the amount in `business/data/ledger.json` and run `node tools/ledger.js`
so the remaining balance is accurate immediately.

Approval covers only the named item. It never generalizes to future spending of the same type.