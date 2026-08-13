# Experiment Log

Success and failure criteria are set **before** an experiment starts. Every experiment ends in a
decision, not an observation.

---

## E-001 — Cold outreach to management company owners
**Status:** ready to run · blocked on A-001 (founder must send)

| Field | Value |
|---|---|
| **Hypothesis** | Independent CAM company owners will reply to a personalized cold email offering free, finished minutes from a recording they already have |
| **Variable** | Whether the offer of completed free work generates replies |
| **Control** | None — this is the baseline measurement for everything downstream |
| **Test** | 40 hand-sent emails to Tier-A prospects in `customers/leads.csv`, 5 touches over 18 days per `sales/sequence.md` |
| **Cost** | $0 · ~4 founder-hours |
| **Start** | pending founder |
| **End** | 18 days after batch 1 |
| **Success** | ≥4 replies (10%), ≥2 sample requests, ≥1 paid engagement within 30 days |
| **Failure** | <2 replies from 40 → revise the message once, resend to 40 more. 0 paid after 80 sends and 2 revisions → kill, promote OPP-01 |
| **Result** | _pending_ |
| **Decision** | _pending_ |

**The real question this answers is not the reply rate.** It is E-002 below, which rides along inside
it and can kill the entire business model regardless of how well the email performs.

---

## E-002 — Do HOA boards actually record their meetings?
**Status:** ready to run · rides along inside E-001

| Field | Value |
|---|---|
| **Hypothesis** | At least half of management companies have boards that already record, or would agree to |
| **Variable** | None — this is a measurement, not a test |
| **Control** | n/a |
| **Test** | Track the objection reason on every reply and call from E-001. `sales/objections.md` scripts the question |
| **Cost** | $0 — no additional work beyond logging |
| **Start** | with E-001 |
| **End** | with E-001 |
| **Success** | ≥50% of respondents record today or are open to it |
| **Failure** | **≥50% say no board will record → the delivery model is broken, not the message.** Kill D-001 and promote OPP-01 |
| **Result** | _pending_ |
| **Decision** | _pending_ |

**This is the highest-information experiment in the company and it costs nothing to run.** It is the
one assumption that no amount of message iteration can rescue: if the input does not exist, there is
no service. It is separated from E-001 deliberately, so that a poor reply rate is not misread as a
broken model, and a broken model is not misread as a fixable message.

---

## E-003 — Manual delivery time
**Status:** ready to run · triggers on the first sample request

| Field | Value |
|---|---|
| **Hypothesis** | A complete set of board-ready minutes can be produced in under 90 minutes of founder time, entirely by hand |
| **Variable** | Actual minutes spent per step in SOP-001 |
| **Control** | The 90-minute budget from `analytics/unit-economics.md` |
| **Test** | Time every step of the first three deliveries |
| **Cost** | $0 · up to 4.5 founder-hours |
| **Start** | first sample request |
| **End** | after 3 deliveries |
| **Success** | ≤90 min manual, with a visible path to 45 |
| **Failure** | >90 min with no obvious automation candidate → margin does not exist at $79. Reprice to $120–150 or kill |
| **Result** | _pending_ |
| **Decision** | _pending_ |

Determines whether this is a business or an expensive hobby. At 90 minutes the gross margin is 3%
— the first delivery is bought as information, not as profit.

---

## Queued, not yet designed

- **E-004** Price test: $79 vs $120 per meeting, once 10+ conversations have happened
- **E-005** Subject line: "minutes for [Company]'s board meetings" vs a question-form opener
- **E-006** Free-two-meetings vs a single paid trial at $39
- **E-007** Whether the action-item list, rather than the minutes, is the part they actually value
