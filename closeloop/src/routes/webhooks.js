'use strict';
const crypto = require('node:crypto');
const db = require('../db');
const { config } = require('../config');
const H = require('../lib/http');
const leads = require('../domain/leads');
const sequences = require('../domain/sequences');

/**
 * Shared-secret check for inbound webhooks.
 *
 * If WEBHOOK_SECRET is unset the endpoints are open, which is fine on
 * localhost and NOT fine in production - deployment.md calls this out and
 * /api/me surfaces it as a warning.
 */
function verify(req, url) {
  if (!config.webhookSecret) return { ok: true, unverified: true };
  const provided = req.headers['x-closeloop-secret'] || url.searchParams.get('secret') || '';
  const expected = config.webhookSecret;
  if (provided.length !== expected.length) return { ok: false };
  const match = crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  return { ok: match };
}

function register(router) {
  /**
   * Missed call. The highest-value event in the system.
   *
   * Body: { client_id, from, to?, duration?, at? }
   * Wire this to a telephony provider's "call completed / no answer" webhook,
   * or POST it from anything that can detect a missed call.
   */
  router.post('/webhooks/missed-call', async (req, res, ctx) => {
    const auth = verify(req, ctx.url);
    if (!auth.ok) return H.unauthorized(res, 'bad webhook secret');
    const body = await H.readBody(req);
    if (!body.client_id || !body.from) return H.badRequest(res, 'client_id and from required');
    if (!db.get('SELECT id FROM clients WHERE id = ?', body.client_id)) {
      return H.notFound(res, 'unknown client_id');
    }

    const { lead, created } = await leads.capture({
      client_id: body.client_id,
      phone: body.from,
      name: body.caller_name || null,
      source: 'missed_call',
      intent_note: body.transcript || null,
      // Calling a business is a reasonable basis for a reply to that number.
      // It is NOT marketing consent - the LIVE gate still requires consent_sms,
      // which an operator records after the customer engages.
      consent_sms: false,
    }, 'webhook');

    const enrolled = sequences.enroll({
      clientId: body.client_id, leadId: lead.id, trigger: 'missed_call',
      anchorAt: body.at || new Date().toISOString(),
    }, 'webhook');

    db.logEvent({ clientId: body.client_id, entityType: 'lead', entityId: lead.id,
                  type: 'missed_call.received', actor: 'webhook',
                  data: { from: body.from, duration: body.duration } });

    return H.created(res, { lead_id: lead.id, created, enrolled, unverified: auth.unverified });
  });

  /** Website / landing-page form submission. */
  router.post('/webhooks/lead', async (req, res, ctx) => {
    const auth = verify(req, ctx.url);
    if (!auth.ok) return H.unauthorized(res, 'bad webhook secret');
    const body = await H.readBody(req);
    if (!body.client_id) return H.badRequest(res, 'client_id required');
    if (!body.phone && !body.email) return H.badRequest(res, 'phone or email required');

    const { lead, created, classification } = await leads.capture({
      client_id: body.client_id,
      name: body.name, phone: body.phone, email: body.email,
      source: body.source || 'web_form',
      intent_note: body.message || body.intent,
      estimated_value: body.estimated_value,
      // A form with a visible consent checkbox is a valid consent record.
      consent_sms: Boolean(body.consent_sms),
      consent_source: body.consent_sms ? (body.consent_source || 'web_form_checkbox') : null,
    }, 'webhook');

    const enrolled = created
      ? sequences.enroll({ clientId: body.client_id, leadId: lead.id, trigger: 'new_lead' }, 'webhook')
      : { enrolled: false, reason: 'existing_lead' };

    return H.created(res, { lead_id: lead.id, created, classification, enrolled, unverified: auth.unverified });
  });

  /**
   * Inbound SMS reply. Also the STOP handler - leads.recordResponse honours
   * opt-out before anything else touches the lead.
   */
  router.post('/webhooks/sms-reply', async (req, res, ctx) => {
    const auth = verify(req, ctx.url);
    if (!auth.ok) return H.unauthorized(res, 'bad webhook secret');
    const body = await H.readBody(req);
    // Twilio posts From/Body; support both casings so the same endpoint works
    // for Twilio and for a generic sender.
    const from = body.from || body.From;
    const text = body.body || body.Body;
    if (!from || !text) return H.badRequest(res, 'from and body required');

    const key = String(from).replace(/\D/g, '').slice(-10);
    const lead = db.get(
      `SELECT * FROM leads
        WHERE REPLACE(REPLACE(REPLACE(REPLACE(phone,'-',''),' ',''),'(',''),')','') LIKE ?
        ORDER BY updated_at DESC LIMIT 1`, `%${key}`);
    if (!lead) {
      db.logSystem('warn', 'webhook', 'inbound SMS from unknown number', { last10: key });
      return H.ok(res, { matched: false });
    }

    const result = await leads.recordResponse(
      { leadId: lead.id, channel: 'sms', body: text, from }, 'webhook');
    return H.ok(res, { matched: true, lead_id: lead.id, opted_out: result.optedOut,
                       classification: result.classification });
  });

  /** Job completed - triggers the review request sequence. */
  router.post('/webhooks/job-complete', async (req, res, ctx) => {
    const auth = verify(req, ctx.url);
    if (!auth.ok) return H.unauthorized(res, 'bad webhook secret');
    const body = await H.readBody(req);
    if (!body.client_id || !body.lead_id) return H.badRequest(res, 'client_id and lead_id required');
    const enrolled = sequences.enroll(
      { clientId: body.client_id, leadId: body.lead_id, trigger: 'review_request' }, 'webhook');
    return H.ok(res, { enrolled });
  });
}

module.exports = { register };
