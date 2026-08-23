'use strict';
const db = require('../db');
const { nowIso } = require('../lib/ids');

// ---------------------------------------------------------------------------
// ATTRIBUTION
//
// This is the number the client pays us for, so the rule is deliberately
// conservative and fully auditable. We would rather under-claim and keep the
// account than over-claim and lose it at the first spot-check.
//
// A job is attributed to Closeloop only when this exact chain exists:
//
//   1. we actually delivered an outbound message to that lead
//      (status 'sent'; 'simulated' also counts in TEST so demos are coherent,
//       and is labelled as such), AND
//   2. the lead sent an inbound message AFTER that outbound message, AND
//   3. the job was won at or after that inbound response.
//
// Everything else is recorded with a reason and counted as NOT attributed.
// Both numbers are shown to the client side by side.
// ---------------------------------------------------------------------------
const REASONS = {
  ATTRIBUTED: 'attributed_followup_then_response_then_win',
  NO_MESSAGE: 'not_attributed_no_outbound_message',
  NO_RESPONSE: 'not_attributed_no_response_after_outbound',
  WON_FIRST: 'not_attributed_won_before_our_first_contact',
};

function evaluateJob(jobId) {
  const job = db.get('SELECT * FROM jobs WHERE id = ?', jobId);
  if (!job) return null;

  const firstOutbound = db.get(
    `SELECT * FROM messages
      WHERE lead_id = ? AND direction = 'outbound' AND status IN ('sent','simulated')
        AND sent_at IS NOT NULL AND sent_at <= ?
      ORDER BY sent_at ASC LIMIT 1`, job.lead_id, job.won_at);

  if (!firstOutbound) return finalise(job, false, REASONS.NO_MESSAGE);

  const responseAfter = db.get(
    `SELECT * FROM messages
      WHERE lead_id = ? AND direction = 'inbound' AND created_at > ? AND created_at <= ?
      ORDER BY created_at ASC LIMIT 1`, job.lead_id, firstOutbound.sent_at, job.won_at);

  if (!responseAfter) return finalise(job, false, REASONS.NO_RESPONSE);
  if (job.won_at < responseAfter.created_at) return finalise(job, false, REASONS.WON_FIRST);

  return finalise(job, true, REASONS.ATTRIBUTED, {
    outboundAt: firstOutbound.sent_at,
    responseAt: responseAfter.created_at,
    simulated: firstOutbound.status === 'simulated',
  });
}

function finalise(job, attributed, reason, evidence = null) {
  db.update('jobs', job.id, {
    attributed: attributed ? 1 : 0,
    attribution_reason: reason,
  });
  db.logEvent({
    clientId: job.client_id, entityType: 'job', entityId: job.id,
    type: attributed ? 'job.attributed' : 'job.not_attributed',
    data: { reason, amount: job.amount, evidence },
  });
  return { jobId: job.id, attributed, reason, evidence };
}

/** Re-evaluate every job for a client. Cheap, and keeps reports honest after
 *  a late-arriving inbound message changes the picture. */
function reevaluateClient(clientId) {
  const jobs = db.all('SELECT id FROM jobs WHERE client_id = ?', clientId);
  return jobs.map((j) => evaluateJob(j.id));
}

// ---------------------------------------------------------------------------
// METRICS
// ---------------------------------------------------------------------------
const since = (days) => new Date(Date.now() - days * 86_400_000).toISOString();
const num = (row, key = 'n') => (row && row[key] != null ? Number(row[key]) : 0);

/**
 * The full metric set behind /dashboard and the monthly ROI report.
 * `days` scopes every count to a rolling window.
 */
