'use strict';
const db = require('../db');
const { id, nowIso } = require('../lib/ids');

// ---------------------------------------------------------------------------
// Default sequences.
//
// Cadence rationale (from the estimate-follow-up research in
// research/niche-analysis.md): top performers make 4-5 touches across ~7 days
// while most contractors make 1-2. These defaults encode that, and every step
// is editable per client via /admin.
//
// Copy rules, non-negotiable:
//  - Written as the CLIENT's business, never as a third-party marketing agency.
//  - Never claims a discount, deadline, or promise the business hasn't made.
//  - Every SMS sequence's first message carries an opt-out.
// ---------------------------------------------------------------------------
const OPT_OUT = 'Reply STOP to opt out.';

const ESTIMATE_FOLLOWUP = {
  name: 'Unsold estimate follow-up',
  trigger: 'estimate_sent',
  stopOnReply: true,
  steps: [
    { delayHours: 24, channel: 'sms',
      template: `Hi {{first_name}}, it's {{business}}. Just checking you got the estimate we sent for {{estimate_description}}. Any questions on it? ${OPT_OUT}` },
    { delayHours: 72, channel: 'email', subject: 'Your {{business}} estimate - anything unclear?',
      template: `Hi {{first_name}},\n\nFollowing up on the estimate we sent you{{estimate_amount_phrase}}.\n\nMost people have one of three questions at this point: what's included, how soon we could start, or whether there's a payment option. Happy to answer any of them - just reply to this email.\n\n{{signature}}` },
    { delayHours: 168, channel: 'sms',
      template: `Hi {{first_name}}, {{business}} here. Still happy to answer questions on your estimate, or hold your spot on the schedule if you're ready. Either way, just let me know.` },
    { delayHours: 336, channel: 'email', subject: 'Should I close out your file?',
      template: `Hi {{first_name}},\n\nI don't want to keep bothering you. If you've gone another direction or the timing isn't right, just say the word and I'll close this out - no hard feelings.\n\nIf you're still considering it, the estimate stands and I'm here.\n\n{{signature}}` },
  ],
};

const MISSED_CALL = {
  name: 'Missed call recovery',
  trigger: 'missed_call',
  stopOnReply: true,
  steps: [
    // Speed is the whole point. 85% of callers who don't reach a person never
    // call back, so the first touch is measured in minutes, not hours.
    { delayHours: 0.03, channel: 'sms',
      template: `Hi, this is {{business}} - sorry we missed your call. What can we help with? Reply here and we'll get right back to you. ${OPT_OUT}` },
    { delayHours: 4, channel: 'sms',
      template: `Hi, {{business}} again - still happy to help if you're around. What do you need done?` },
    { delayHours: 48, channel: 'sms',
      template: `Last note from {{business}} - if you still need help, reply anytime and we'll pick it up.` },
  ],
};

const NEW_LEAD = {
  name: 'New lead response',
  trigger: 'new_lead',
  stopOnReply: true,
  steps: [
    { delayHours: 0.03, channel: 'sms',
      template: `Hi {{first_name}}, this is {{business}} - got your request{{intent_phrase}}. What's the best time to reach you? ${OPT_OUT}` },
    { delayHours: 24, channel: 'email', subject: 'Following up on your request',
      template: `Hi {{first_name}},\n\nWe got your request{{intent_phrase}} and wanted to make sure it didn't slip through.\n\nWhat's a good time to talk?\n\n{{signature}}` },
    { delayHours: 96, channel: 'sms',
      template: `Hi {{first_name}}, {{business}} here - still want to help with this. Reply anytime.` },
  ],
};

const APPOINTMENT = {
  name: 'Appointment reminders',
  trigger: 'appointment',
  stopOnReply: false, // a reminder should still go out even after a reply
  steps: [
    { delayHours: -24, channel: 'sms',
      template: `Reminder from {{business}}: we're scheduled with you {{appointment_when}}. Reply C to confirm or R to reschedule.` },
    { delayHours: -2, channel: 'sms',
      template: `{{business}}: we're on the way window for today's {{appointment_when}} visit. See you soon.` },
  ],
};

