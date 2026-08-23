'use strict';
const db = require('../db');
const { id, nowIso } = require('../lib/ids');
const sequences = require('./sequences');
const { classifyLead } = require('./classify');

/** Digits-only comparison key so "(555) 123-4567" and "5551234567" dedupe. */
const phoneKey = (p) => (p ? String(p).replace(/\D/g, '').slice(-10) : '');

const STATUS_RANK = {
  new: 0, contacted: 1, responded: 2, appointment: 3, estimate: 4,
  nurture: 2, won: 9, lost: 9, dnc: 9,
};

/**
 * Create or merge a lead.
 *
 * Dedupe is on last-10-digits of phone, then email, within a client. Two calls
 * from the same number in a week are one lead with two events, not two leads -
 * otherwise every metric we report is inflated, which is the one thing this
 * product cannot afford to get wrong.
 */
async function capture(input, actor = 'system') {
  const now = nowIso();
  const clientId = input.client_id;
  const pk = phoneKey(input.phone);

  let existing = null;
  if (pk) {
    existing = db.get(
      `SELECT * FROM leads WHERE client_id = ?
         AND REPLACE(REPLACE(REPLACE(REPLACE(phone,'-',''),' ',''),'(',''),')','') LIKE ?
       ORDER BY created_at DESC LIMIT 1`, clientId, `%${pk}`);
  }
  if (!existing && input.email) {
    existing = db.get('SELECT * FROM leads WHERE client_id = ? AND lower(email) = lower(?) ORDER BY created_at DESC LIMIT 1',
                      clientId, input.email);
  }

  let classification = null;
  const text = input.intent_note || input.message || '';
  if (text) classification = await classifyLead(text);

  if (existing) {
    const patch = { updated_at: now };
    if (input.name && !existing.name) patch.name = input.name;
    if (input.email && !existing.email) patch.email = input.email;
    if (input.phone && !existing.phone) patch.phone = input.phone;
    if (text) patch.intent_note = text;
    if (classification) {
      patch.classification = classification.label;
      patch.classification_confidence = classification.confidence;
      patch.classification_source = classification.source;
    }
    if (Number(input.estimated_value) > 0) patch.estimated_value = Number(input.estimated_value);
    db.update('leads', existing.id, patch);
    db.logEvent({ clientId, entityType: 'lead', entityId: existing.id, type: 'lead.recaptured', actor,
                  data: { source: input.source, classification: classification?.label } });
    return { lead: getById(existing.id), created: false, classification };
  }

  const leadId = id('led');
  db.insert('leads', {
    id: leadId,
    client_id: clientId,
    name: input.name || null,
    phone: input.phone || null,
    email: input.email || null,
    source: input.source || 'manual',
    status: 'new',
    classification: classification?.label || null,
    classification_confidence: classification?.confidence ?? null,
    classification_source: classification?.source || null,
    intent_note: text || null,
    estimated_value: Number(input.estimated_value || 0),
    notes: input.notes || null,
    consent_sms: input.consent_sms ? 1 : 0,
    consent_source: input.consent_source || null,
    opted_out: 0,
    created_at: now,
    updated_at: now,
  });
  db.logEvent({ clientId, entityType: 'lead', entityId: leadId, type: 'lead.created', actor,
                data: { source: input.source, classification: classification?.label,
                        confidence: classification?.confidence } });
  return { lead: getById(leadId), created: true, classification };
}

const getById = (leadId) => db.get('SELECT * FROM leads WHERE id = ?', leadId);

