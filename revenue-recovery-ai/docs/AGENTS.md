# The five agents

Each is a real module in `agents/` with a system prompt, Zod input and output
schemas, a forced structured response, usage metering, and an `ai_actions` row
written on success and failure. They share `agents/base.ts`.

## Atlas — strategy (read-only)
Analyses a metrics snapshot and returns `{opportunities, risks, recommendations,
priority_actions, revenue_opportunity}`. **Given no write tools.** Its input is
built by `buildAtlasInput()`, which only reads. Tier: `primary`.

Prompt constraints: ground every claim in the supplied numbers, do not invent
metrics, say so plainly when the data is too sparse rather than padding lists.

## Mercury — prospecting
Explains an opportunity and drafts a four-message sequence (initial, two
follow-ups, breakup). **The score is computed in code**, not by the model —
`lib/prospects/scoring.ts` is deterministic and every point carries a reason.
Mercury never scrapes; prospects arrive by CSV. Outreach is drafted for human
review and never auto-sent. Tier: `primary`.

## Forge — reliability (diagnose only)
Reads recent `ai_actions` failures, audit events and usage, and returns findings
with severities and recommended fixes. Applies nothing, deploys nothing. Returns
`healthy` with an empty list rather than manufacturing findings. Tier: `fast`.

## Nova — copy
Structured marketing and sales copy on request. Uses only supplied proof points;
inventing a statistic, testimonial or result is forbidden. Deliberately not a
scheduled content pipeline. Tier: `primary`.

## Sentinel — QA and safety
Re-reads a conversation and classifies it `SAFE` / `NEEDS_HUMAN` / `HIGH_VALUE` /
`RISK` / `SPAM`, flags hallucinations (any invented price, availability, policy
or technician commitment), and lists missing lead information.
`reviewConversation()` persists the classification and escalates on
`NEEDS_HUMAN` or `RISK`. **Biased toward escalation** — under-escalating is the
expensive mistake. Tier: `fast`.

## Running them

```ts
import { buildAtlasInput, runAtlas, reviewConversation } from "@/agents";

const result = await runAtlas(businessId, await buildAtlasInput(businessId, 7));
if (result.ok) console.log(result.output.priority_actions);

await reviewConversation(businessId, conversationId);
```

Nothing schedules them yet — see the scheduling note in ARCHITECTURE.md.

## Running them offline

`AI_PROVIDER=mock` makes every agent runnable with no API key: the mock adapter
synthesises a response matching the agent's declared output schema. That is what
`tests/agents.test.ts` exercises. The stub values are shape-correct placeholders,
not plausible analysis — use it to verify wiring, never to evaluate quality.
