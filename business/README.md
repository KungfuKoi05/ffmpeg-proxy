# Business Workspace

Shared memory for the six agents. **Read before you write.** No agent re-derives what another
already found — if it is in this workspace, cite it rather than researching it again.

## Map

| File | Owner | Contains |
|---|---|---|
| `MASTER_PLAN.md` | CEO | Company state, the $10K ladder, current bottleneck, agent assignments |
| `CEO.md` | CEO | Strategic reasoning and the business model |
| `MARKET_RESEARCH.md` | Scout | Demand signals, sources, what was investigated and rejected |
| `GROWTH.md` | Growth | ICP, offer, pricing, positioning, channel strategy |
| `PRODUCT.md` | Builder | What is built, what is spec'd, what is deliberately deferred |
| `OPERATIONS.md` | Ops | Delivery, SOP index, bottlenecks, quality |
| `DECISION_LOG.md` | CEO | Every major decision, with failure criteria set in advance |
| `EXPERIMENT_LOG.md` | All | Every test, with result and resulting decision |
| `KPI_DASHBOARD.md` | CFO | Generated — do not hand-edit |
| `BUDGET.md` | CFO | Generated — do not hand-edit |
| `AUTONOMY.md` | Founder | What agents may and may not do |
| `APPROVALS.md` | All | The queue of things waiting on the founder |

## Directories

`research/` deep dives and competitor pricing · `opportunities/` rubric and ranked list ·
`strategy/` · `customers/` lead lists and customer records · `sales/` sequences, scripts, objections ·
`marketing/` landing copy and launch plan · `product/` specs · `automation/` runbooks ·
`operations/` defect log · `analytics/` economics and models · `experiments/` designs ·
`reports/` daily CEO reports · `sops/` standard operating procedures · `decisions/` supporting
material for decision log entries · `data/` the JSON the tools read

## Generated files — never hand-edit

`KPI_DASHBOARD.md`, `BUDGET.md`, `opportunities/RANKED.md`, `analytics/acquisition-model.md`.

Edit the JSON in `data/` and re-run the tool:

```bash
node tools/score.js      # rank opportunities        -> opportunities/RANKED.md
node tools/pipeline.js   # funnel + capacity math    -> analytics/acquisition-model.md
node tools/ledger.js     # capital position          -> BUDGET.md
node tools/kpi.js        # the dashboard             -> KPI_DASHBOARD.md
node tools/validate.js   # integrity check           -> exits non-zero on violations
```

No `npm install` is needed. These use the Node standard library only.

## The evidence rule

Every factual claim in this workspace carries a tag:

- `[FACT: https://…]` — externally verifiable, source attached
- `[ESTIMATE: reasoning]` — derived, with the derivation shown
- `[ASSUMPTION]` — believed, unverified, and honestly labeled
- `[EXPERIMENT: E-00X]` — measured by us

`node tools/validate.js` fails if a `[FACT]` has no URL. Fabricating a customer, a testimonial, a
revenue figure, or a market size is prohibited outright — it is the one error that destroys the
usefulness of everything else here.

## Operating loop

```
research → hypothesis → cheap test → acquire → deliver → measure → learn → automate → scale
```

The founder's interface is the slash commands in `.claude/commands/` — start with `/status`.