function metrics(clientId, days = 30) {
  const from = since(days);
  const client = db.get('SELECT * FROM clients WHERE id = ?', clientId);
  if (!client) return null;

  const leadsReceived = num(db.get(
    'SELECT COUNT(*) n FROM leads WHERE client_id = ? AND created_at >= ?', clientId, from));

  const leadsContacted = num(db.get(
    `SELECT COUNT(DISTINCT lead_id) n FROM messages
      WHERE client_id = ? AND direction = 'outbound'
        AND status IN ('sent','simulated') AND created_at >= ?`, clientId, from));

  const leadsResponded = num(db.get(
    `SELECT COUNT(DISTINCT lead_id) n FROM messages
      WHERE client_id = ? AND direction = 'inbound' AND created_at >= ?`, clientId, from));

  const appointments = num(db.get(
    'SELECT COUNT(*) n FROM appointments WHERE client_id = ? AND created_at >= ?', clientId, from));

  const appointmentsCompleted = num(db.get(
    `SELECT COUNT(*) n FROM appointments WHERE client_id = ? AND status = 'completed'
       AND created_at >= ?`, clientId, from));

  const estRow = db.get(
    `SELECT COUNT(*) n, COALESCE(SUM(amount),0) total FROM estimates
      WHERE client_id = ? AND sent_at >= ?`, clientId, from);
  const estOpen = db.get(
    `SELECT COUNT(*) n, COALESCE(SUM(amount),0) total FROM estimates
      WHERE client_id = ? AND status = 'open'`, clientId);
  const estWon = db.get(
    `SELECT COUNT(*) n, COALESCE(SUM(amount),0) total FROM estimates
      WHERE client_id = ? AND status = 'won' AND decided_at >= ?`, clientId, from);
  const estLost = db.get(
    `SELECT COUNT(*) n FROM estimates WHERE client_id = ? AND status = 'lost' AND decided_at >= ?`,
    clientId, from);

  const jobsAll = db.get(
    `SELECT COUNT(*) n, COALESCE(SUM(amount),0) total FROM jobs
      WHERE client_id = ? AND won_at >= ?`, clientId, from);
  const jobsAttributed = db.get(
    `SELECT COUNT(*) n, COALESCE(SUM(amount),0) total FROM jobs
      WHERE client_id = ? AND attributed = 1 AND won_at >= ?`, clientId, from);

  const messagesSent = num(db.get(
    `SELECT COUNT(*) n FROM messages WHERE client_id = ? AND direction = 'outbound'
       AND status IN ('sent','simulated') AND created_at >= ?`, clientId, from));
  const messagesFailed = num(db.get(
    `SELECT COUNT(*) n FROM messages WHERE client_id = ? AND status = 'failed'
       AND created_at >= ?`, clientId, from));
  const messagesSuppressed = num(db.get(
    `SELECT COUNT(*) n FROM messages WHERE client_id = ? AND status = 'suppressed'
       AND created_at >= ?`, clientId, from));
  const pendingApproval = num(db.get(
    `SELECT COUNT(*) n FROM messages WHERE client_id = ? AND status = 'pending_approval'`, clientId));

  // Median minutes from lead creation to our first outbound touch. This is the
  // single operational number that best predicts whether follow-up works.
  const responseTimes = db.all(
    `SELECT l.created_at AS lead_at, MIN(m.sent_at) AS first_touch
       FROM leads l JOIN messages m ON m.lead_id = l.id
      WHERE l.client_id = ? AND l.created_at >= ? AND m.direction = 'outbound'
        AND m.status IN ('sent','simulated') AND m.sent_at IS NOT NULL
      GROUP BY l.id`, clientId, from)
    .map((r) => (new Date(r.first_touch) - new Date(r.lead_at)) / 60000)
    .filter((v) => Number.isFinite(v) && v >= 0)
    .sort((a, b) => a - b);
  const medianResponseMinutes = responseTimes.length
    ? Number(responseTimes[Math.floor(responseTimes.length / 2)].toFixed(1)) : null;

  const pct = (a, b) => (b > 0 ? Number(((a / b) * 100).toFixed(1)) : 0);
  const attributedRevenue = num(jobsAttributed, 'total');
  const fee = Number(client.monthly_fee || 0);
  // Window-adjusted fee, so a 90-day view isn't compared against one month.
  const feeForWindow = fee * (days / 30);

  return {
    window_days: days,
    generated_at: nowIso(),
    client: { id: client.id, name: client.name, monthly_fee: fee, automation_mode: client.automation_mode },

    leads_received: leadsReceived,
    leads_contacted: leadsContacted,
    leads_responded: leadsResponded,
    appointments_booked: appointments,
    appointments_completed: appointmentsCompleted,

    estimates_sent: num(estRow), estimates_value: num(estRow, 'total'),
    estimates_open: num(estOpen), estimates_open_value: num(estOpen, 'total'),
    estimates_won: num(estWon), estimates_won_value: num(estWon, 'total'),
    estimates_lost: num(estLost),

    jobs_won: num(jobsAll), revenue_total: num(jobsAll, 'total'),
    jobs_attributed: num(jobsAttributed), revenue_attributed: attributedRevenue,

    contact_rate: pct(leadsContacted, leadsReceived),
    response_rate: pct(leadsResponded, leadsContacted),
    lead_to_job_rate: pct(num(jobsAll), leadsReceived),
    estimate_close_rate: pct(num(estWon), num(estRow)),
    median_first_touch_minutes: medianResponseMinutes,

    messages_sent: messagesSent,
    messages_failed: messagesFailed,
    messages_suppressed: messagesSuppressed,
    messages_pending_approval: pendingApproval,
    automation_success_rate: pct(messagesSent, messagesSent + messagesFailed),

    cost: Number(feeForWindow.toFixed(2)),
    // Revenue-to-fee, NOT profit. The client's own margin is theirs to apply.
    revenue_to_fee_ratio: feeForWindow > 0
      ? Number((attributedRevenue / feeForWindow).toFixed(2)) : null,
    net_revenue_attributed: Number((attributedRevenue - feeForWindow).toFixed(2)),

    disclaimer: 'Revenue attributed reflects jobs where a Closeloop follow-up was ' +
      'delivered, the customer replied afterwards, and the job was then won. It is ' +
      'attributed revenue, not profit. Apply your own gross margin to judge return.',
  };
}

