'use strict';
const { config } = require('../config');
const { logSystem } = require('../db');

const REGISTRY = {
  sms:   { mock: require('./sms/mock'),   twilio: require('./sms/twilio') },
  email: { mock: require('./email/mock'), smtp:   require('./email/smtp') },
  ai:    { mock: require('./ai/mock'),    anthropic: require('./ai/anthropic') },
};

/**
 * Resolve a provider for a kind, degrading to mock rather than failing.
 *
 * The degradation is deliberate. A misconfigured paid provider should quietly
 * become a no-op that we can see in the logs, not a crash loop and not a
 * silent gap in follow-up.
 */
function resolve(kind, requested = null) {
  const family = REGISTRY[kind];
  if (!family) throw new Error(`unknown provider kind: ${kind}`);

  const wanted = requested || config.providers[kind] || 'mock';
  const provider = family[wanted];

  if (!provider) {
    logSystem('warn', 'providers', `unknown ${kind} provider "${wanted}", using mock`);
    return family.mock;
  }
  if (!provider.isConfigured()) {
    logSystem('warn', 'providers',
      `${kind} provider "${wanted}" selected but not configured, using mock`);
    return family.mock;
  }
  return provider;
}

/**
 * THE SPEND GATE.
 *
 * A provider that costs money may only transmit when the effective automation
 * mode is LIVE. In OFF/TEST/ASSISTED a paid provider is swapped for its mock.
 *
 * This is the single choke point every outbound message passes through, and
 * it is enforced here rather than at call sites so that a new caller cannot
 * forget it. `outbox.js` additionally refuses to reach this function at all
 * unless the message has been approved, but defence in depth is cheap.
 */
function resolveForSend(kind, mode, requested = null) {
  const provider = resolve(kind, requested);
  if (provider.costsMoney && mode !== 'LIVE') {
    return { provider: REGISTRY[kind].mock, downgradedFrom: provider.name, reason: `mode_${mode}` };
  }
  return { provider, downgradedFrom: null, reason: null };
}

/** What the operator sees on /admin: what is wired up and what it costs. */
function status() {
  const out = {};
  for (const kind of Object.keys(REGISTRY)) {
    const wanted = config.providers[kind] || 'mock';
    const provider = REGISTRY[kind][wanted];
    out[kind] = {
      requested: wanted,
      available: Boolean(provider),
      configured: provider ? provider.isConfigured() : false,
      costsMoney: provider ? Boolean(provider.costsMoney) : false,
      effective: resolve(kind).name,
    };
  }
  return out;
}

module.exports = { resolve, resolveForSend, status, REGISTRY };
