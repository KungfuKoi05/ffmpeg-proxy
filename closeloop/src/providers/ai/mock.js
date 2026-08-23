'use strict';

// Deterministic, rule-based classifier. This is the DEFAULT and it is not a
// throwaway: it costs nothing, never hallucinates, and on real inbound text
// it is good enough to route leads. The Anthropic provider is an upgrade for
// nuance, not a prerequisite for the product working.
const RULES = [
  { label: 'URGENT', weight: 0.95, patterns: [
    // Explicit distress language.
    /\b(emergency|urgent|asap|right now|right away|today if possible|flooding|flooded|burst|sparking|smoke|gas smell|carbon monoxide)\b/i,
    // "no heat", "no hot water", "no a/c" - habitability failures.
    /\bno (heat|heating|hot water|cooling|air|a\/?c|power)\b/i,
    // Equipment down. "my furnace is out", "the AC died", "system stopped working".
    /\b(furnace|boiler|heater|heat|a\/?c|ac|air ?conditioner?|unit|system|water heater)\b[^.!?]{0,20}\b(is |are |has |'?s )?(out|down|dead|died|broken|quit|stopped working|not working|won'?t (start|turn on|kick on|come on)|blowing (cold|hot))\b/i,
    // An indoor temperature complaint is by definition a habitability issue.
    /\b\d{2,3}\s*(degrees|deg|f\b)[^.!?]{0,20}\b(in|inside|in here|in the house|upstairs|downstairs)\b/i,
    /\b(freezing|sweltering|unbearable)\b[^.!?]{0,20}\b(in|inside|house|home)\b/i,
    // Active water damage.
    /\bleak(ing|s)?\b/i,
  ]},
  { label: 'ESTIMATE', weight: 0.9, patterns: [
    /\b(quote|estimate|bid|proposal|how much|price|pricing|cost|ballpark|what would it (cost|run))\b/i,
  ]},
  { label: 'EXISTING_CUSTOMER', weight: 0.85, patterns: [
    /\b(you (guys )?(did|installed|replaced|fixed)|last (year|month|time)|warranty|invoice|my (previous|last) (job|service)|follow.?up on my)\b/i,
  ]},
  { label: 'SERVICE_REQUEST', weight: 0.8, patterns: [
    /\b(schedule|book|appointment|come out|send someone|need (a|someone|service)|repair|install|replace|maintenance|tune.?up|service call)\b/i,
    // Symptom reports that aren't acute enough to be URGENT but are still a job.
    /\b(not responding|not working|stopped working|won'?t (work|turn on|respond)|acting up|making (a |an )?(noise|sound|grinding|rattling|banging)|grinding|rattling|smells? funny)\b/i,
  ]},
  { label: 'GENERAL_QUESTION', weight: 0.6, patterns: [
    /\b(do you|are you|can you|what (time|areas|brands)|hours|open|financing|warranty policy|question)\b/i,
  ]},
];

function classify(text) {
  const body = String(text || '').trim();
  if (!body) return { label: 'OTHER', confidence: 0.3, source: 'rules', reason: 'empty input' };

  const hits = [];
  for (const rule of RULES) {
    for (const re of rule.patterns) {
      const m = body.match(re);
      if (m) { hits.push({ label: rule.label, weight: rule.weight, matched: m[0] }); break; }
    }
  }
  if (!hits.length) return { label: 'OTHER', confidence: 0.4, source: 'rules', reason: 'no rule matched' };

  hits.sort((a, b) => b.weight - a.weight);
  const top = hits[0];
  // Competing signals lower confidence - honest uncertainty beats false precision.
  const confidence = hits.length > 1 ? Math.max(0.5, top.weight - 0.15) : top.weight;
  return {
    label: top.label,
    confidence: Number(confidence.toFixed(2)),
    source: 'rules',
    reason: `matched "${top.matched}"${hits.length > 1 ? ` (${hits.length} categories matched)` : ''}`,
  };
}

module.exports = {
  name: 'mock',
  costsMoney: false,
  isConfigured: () => true,
  async classifyLead({ text }) { return classify(text); },
  // Message drafting without an LLM: return null so the caller falls back to
  // the client's configured template. Never invent content.
  async draftMessage() { return null; },
  _classify: classify,
};