/** Portfolio view for /analytics: our business, not a client's. */
function businessMetrics() {
  const active = db.all("SELECT * FROM clients WHERE status IN ('active','trial')");
  const paying = active.filter((c) => Number(c.monthly_fee) > 0 && c.status === 'active');
  const mrr = paying.reduce((sum, c) => sum + Number(c.monthly_fee || 0), 0);
  const churned = db.all("SELECT * FROM clients WHERE status = 'churned'");

  const perClient = active.map((c) => {
    const m = metrics(c.id, 30);
    return {
      id: c.id, name: c.name, status: c.status, mode: c.automation_mode,
      monthly_fee: Number(c.monthly_fee || 0),
      leads: m.leads_received, responded: m.leads_responded,
      revenue_attributed: m.revenue_attributed,
      ratio: m.revenue_to_fee_ratio,
      // A client whose ratio sits under 2x is a churn risk long before they say so.
      churn_risk: churnRisk(c, m),
    };
  });

  const pipeline = db.all(
    `SELECT stage, COUNT(*) n FROM prospects GROUP BY stage`);

  return {
    generated_at: nowIso(),
    mrr,
    customers_paying: paying.length,
    customers_total: active.length,
    churned: churned.length,
    churn_rate: active.length + churned.length > 0
      ? Number(((churned.length / (active.length + churned.length)) * 100).toFixed(1)) : 0,
    arpu: paying.length ? Number((mrr / paying.length).toFixed(2)) : 0,
    target_mrr: 10000,
    progress_pct: Number(((mrr / 10000) * 100).toFixed(1)),
    clients_needed_at_arpu: paying.length && mrr > 0
      ? Math.max(0, Math.ceil((10000 - mrr) / (mrr / paying.length))) : null,
    per_client: perClient,
    pipeline: Object.fromEntries(pipeline.map((r) => [r.stage, Number(r.n)])),
  };
}

function churnRisk(client, m) {
  if (client.status === 'trial') return 'trial';
  if (Number(client.monthly_fee) === 0) return 'unpriced';
  if (m.revenue_to_fee_ratio === null) return 'unknown';
  if (m.revenue_to_fee_ratio >= 3) return 'low';
  if (m.revenue_to_fee_ratio >= 1.5) return 'medium';
  return 'high';
}

module.exports = { evaluateJob, reevaluateClient, metrics, businessMetrics, REASONS };
