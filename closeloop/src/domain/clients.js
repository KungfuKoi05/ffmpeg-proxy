'use strict';
const db = require('../db');
const { id, nowIso } = require('../lib/ids');
const { config, effectiveMode } = require('../config');
const { defaultSequencesFor } = require('./sequences');

function create(input, actor = 'operator') {
  const now = nowIso();
  const clientId = id('cli');
  db.tx(() => {
    db.insert('clients', {
      id: clientId,
      name: input.name,
      industry: input.industry || 'other',
      timezone: input.timezone || 'America/New_York',
      phone: input.phone || null,
      email: input.email || null,
      website: input.website || null,
      automation_mode: input.automation_mode || 'TEST',
      avg_job_value: Number(input.avg_job_value || 0),
      close_rate: Number(input.close_rate || 0.25),
      monthly_fee: Number(input.monthly_fee || 0),
      quiet_start_hour: Number(input.quiet_start_hour ?? 21),
      quiet_end_hour: Number(input.quiet_end_hour ?? 8),
      status: input.status || 'trial',
      created_at: now,
      updated_at: now,
    });
    db.insert('client_config', {
      client_id: clientId,
      services: JSON.stringify(input.services || []),
      hours: JSON.stringify(input.hours || {}),
      booking_method: input.booking_method || null,
      booking_url: input.booking_url || null,
      brand_voice: input.brand_voice || 'Friendly, direct, no jargon. Never pushy.',
      escalation: JSON.stringify(input.escalation || {}),
      faqs: JSON.stringify(input.faqs || []),
      signature: input.signature || input.name,
      extra: JSON.stringify(input.extra || {}),
      updated_at: now,
    });
    // Every new client gets the industry's default follow-up sequences,
    // disabled-by-default behaviour comes from automation_mode, not from
    // withholding the sequences themselves.
    for (const seq of defaultSequencesFor(input.industry || 'other')) {
      const seqId = id('seq');
      db.insert('sequences', {
        id: seqId, client_id: clientId, name: seq.name, trigger: seq.trigger,
        enabled: seq.enabled === false ? 0 : 1,
        stop_on_reply: seq.stopOnReply === false ? 0 : 1,
        created_at: now, updated_at: now,
      });
      seq.steps.forEach((step, i) => {
        db.insert('sequence_steps', {
          id: id('stp'), sequence_id: seqId, step_index: i,
          delay_hours: step.delayHours, channel: step.channel,
          template: step.template, subject: step.subject || null,
        });
      });
    }
  });
  db.logEvent({ clientId, entityType: 'client', entityId: clientId, type: 'client.created', actor,
                data: { name: input.name, industry: input.industry } });
  return getById(clientId);
}

const getById = (clientId) => db.get('SELECT * FROM clients WHERE id = ?', clientId);
const list = (status = null) => (status
  ? db.all('SELECT * FROM clients WHERE status = ? ORDER BY created_at DESC', status)
  : db.all('SELECT * FROM clients ORDER BY created_at DESC'));

function getConfig(clientId) {
  const row = db.get('SELECT * FROM client_config WHERE client_id = ?', clientId);
  if (!row) return null;
  const parse = (v, fallback) => { try { return JSON.parse(v); } catch { return fallback; } };
  return {
    ...row,
    services: parse(row.services, []),
    hours: parse(row.hours, {}),
    escalation: parse(row.escalation, {}),
    faqs: parse(row.faqs, []),
    extra: parse(row.extra, {}),
  };
}

const ALLOWED_PATCH = new Set(['name', 'industry', 'timezone', 'phone', 'email', 'website',
  'automation_mode', 'avg_job_value', 'close_rate', 'monthly_fee',
  'quiet_start_hour', 'quiet_end_hour', 'status']);

function update(clientId, patch, actor = 'operator') {
  const clean = {};
  for (const [k, v] of Object.entries(patch)) if (ALLOWED_PATCH.has(k)) clean[k] = v;
  if (!Object.keys(clean).length) return getById(clientId);
  clean.updated_at = nowIso();
  db.update('clients', clientId, clean);
  db.logEvent({ clientId, entityType: 'client', entityId: clientId, type: 'client.updated', actor, data: clean });
  return getById(clientId);
}

function updateConfig(clientId, patch, actor = 'operator') {
  const clean = { updated_at: nowIso() };
  for (const key of ['booking_method', 'booking_url', 'brand_voice', 'signature']) {
    if (patch[key] !== undefined) clean[key] = patch[key];
  }
  for (const key of ['services', 'hours', 'escalation', 'faqs', 'extra']) {
    if (patch[key] !== undefined) clean[key] = JSON.stringify(patch[key]);
  }
  const keys = Object.keys(clean);
  db.run(`UPDATE client_config SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE client_id = ?`,
         ...keys.map((k) => clean[k]), clientId);
  db.logEvent({ clientId, entityType: 'client', entityId: clientId, type: 'client.config_updated', actor });
  return getConfig(clientId);
}

/** The mode actually in force for this client: the stricter of global/client. */
const modeFor = (client) => effectiveMode(config.automationMode, client.automation_mode);

module.exports = { create, getById, list, getConfig, update, updateConfig, modeFor };
