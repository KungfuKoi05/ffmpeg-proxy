'use strict';
const providers = require('../providers');
const { logSystem } = require('../db');
const rules = require('../providers/ai/mock');

/**
 * Classify inbound lead text.
 *
 * Always runs the rule engine. If a paid AI provider is configured it runs too,
 * and we take its answer only when it is well-formed AND at least as confident.
 * A model error, a hallucinated label, or a low-confidence answer falls back to
 * rules rather than degrading the result. Sentinel's requirement: an AI outage
 * must never leave a lead unclassified.
 */
async function classifyLead(text) {
  const baseline = await rules.classifyLead({ text });
  const provider = providers.resolve('ai');
  if (provider.name === 'mock') return baseline;

  let result;
  try {
    result = await provider.classifyLead({ text });
  } catch (err) {
    logSystem('error', 'classify', `ai provider threw: ${err.message}`);
    return { ...baseline, fallback_from: provider.name };
  }

  if (!result || result.error) {
    logSystem('warn', 'classify', `ai provider unusable, using rules`, { error: result?.error });
    return { ...baseline, fallback_from: provider.name };
  }
  if (result.confidence < baseline.confidence) {
    return { ...baseline, note: `ai suggested ${result.label} @ ${result.confidence}` };
  }
  return result;
}

module.exports = { classifyLead };