const REACTIVATION = {
  name: 'Past customer reactivation',
  trigger: 'reactivation',
  enabled: false, // OFF by default: contacting a past-customer list needs an explicit decision
  stopOnReply: true,
  steps: [
    { delayHours: 0, channel: 'email', subject: 'Time for a check on your system?',
      template: `Hi {{first_name}},\n\nIt's been a while since we worked on your {{last_service}}. Around this time of year we usually recommend a check to catch anything small before it turns into a callout.\n\nWant me to put you on the schedule?\n\n{{signature}}` },
    { delayHours: 336, channel: 'sms',
      template: `Hi {{first_name}}, {{business}} here. Still happy to get you on the schedule for a check whenever suits. ${OPT_OUT}` },
  ],
};

const REVIEW_REQUEST = {
  name: 'Review request',
  trigger: 'review_request',
  stopOnReply: true,
  steps: [
    // Neutral ask. We never gate on sentiment, never route unhappy customers
    // away from a public review, and never offer anything in exchange.
    { delayHours: 24, channel: 'sms',
      template: `Hi {{first_name}}, thanks for choosing {{business}}. If you have 30 seconds, an honest review really helps us: {{review_url}} ${OPT_OUT}` },
  ],
};

const BASE = [MISSED_CALL, NEW_LEAD, ESTIMATE_FOLLOWUP, APPOINTMENT, REACTIVATION, REVIEW_REQUEST];

function defaultSequencesFor(industry) {
  // Industry tuning is deliberately light. The cadence is the product; the
  // wording differences between trades are handled by brand voice + templates.
  return BASE.map((s) => ({ ...s, steps: s.steps.map((x) => ({ ...x })) }));
}

// ---------------------------------------------------------------------------
// Template rendering
// ---------------------------------------------------------------------------
/**
 * Render {{token}} placeholders.
 *
 * Unknown tokens render as empty string rather than leaving "{{foo}}" visible
 * to a customer, and we report which tokens were missing so the operator can
 * see it in the message record. A message that still contains "{{" after
 * rendering is treated as a bug by outbox.js and is suppressed.
 */
function render(template, vars) {
  const missing = [];
  const out = String(template).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const val = vars[key];
    if (val === undefined || val === null || val === '') { missing.push(key); return ''; }
    return String(val);
  });
  // Collapse whitespace left behind by empty tokens.
  return { text: out.replace(/[ \t]{2,}/g, ' ').replace(/ +([.,!?])/g, '$1').trim(), missing };
}

const listForClient = (clientId) => db.all(
  'SELECT * FROM sequences WHERE client_id = ? ORDER BY trigger', clientId);

const stepsFor = (sequenceId) => db.all(
  'SELECT * FROM sequence_steps WHERE sequence_id = ? ORDER BY step_index', sequenceId);

const findByTrigger = (clientId, trigger) => db.get(
  'SELECT * FROM sequences WHERE client_id = ? AND trigger = ? AND enabled = 1', clientId, trigger);

function setEnabled(sequenceId, enabled, actor = 'operator') {
  db.update('sequences', sequenceId, { enabled: enabled ? 1 : 0, updated_at: nowIso() });
  const seq = db.get('SELECT * FROM sequences WHERE id = ?', sequenceId);
  db.logEvent({ clientId: seq?.client_id, entityType: 'sequence', entityId: sequenceId,
                type: enabled ? 'sequence.enabled' : 'sequence.disabled', actor });
  return seq;
}

