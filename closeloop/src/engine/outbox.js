'use strict';
const db = require('../db');
const { id, nowIso } = require('../lib/ids');
const { config } = require('../config');
const providers = require('../providers');
const clients = require('../domain/clients');

/** Local hour in an IANA timezone, falling back to UTC if the zone is bad. */
function localHour(timezone, when = new Date()) {
  try {
    return Number(new Intl.DateTimeFormat('en-US',
      { timeZone: timezone, hour: 'numeric', hour12: false }).format(when));
  } catch {
    return when.getUTCHours();
  }
}

/** Quiet hours may wrap midnight (e.g. 21 -> 8). */
function inQuietHours(client, when = new Date()) {
  const h = localHour(client.timezone, when);
  const { quiet_start_hour: start, quiet_end_hour: end } = client;
  if (start === end) return false;
  return start > end ? (h >= start || h < end) : (h >= start && h < end);
}

/** Next moment outside quiet hours, in UTC ISO. */
function nextAllowedTime(client, from = new Date()) {
  let cursor = new Date(from.getTime());
  for (let i = 0; i < 48 && inQuietHours(client, cursor); i += 1) {
    cursor = new Date(cursor.getTime() + 3600_000);
  }
  return cursor.toISOString();
}

function sentTodayCount(clientId) {
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const row = db.get(
    `SELECT COUNT(*) AS n FROM messages
      WHERE client_id = ? AND direction = 'outbound'
        AND status IN ('sent','simulated') AND created_at >= ?`, clientId, since);
  return row ? Number(row.n) : 0;
}

/**
 * Evaluate every guard for a prospective outbound message.
 * Returns { action: 'send'|'suppress'|'defer', reason, until? }.
 *
 * Ordered most-permanent first: an opted-out lead should record "opted_out",
 * not "quiet_hours", because the reason lands in the audit trail and a human
 * will read it.
 */
