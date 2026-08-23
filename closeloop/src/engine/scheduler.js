'use strict';
const db = require('../db');
const { nowIso } = require('../lib/ids');
const { config } = require('../config');
const clients = require('../domain/clients');
const sequences = require('../domain/sequences');
const outbox = require('./outbox');
const log = require('../lib/logger');

let timer = null;
let running = false;

/** Build the variables a template can reference for one enrollment. */
function templateVars(enrollment) {
  const lead = db.get('SELECT * FROM leads WHERE id = ?', enrollment.lead_id);
  const client = clients.getById(enrollment.client_id);
  const cfg = clients.getConfig(enrollment.client_id) || {};
  const estimate = enrollment.estimate_id
    ? db.get('SELECT * FROM estimates WHERE id = ?', enrollment.estimate_id) : null;
  const appt = enrollment.appointment_id
    ? db.get('SELECT * FROM appointments WHERE id = ?', enrollment.appointment_id) : null;

  const firstName = (lead.name || '').trim().split(/\s+/)[0] || 'there';
  const money = (n) => `$${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  let apptWhen = '';
  if (appt) {
    try {
      apptWhen = new Intl.DateTimeFormat('en-US', {
        timeZone: client.timezone, weekday: 'long', month: 'short',
        day: 'numeric', hour: 'numeric', minute: '2-digit',
      }).format(new Date(appt.scheduled_at));
    } catch { apptWhen = new Date(appt.scheduled_at).toUTCString(); }
  }

  return {
    first_name: firstName,
    full_name: lead.name || '',
    business: client.name,
    signature: cfg.signature || client.name,
    booking_url: cfg.booking_url || '',
    review_url: cfg.extra?.review_url || cfg.booking_url || '',
    estimate_amount: estimate ? money(estimate.amount) : '',
    // Phrase tokens exist so a missing value leaves a clean sentence rather
    // than a dangling "for ." - render() strips the whole phrase.
    estimate_amount_phrase: estimate && estimate.amount > 0 ? ` for ${money(estimate.amount)}` : '',
    estimate_description: estimate?.description || 'the work we quoted',
    intent_phrase: lead.intent_note ? ` about ${lead.intent_note}` : '',
    last_service: lead.notes || 'system',
    appointment_when: apptWhen,
  };
}

/** Advance one enrollment by one step. */
async function runEnrollment(enrollment) {
  const steps = sequences.stepsFor(enrollment.sequence_id);
  const step = steps[enrollment.next_step];
  const now = nowIso();

  if (!step) {
    db.update('enrollments', enrollment.id, { status: 'completed', next_run_at: null, updated_at: now });
    return { enrollmentId: enrollment.id, action: 'completed' };
  }

  const lead = db.get('SELECT * FROM leads WHERE id = ?', enrollment.lead_id);
  if (!lead || lead.opted_out || lead.status === 'dnc') {
    db.update('enrollments', enrollment.id, { status: 'stopped_optout', next_run_at: null, updated_at: now });
    return { enrollmentId: enrollment.id, action: 'stopped_optout' };
  }

  const vars = templateVars(enrollment);
  const { text, missing } = sequences.render(step.template, vars);
  const subject = step.subject ? sequences.render(step.subject, vars).text : null;

  const message = await outbox.queue({
    clientId: enrollment.client_id,
    leadId: enrollment.lead_id,
    channel: step.channel,
    subject,
    body: text,
    enrollmentId: enrollment.id,
    renderedMissing: missing,
  }, 'engine');

  // Advance regardless of the send outcome. A suppressed step must not wedge
  // the sequence: the next step may use a different channel that succeeds.
  const nextIndex = enrollment.next_step + 1;
  const nextStep = steps[nextIndex];
  const patch = { next_step: nextIndex, updated_at: now };
  if (nextStep) {
    patch.next_run_at = new Date(
      new Date(enrollment.anchor_at).getTime() + nextStep.delay_hours * 3600_000).toISOString();
  } else {
    patch.status = 'completed';
    patch.next_run_at = null;
  }
  db.update('enrollments', enrollment.id, patch);
  db.update('leads', enrollment.lead_id, { next_followup_at: patch.next_run_at || null, updated_at: now });

  return { enrollmentId: enrollment.id, action: 'stepped', step: enrollment.next_step,
           messageStatus: message.status, channel: step.channel };
}

/**
 * One scheduler pass. Safe to call directly - tests drive it this way rather
 * than waiting on wall-clock time.
 */
async function tick() {
  if (running) return { skipped: 'already_running' };
  running = true;
  const started = Date.now();
  const results = { enrollments: [], deferred: 0, errors: 0 };

  try {
    const due = db.all(
      `SELECT * FROM enrollments
        WHERE status = 'active' AND next_run_at IS NOT NULL AND next_run_at <= ?
        ORDER BY next_run_at LIMIT 500`, nowIso());

    for (const enrollment of due) {
      try {
        results.enrollments.push(await runEnrollment(enrollment));
      } catch (err) {
        results.errors += 1;
        db.logSystem('error', 'scheduler', `enrollment failed: ${err.message}`,
                     { enrollmentId: enrollment.id });
        log.error('scheduler', 'enrollment failed', { id: enrollment.id, error: err.message });
      }
    }

    // Messages parked by quiet hours whose window has now opened.
    const deferred = db.all(
      `SELECT * FROM messages WHERE status = 'draft' AND scheduled_for IS NOT NULL
         AND scheduled_for <= ? LIMIT 200`, nowIso());
    for (const msg of deferred) {
      try {
        const client = clients.getById(msg.client_id);
        const mode = clients.modeFor(client);
        if (outbox.inQuietHours(client)) continue;
        if (mode === 'TEST') {
          db.update('messages', msg.id, { status: 'simulated', provider: 'simulator',
                                          sent_at: nowIso(), updated_at: nowIso() });
        } else if (mode === 'ASSISTED') {
          db.update('messages', msg.id, { status: 'pending_approval', updated_at: nowIso() });
        } else if (mode === 'LIVE') {
          db.update('messages', msg.id, { status: 'approved', updated_at: nowIso() });
          await outbox.dispatch(msg.id, 'engine');
        } else {
          db.update('messages', msg.id, { status: 'suppressed', suppress_reason: 'automation_off',
                                          updated_at: nowIso() });
        }
        results.deferred += 1;
      } catch (err) {
        results.errors += 1;
        db.logSystem('error', 'scheduler', `deferred message failed: ${err.message}`, { messageId: msg.id });
      }
    }
  } finally {
    running = false;
  }

  results.duration_ms = Date.now() - started;
  db.setSetting('engine.last_tick', nowIso());
  if (results.enrollments.length || results.deferred || results.errors) {
    log.info('scheduler', 'tick complete', {
      stepped: results.enrollments.length, deferred: results.deferred,
      errors: results.errors, ms: results.duration_ms });
  }
  return results;
}

function start() {
  if (timer) return;
  if (!config.engine.enabled) { log.warn('scheduler', 'engine disabled by config'); return; }
  if (config.automationMode === 'OFF') { log.warn('scheduler', 'AUTOMATION_MODE=OFF, engine idle'); return; }
  timer = setInterval(() => { tick().catch((e) => log.error('scheduler', 'tick threw', { error: e.message })); },
                      config.engine.tickMs);
  timer.unref?.();
  log.info('scheduler', 'started', { tickMs: config.engine.tickMs, mode: config.automationMode });
}

function stop() { if (timer) { clearInterval(timer); timer = null; } }

module.exports = { tick, start, stop, runEnrollment, templateVars };