function updateStep(stepId, patch, actor = 'operator') {
  const clean = {};
  if (patch.template !== undefined) clean.template = String(patch.template);
  if (patch.subject !== undefined) clean.subject = patch.subject;
  if (patch.delay_hours !== undefined) clean.delay_hours = Number(patch.delay_hours);
  if (patch.channel !== undefined && ['sms', 'email'].includes(patch.channel)) clean.channel = patch.channel;
  if (!Object.keys(clean).length) return null;
  db.update('sequence_steps', stepId, clean);
  db.logEvent({ entityType: 'sequence_step', entityId: stepId, type: 'sequence.step_updated', actor, data: clean });
  return db.get('SELECT * FROM sequence_steps WHERE id = ?', stepId);
}

/**
 * Enrol a lead in a sequence.
 *
 * `anchorAt` is the event the delays are measured from (call time, estimate
 * sent time, appointment time). Appointment steps use negative delays, so the
 * anchor is the appointment itself and steps land before it.
 */
function enroll({ clientId, leadId, trigger, anchorAt = nowIso(), estimateId = null, appointmentId = null }, actor = 'system') {
  const seq = findByTrigger(clientId, trigger);
  if (!seq) return { enrolled: false, reason: 'no_enabled_sequence' };

  const existing = db.get(
    `SELECT * FROM enrollments WHERE lead_id = ? AND sequence_id = ?
       AND COALESCE(estimate_id,'') = COALESCE(?,'') AND COALESCE(appointment_id,'') = COALESCE(?,'')`,
    leadId, seq.id, estimateId, appointmentId);
  if (existing) return { enrolled: false, reason: 'already_enrolled', enrollment: existing };

  const steps = stepsFor(seq.id);
  if (!steps.length) return { enrolled: false, reason: 'sequence_has_no_steps' };

  const now = nowIso();
  const enrollmentId = id('enr');
  const firstRun = new Date(new Date(anchorAt).getTime() + steps[0].delay_hours * 3600_000).toISOString();
  db.insert('enrollments', {
    id: enrollmentId, client_id: clientId, lead_id: leadId, sequence_id: seq.id,
    estimate_id: estimateId, appointment_id: appointmentId,
    next_step: 0, next_run_at: firstRun, anchor_at: anchorAt,
    status: 'active', created_at: now, updated_at: now,
  });
  db.update('leads', leadId, { next_followup_at: firstRun, updated_at: now });
  db.logEvent({ clientId, entityType: 'lead', entityId: leadId, type: 'enrollment.created', actor,
                data: { sequence: seq.name, trigger, enrollmentId, firstRun } });
  return { enrolled: true, enrollmentId, sequence: seq, firstRun };
}

function stop(enrollmentId, status, actor = 'system') {
  const enr = db.get('SELECT * FROM enrollments WHERE id = ?', enrollmentId);
  if (!enr || enr.status !== 'active') return false;
  db.update('enrollments', enrollmentId, { status, next_run_at: null, updated_at: nowIso() });
  db.logEvent({ clientId: enr.client_id, entityType: 'lead', entityId: enr.lead_id,
                type: 'enrollment.stopped', actor, data: { enrollmentId, status } });
  return true;
}

/** Stop every active enrollment for a lead. Used on reply, opt-out and win. */
function stopAllForLead(leadId, status, actor = 'system', { onlyStopOnReply = false } = {}) {
  const rows = db.all(
    `SELECT e.*, s.stop_on_reply FROM enrollments e
       JOIN sequences s ON s.id = e.sequence_id
      WHERE e.lead_id = ? AND e.status = 'active'`, leadId);
  let stopped = 0;
  for (const row of rows) {
    if (onlyStopOnReply && !row.stop_on_reply) continue;
    if (stop(row.id, status, actor)) stopped += 1;
  }
  return stopped;
}

module.exports = {
  defaultSequencesFor, render, listForClient, stepsFor, findByTrigger,
  setEnabled, updateStep, enroll, stop, stopAllForLead,
  TEMPLATES: { ESTIMATE_FOLLOWUP, MISSED_CALL, NEW_LEAD, APPOINTMENT, REACTIVATION, REVIEW_REQUEST },
};