function evaluateGuards({ client, lead, channel, mode, renderedText, missingTokens, to }) {
  if (lead.opted_out) return { action: 'suppress', reason: 'lead_opted_out' };
  if (lead.status === 'dnc') return { action: 'suppress', reason: 'lead_do_not_contact' };
  if (mode === 'OFF') return { action: 'suppress', reason: 'automation_off' };
  if (!to) return { action: 'suppress', reason: `no_${channel}_address` };

  // A template that still has {{ }} in it means a data or config bug. Never
  // let a customer see it.
  if (/\{\{/.test(renderedText)) return { action: 'suppress', reason: 'unrendered_template' };
  if (!renderedText.trim()) return { action: 'suppress', reason: 'empty_body' };

  // Consent gate for real SMS. TEST/ASSISTED can render without consent so the
  // operator can review the copy, but nothing transmits.
  if (channel === 'sms' && mode === 'LIVE' && !lead.consent_sms) {
    return { action: 'suppress', reason: 'no_sms_consent' };
  }

  if (sentTodayCount(client.id) >= config.engine.maxSendsPerClientPerDay) {
    return { action: 'suppress', reason: 'client_daily_cap' };
  }

  // Quiet hours defer rather than suppress: the follow-up still matters, it
  // just shouldn't land at 3am.
  //
  // Only LIVE defers here. In TEST nothing is transmitted, so holding a
  // simulated message back would just hide the copy from the operator who is
  // reviewing it. In ASSISTED the message sits waiting for a human anyway, so
  // the meaningful check is at dispatch time - and dispatch() enforces it.
  if (mode === 'LIVE' && inQuietHours(client)) {
    return { action: 'defer', reason: 'quiet_hours', until: nextAllowedTime(client) };
  }

  if (missingTokens?.length) {
    db.logSystem('warn', 'outbox', 'template rendered with missing tokens',
                 { leadId: lead.id, missingTokens });
  }
  return { action: 'send', reason: null };
}

/**
 * Queue an outbound message. This is the ONLY way a message is created.
 *
 * Returns the message row. Its status encodes what happened:
 *   simulated        - TEST mode, rendered and stored, nothing transmitted
 *   pending_approval - ASSISTED mode, waiting on a human
 *   sent / failed    - LIVE mode, provider result
 *   suppressed       - a guard blocked it (reason in suppress_reason)
 *   draft            - deferred by quiet hours, scheduled_for is set
 */
async function queue({ clientId, leadId, channel, subject = null, body, enrollmentId = null,
                       renderedMissing = [] }, actor = 'system') {
  const client = clients.getById(clientId);
  const lead = db.get('SELECT * FROM leads WHERE id = ?', leadId);
  if (!client || !lead) throw new Error('queue: unknown client or lead');

  const mode = clients.modeFor(client);
  const to = channel === 'sms' ? lead.phone : lead.email;
  const now = nowIso();

  const verdict = evaluateGuards({
    client, lead, channel, mode, renderedText: body, missingTokens: renderedMissing, to,
  });

  const base = {
    id: id('msg'), client_id: clientId, lead_id: leadId, enrollment_id: enrollmentId,
    direction: 'outbound', channel, to_addr: to, from_addr: null,
    subject, body, mode_at_creation: mode,
    created_at: now, updated_at: now,
  };

  if (verdict.action === 'suppress') {
    db.insert('messages', { ...base, status: 'suppressed', suppress_reason: verdict.reason });
    db.logEvent({ clientId, entityType: 'lead', entityId: leadId, type: 'message.suppressed', actor,
                  data: { channel, reason: verdict.reason, messageId: base.id } });
    return db.get('SELECT * FROM messages WHERE id = ?', base.id);
  }

  if (verdict.action === 'defer') {
    db.insert('messages', { ...base, status: 'draft', scheduled_for: verdict.until,
                            suppress_reason: verdict.reason });
    db.logEvent({ clientId, entityType: 'lead', entityId: leadId, type: 'message.deferred', actor,
                  data: { channel, until: verdict.until, messageId: base.id } });
    return db.get('SELECT * FROM messages WHERE id = ?', base.id);
  }

  if (mode === 'TEST') {
    db.insert('messages', { ...base, status: 'simulated', provider: 'simulator', sent_at: now });
    touchLead(leadId, now);
    db.logEvent({ clientId, entityType: 'lead', entityId: leadId, type: 'message.simulated', actor,
                  data: { channel, messageId: base.id, preview: body.slice(0, 80) } });
    return db.get('SELECT * FROM messages WHERE id = ?', base.id);
  }

  if (mode === 'ASSISTED') {
    db.insert('messages', { ...base, status: 'pending_approval' });
    db.logEvent({ clientId, entityType: 'lead', entityId: leadId, type: 'message.pending_approval', actor,
                  data: { channel, messageId: base.id } });
    return db.get('SELECT * FROM messages WHERE id = ?', base.id);
  }

  // LIVE
  db.insert('messages', { ...base, status: 'approved' });
  return dispatch(base.id, actor);
}

/**
 * Transmit an already-approved message.
 *
 * Refuses anything not in {approved}. That refusal is what makes ASSISTED mode
 * meaningful: there is no code path from "pending_approval" to a provider that
 * doesn't pass through a human calling approve().
 */
async function dispatch(messageId, actor = 'system') {
  const msg = db.get('SELECT * FROM messages WHERE id = ?', messageId);
  if (!msg) throw new Error('dispatch: unknown message');
  if (msg.status !== 'approved') {
    db.logSystem('warn', 'outbox', 'dispatch refused: message not approved',
                 { messageId, status: msg.status });
    return msg;
  }

  const client = clients.getById(msg.client_id);
  const lead = db.get('SELECT * FROM leads WHERE id = ?', msg.lead_id);
  const mode = clients.modeFor(client);

  // Re-check the fast-moving guards at send time. Between approval and
  // dispatch a lead may have opted out, and that must win.
  if (lead.opted_out || lead.status === 'dnc') {
    db.update('messages', messageId,
      { status: 'suppressed', suppress_reason: 'lead_opted_out_before_send', updated_at: nowIso() });
    return db.get('SELECT * FROM messages WHERE id = ?', messageId);
  }

  // The real transmission moment. An ASSISTED message approved at 2am must not
  // go out at 2am; park it until the window opens and let the scheduler retry.
  if (mode === 'LIVE' && inQuietHours(client)) {
    const until = nextAllowedTime(client);
    db.update('messages', messageId,
      { status: 'draft', scheduled_for: until, suppress_reason: 'quiet_hours', updated_at: nowIso() });
    db.logEvent({ clientId: msg.client_id, entityType: 'lead', entityId: msg.lead_id,
                  type: 'message.deferred', actor, data: { until, messageId } });
    return db.get('SELECT * FROM messages WHERE id = ?', messageId);
  }

  const { provider, downgradedFrom } = providers.resolveForSend(msg.channel, mode);
  const now = nowIso();

  let result;
  try {
    result = await provider.send({ to: msg.to_addr, subject: msg.subject, body: msg.body });
  } catch (err) {
    result = { ok: false, error: `provider_threw: ${err.message}` };
  }

  if (result.ok) {
    db.update('messages', messageId, {
      status: downgradedFrom ? 'simulated' : 'sent',
      provider: provider.name, provider_id: result.providerId,
      sent_at: now, updated_at: now,
      suppress_reason: downgradedFrom ? `downgraded_from_${downgradedFrom}` : null,
    });
    touchLead(msg.lead_id, now);
    db.logEvent({ clientId: msg.client_id, entityType: 'lead', entityId: msg.lead_id,
                  type: downgradedFrom ? 'message.simulated' : 'message.sent', actor,
                  data: { channel: msg.channel, provider: provider.name, messageId } });
  } else {
    db.update('messages', messageId,
      { status: 'failed', provider: provider.name, error: result.error, updated_at: now });
    db.logSystem('error', 'outbox', `send failed: ${result.error}`,
                 { messageId, channel: msg.channel, clientId: msg.client_id });
    db.logEvent({ clientId: msg.client_id, entityType: 'lead', entityId: msg.lead_id,
                  type: 'message.failed', actor, data: { error: result.error, messageId } });
  }
  return db.get('SELECT * FROM messages WHERE id = ?', messageId);
}

/** An outbound touch moves a 'new' lead to 'contacted' and stamps last_contact_at. */
function touchLead(leadId, when) {
  const lead = db.get('SELECT * FROM leads WHERE id = ?', leadId);
  if (!lead) return;
  const patch = { last_contact_at: when, updated_at: when };
  if (lead.status === 'new') patch.status = 'contacted';
  db.update('leads', leadId, patch);
}

// --- approvals (ASSISTED mode) --------------------------------------------
const pendingApprovals = (clientId = null) => (clientId
  ? db.all(`SELECT m.*, l.name AS lead_name, l.phone AS lead_phone, l.email AS lead_email
              FROM messages m JOIN leads l ON l.id = m.lead_id
             WHERE m.status = 'pending_approval' AND m.client_id = ?
             ORDER BY m.created_at`, clientId)
  : db.all(`SELECT m.*, l.name AS lead_name, l.phone AS lead_phone, l.email AS lead_email,
                   c.name AS client_name
              FROM messages m JOIN leads l ON l.id = m.lead_id
              JOIN clients c ON c.id = m.client_id
             WHERE m.status = 'pending_approval' ORDER BY m.created_at`));

async function approve(messageId, approvedBy, editedBody = null) {
  const msg = db.get('SELECT * FROM messages WHERE id = ?', messageId);
  if (!msg || msg.status !== 'pending_approval') return { ok: false, error: 'not_pending' };
  const patch = { status: 'approved', approved_by: approvedBy, updated_at: nowIso() };
  if (editedBody && editedBody !== msg.body) patch.body = editedBody;
  db.update('messages', messageId, patch);
  db.logEvent({ clientId: msg.client_id, entityType: 'lead', entityId: msg.lead_id,
                type: 'message.approved', actor: approvedBy,
                data: { messageId, edited: Boolean(patch.body) } });
  const sent = await dispatch(messageId, approvedBy);
  return { ok: true, message: sent };
}

function reject(messageId, rejectedBy, reason = null) {
  const msg = db.get('SELECT * FROM messages WHERE id = ?', messageId);
  if (!msg || msg.status !== 'pending_approval') return { ok: false, error: 'not_pending' };
  db.update('messages', messageId,
    { status: 'rejected', approved_by: rejectedBy, suppress_reason: reason, updated_at: nowIso() });
  db.logEvent({ clientId: msg.client_id, entityType: 'lead', entityId: msg.lead_id,
                type: 'message.rejected', actor: rejectedBy, data: { messageId, reason } });
  return { ok: true };
}

module.exports = {
  queue, dispatch, pendingApprovals, approve, reject,
  inQuietHours, nextAllowedTime, localHour, evaluateGuards, sentTodayCount,
};
