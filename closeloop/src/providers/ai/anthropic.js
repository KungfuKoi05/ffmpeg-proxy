'use strict';
const { config } = require('../../config');

// Anthropic classification. PAID per token (Haiku is ~$1/MTok in as of writing,
// so a lead classification costs a small fraction of a cent). Only used when
// AI_PROVIDER=anthropic and a key is present; otherwise we fall back to rules.
const VALID = ['SERVICE_REQUEST', 'ESTIMATE', 'URGENT', 'GENERAL_QUESTION',
               'EXISTING_CUSTOMER', 'OTHER'];

const SYSTEM = `You classify inbound messages to a home-services contractor.
Reply with ONLY a JSON object, no prose:
{"label": one of ${VALID.join('|')}, "confidence": 0-1, "reason": "<12 words"}
Rules:
- URGENT means a same-day safety or habitability issue (no heat, flooding, gas, sparking).
- ESTIMATE means they are asking what something costs or want a quote.
- EXISTING_CUSTOMER means they reference prior work with this business.
- If genuinely unclear, use OTHER with confidence below 0.5. Do not guess.`;

module.exports = {
  name: 'anthropic',
  costsMoney: true,
  isConfigured: () => Boolean(config.anthropic.apiKey),

  async classifyLead({ text }) {
    if (!this.isConfigured()) return null;
    try {
      const res = await fetch(`${config.anthropic.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': config.anthropic.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: config.anthropic.model,
          max_tokens: 200,
          system: SYSTEM,
          messages: [{ role: 'user', content: String(text || '').slice(0, 4000) }],
        }),
      });
      if (!res.ok) return { error: `anthropic_${res.status}` };
      const json = await res.json();
      const raw = json?.content?.[0]?.text?.trim() || '';
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return { error: 'anthropic_unparseable' };
      const parsed = JSON.parse(match[0]);

      // Guard against hallucinated labels. If the model returns something
      // outside the enum we refuse it rather than storing garbage.
      if (!VALID.includes(parsed.label)) return { error: `anthropic_bad_label:${parsed.label}` };
      const confidence = Number(parsed.confidence);
      return {
        label: parsed.label,
        confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0.5,
        source: 'anthropic',
        reason: String(parsed.reason || '').slice(0, 120),
      };
    } catch (err) {
      return { error: `anthropic_network: ${err.message}` };
    }
  },

  async draftMessage() { return null; },
};
