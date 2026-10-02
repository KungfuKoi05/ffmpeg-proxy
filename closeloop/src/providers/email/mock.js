'use strict';
module.exports = {
  name: 'mock',
  costsMoney: false,
  isConfigured: () => true,
  async send({ to, subject, body }) {
    return {
      ok: true,
      providerId: `mock_email_${Date.now().toString(36)}`,
      note: `MOCK: would email "${subject}" (${body.length} chars) to ${to}`,
    };
  },
};
