'use strict';
// Mock SMS provider. Costs nothing, transmits nothing, always succeeds.
// This is the default so that a fresh checkout can never spend money or
// message a real person.
module.exports = {
  name: 'mock',
  costsMoney: false,
  isConfigured: () => true,
  async send({ to, body }) {
    return {
      ok: true,
      providerId: `mock_sms_${Date.now().toString(36)}`,
      note: `MOCK: would send ${body.length} chars to ${to}`,
    };
  },
};
