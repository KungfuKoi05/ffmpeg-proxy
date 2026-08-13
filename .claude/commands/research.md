---
description: Run market research on a topic, niche, or competitor
---

Delegate to the `scout` agent. Pass it: the topic, what decision the research must inform, and what
we already know (point it at the relevant file in `business/research/` so it does not start cold).

Require of the output: public sources only, a URL behind every `[FACT]`, competitor pricing captured
verbatim where it exists, and disconfirming evidence reported alongside confirming evidence.

Findings go to `business/research/<slug>.md`, with the headline conclusion appended to
`business/MARKET_RESEARCH.md`. Rescore the affected opportunities afterward.