'use strict';
// Estimates, appointments and won jobs - the client's pipeline objects that
// drive follow-up sequences and the ROI report.
const db = require('../db');
const { id, nowIso } = require('../lib/ids');
const sequences = require('./sequences');
const leads = require('./leads');
const roi = require('./roi');

function createEstimate({ clientId, leadId, amount, description = null, sentAt = null }, actor = 'operator') {
  const now = nowIso();
  const estimateId = id('est');
  const sent = sentAt || now;
  db.insert('estimates', {
    id: estimateId, client_id: clientId, lead_id: leadId,
    amount: Number(amount || 0), description, status: 'open',
    sent_at: sent, created_at: now, updated_at: now,
  });
  leads.setStatus(leadId, 'estimate', actor, { estimateId });
  // Estimated value on the lead follows the estimate, so pipeline maths is
  // driven by a real quoted number rather than an industry average.
  db.update('leads', leadId, { estimated_value: Number(amount || 0), updated_at: now });
  db.logEvent({ clientId, entityType: 'estimate', entityId: estimateId, type: 'estimate.created',
                actor, data: { amount, leadId } });

  const enrolled = sequences.enroll(
    { clientId, leadId, trigger: 'estimate_sent', anchorAt: sent, estimateId }, actor);
  return { estimate: db.get('SELECT * FROM estimates WHERE id = ?', estimateId), enrolled };
}

/** Mark an estimate won or lost. Winning creates the job and runs attribution. */
function decideEstimate(estimateId, outcome, { lostReason = null, amount = null } = {}, actor = 'operator') {
  const est = db.get('SELECT * FROM estimates WHERE id = ?', estimateId);
  if (!est || est.status !== 'open') return { ok: false, error: 'estimate_not_open' };
  const now = nowIso();
  db.update('estimates', estimateId, {
    status: outcome, decided_at: now, lost_reason: lostReason, updated_at: now,
  });

  if (outcome === 'won') {
    const jobId = id('job');
    db.insert('jobs', {
      id: jobId, client_id: est.client_id, lead_id: est.lead_id, estimate_id: estimateId,
      amount: Number(amount ?? est.amount), won_at: now, attributed: 0,
      attribution_reason: 'not_evaluated', created_at: now,
    });
    leads.setStatus(est.lead_id, 'won', actor, { jobId });
    sequences.stopAllForLead(est.lead_id, 'stopped_won', actor);
    const attribution = roi.evaluateJob(jobId);
    db.logEvent({ clientId: est.client_id, entityType: 'estimate', entityId: estimateId,
                  type: 'estimate.won', actor, data: { jobId, amount: est.amount } });
    // A won job is the natural, non-manipulative moment to ask for a review.
    sequences.enroll({ clientId: est.client_id, leadId: est.lead_id, trigger: 'review_request',
                       anchorAt: now }, actor);
    return { ok: true, jobId, attribution };
  }

  leads.setStatus(est.lead_id, 'lost', actor, { lostReason });
  sequences.stopAllForLead(est.lead_id, 'stopped_manual', actor);
  db.logEvent({ clientId: est.client_id, entityType: 'estimate', entityId: estimateId,
                type: 'estimate.lost', actor, data: { lostReason } });
  return { ok: true };
}

function createAppointment({ clientId, leadId, scheduledAt, kind = 'estimate_visit' }, actor = 'operator') {
  const now = nowIso();
  const apptId = id('apt');
  db.insert('appointments', {
    id: apptId, client_id: clientId, lead_id: leadId, scheduled_at: scheduledAt,
    kind, status: 'scheduled', created_at: now, updated_at: now,
  });
  leads.setStatus(leadId, 'appointment', actor, { apptId });
  db.logEvent({ clientId, entityType: 'appointment', entityId: apptId,
                type: 'appointment.created', actor, data: { scheduledAt, kind } });
  // Reminder steps use negative delays, so the anchor is the appointment itself.
  const enrolled = sequences.enroll(
    { clientId, leadId, trigger: 'appointment', anchorAt: scheduledAt, appointmentId: apptId }, actor);
  return { appointment: db.get('SELECT * FROM appointments WHERE id = ?', apptId), enrolled };
}

function setAppointmentStatus(apptId, status, actor = 'operator') {
  const appt = db.get('SELECT * FROM appointments WHERE id = ?', apptId);
  if (!appt) return null;
  db.update('appointments', apptId, { status, updated_at: nowIso() });
  db.logEvent({ clientId: appt.client_id, entityType: 'appointment', entityId: apptId,
                type: `appointment.${status}`, actor });
  if (['cancelled', 'completed'].includes(status)) {
    const enr = db.get(
      "SELECT id FROM enrollments WHERE appointment_id = ? AND status = 'active'", apptId);
    if (enr) sequences.stop(enr.id, 'stopped_manual', actor);
  }
  return db.get('SELECT * FROM appointments WHERE id = ?', apptId);
}

/** Record a won job with no prior estimate (e.g. a phone booking that closed). */
function recordJob({ clientId, leadId, amount, wonAt = null }, actor = 'operator') {
  const now = nowIso();
  const jobId = id('job');
  db.insert('jobs', {
    id: jobId, client_id: clientId, lead_id: leadId, estimate_id: null,
    amount: Number(amount || 0), won_at: wonAt || now, attributed: 0,
    attribution_reason: 'not_evaluated', created_at: now,
  });
  leads.setStatus(leadId, 'won', actor, { jobId });
  sequences.stopAllForLead(leadId, 'stopped_won', actor);
  const attribution = roi.evaluateJob(jobId);
  return { job: db.get('SELECT * FROM jobs WHERE id = ?', jobId), attribution };
}

const listEstimates = (clientId, status = null) => (status
  ? db.all(`SELECT e.*, l.name AS lead_name, l.phone AS lead_phone FROM estimates e
              JOIN leads l ON l.id = e.lead_id
             WHERE e.client_id = ? AND e.status = ? ORDER BY e.sent_at DESC`, clientId, status)
  : db.all(`SELECT e.*, l.name AS lead_name, l.phone AS lead_phone FROM estimates e
              JOIN leads l ON l.id = e.lead_id
             WHERE e.client_id = ? ORDER BY e.sent_at DESC`, clientId));

const listAppointments = (clientId) => db.all(
  `SELECT a.*, l.name AS lead_name, l.phone AS lead_phone FROM appointments a
     JOIN leads l ON l.id = a.lead_id
    WHERE a.client_id = ? ORDER BY a.scheduled_at DESC LIMIT 200`, clientId);

const listJobs = (clientId) => db.all(
  `SELECT j.*, l.name AS lead_name FROM jobs j JOIN leads l ON l.id = j.lead_id
    WHERE j.client_id = ? ORDER BY j.won_at DESC LIMIT 200`, clientId);

module.exports = {
  createEstimate, decideEstimate, createAppointment, setAppointmentStatus,
  recordJob, listEstimates, listAppointments, listJobs,
};
