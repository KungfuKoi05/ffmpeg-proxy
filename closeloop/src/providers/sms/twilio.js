'use strict';
const { config } = require('../../config');

// Twilio SMS. PAID: ~$1.15/mo per number, ~$0.0079 per outbound segment (US).
// Never reached unless SMS_PROVIDER=twilio AND credentials are present AND
// the effective automation mode is LIVE. See providers/index.js.
module.exports = {
  name: 'twilio',
  costsMoney: true,
  isConfigured: () =>
    Boolean(config.twilio.accountSid && config.twilio.authToken && config.twilio.from),
  async send({ to, body }) {
    const { accountSid, authToken, from } = config.twilio;
    if (!this.isConfigured()) return { ok: false, error: 'twilio_not_configured' };

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: `twilio_${res.status}: ${json.message || 'unknown'}` };
      }
      return { ok: true, providerId: json.sid };
    } catch (err) {
      return { ok: false, error: `twilio_network: ${err.message}` };
    }
  },
};