function list(clientId, { status = null, limit = 200, offset = 0, search = null } = {}) {
  const where = ['client_id = ?'];
  const params = [clientId];
  if (status) { where.push('status = ?'); params.push(status); }
  if (search) {
    where.push('(lower(COALESCE(name,\'\')) LIKE ? OR COALESCE(phone,\'\') LIKE ? OR lower(COALESCE(email,\'\')) LIKE ?)');
    params.push(`%${search.toLowerCase()}%`, `%${search}%`, `%${search.toLowerCase()}%`);
  }
  return db.all(
    `SELECT * FROM leads WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    ...params, limit, offset);
}

/** Status only ever moves forward, except for explicit terminal states. */
function setStatus(leadId, status, actor = 'system', data = {}) {
  const lead = getById(leadId);
  if (!lead) return null;
  const current = STATUS_RANK[lead.status] ?? 0;
  const next = STATUS_RANK[status] ?? 0;
  if (next < current && !['lost', 'won', 'dnc', 'nurture'].includes(status)) return lead;
  db.update('leads', leadId, { status, updated_at: nowIso() });
  db.logEvent({ clientId: lead.client_id, entityType: 'lead', entityId: leadId,
                type: 'lead.status_changed', actor, data: { from: lead.status, to: status, ...data } });
  return getById(leadId);
}

/**
 * Record an inbound message from the lead.
 *
 * This is the single most important event in the system: it is what turns a
 * "contacted" lead into a "responded" one, it stops the sequence, and it is
 * the hinge the whole attribution model swings on.
 */
async function recordResponse({ leadId, channel = 'sms', body, from = null }, actor = 'lead') {
  const lead = getById(leadId);
  if (!lead) return null;
  const now = nowIso();

  db.insert('messages', {
    id: id('msg'), client_id: lead.client_id, lead_id: leadId, enrollment_id: null,
    direction: 'inbound', channel, to_addr: null, from_addr: from || lead.phone || lead.email,
    subject: null, body, status: 'sent', mode_at_creation: 'n/a',
    provider: 'inbound', created_at: now, updated_at: now, sent_at: now,
  });

  const patch = { last_response_at: now, updated_at: now };
  if (!lead.first_response_at) patch.first_response_at = now;
  db.update('leads', leadId, patch);

  // STOP / opt-out handling. Legally load-bearing: honour it immediately and
  // unconditionally, before anything else looks at this lead.
  if (/^\s*(stop|stopall|unsubscribe|cancel|end|quit)\b/i.test(body)) {
    db.update('leads', leadId, { opted_out: 1, status: 'dnc', updated_at: now });
    sequences.stopAllForLead(leadId, 'stopped_optout', 'lead');
    db.logEvent({ clientId: lead.client_id, entityType: 'lead', entityId: leadId,
                  type: 'lead.opted_out', actor, data: { channel } });
    return { lead: getById(leadId), optedOut: true };
  }

  const classification = body ? await classifyLead(body) : null;
  if (classification) {
    db.update('leads', leadId, {
      classification: classification.label,
      classification_confidence: classification.confidence,
      classification_source: classification.source,
      updated_at: now,
    });
  }

  // Only sequences flagged stop_on_reply halt; reminders keep running.
  const stopped = sequences.stopAllForLead(leadId, 'stopped_reply', 'lead', { onlyStopOnReply: true });
  setStatus(leadId, 'responded', 'lead', { channel });

  db.logEvent({ clientId: lead.client_id, entityType: 'lead', entityId: leadId,
                type: 'lead.responded', actor,
                data: { channel, sequencesStopped: stopped, classification: classification?.label } });

  return { lead: getById(leadId), optedOut: false, classification, sequencesStopped: stopped };
}

function optOut(leadId, actor = 'operator') {
  const lead = getById(leadId);
  if (!lead) return null;
  db.update('leads', leadId, { opted_out: 1, status: 'dnc', updated_at: nowIso() });
  sequences.stopAllForLead(leadId, 'stopped_optout', actor);
  db.logEvent({ clientId: lead.client_id, entityType: 'lead', entityId: leadId, type: 'lead.opted_out', actor });
  return getById(leadId);
}

const timeline = (leadId) => db.all(
  `SELECT 'event' AS kind, type, data AS body, actor, created_at FROM events
     WHERE entity_type = 'lead' AND entity_id = ?
   UNION ALL
   SELECT 'message' AS kind, direction || ':' || channel || ':' || status AS type,
          body, COALESCE(approved_by,'system') AS actor, created_at
     FROM messages WHERE lead_id = ?
   ORDER BY created_at DESC LIMIT 200`, leadId, leadId);

module.exports = { capture, getById, list, setStatus, recordResponse, optOut, timeline, phoneKey };
