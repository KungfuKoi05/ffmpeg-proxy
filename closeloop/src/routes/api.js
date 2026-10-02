'use strict';
const db = require('../db');
const { config, MODES } = require('../config');
const H = require('../lib/http');
const auth = require('../lib/auth');
const clients = require('../domain/clients');
const leads = require('../domain/leads');
const pipeline = require('../domain/pipeline');
const sequences = require('../domain/sequences');
const prospects = require('../domain/prospects');
const roi = require('../domain/roi');
const outbox = require('../engine/outbox');
const scheduler = require('../engine/scheduler');
const providers = require('../providers');

/**
 * Resolve which client the caller may act on.
 *
 * Operators may pass ?client_id=. Client users are pinned to their own client
 * and cannot widen it - this is the tenant boundary, enforced in one place.
 */
function scopeClient(session, url) {
  if (session.role === 'client') return session.clientId;
  return url.searchParams.get('client_id') || null;
}

function requireClient(session, url, res) {
  const clientId = scopeClient(session, url);
  if (!clientId) { H.badRequest(res, 'client_id required'); return null; }
  if (session.role === 'client' && clientId !== session.clientId) {
    H.forbidden(res, 'cross-tenant access denied'); return null;
  }
  if (!clients.getById(clientId)) { H.notFound(res, 'client not found'); return null; }
  return clientId;
}

const operatorOnly = (session, res) => {
  if (session.role !== 'operator') { H.forbidden(res, 'operator role required'); return false; }
  return true;
};

function register(router) {
  // ---- session -----------------------------------------------------------
  router.get('/api/me', async (req, res, ctx) =>
    H.ok(res, { user: { id: ctx.session.uid, role: ctx.session.role, clientId: ctx.session.clientId },
                automation_mode: config.automationMode,
                providers: providers.status(),
                warnings: config.warnings }));

  // ---- clients -----------------------------------------------------------
  router.get('/api/clients', async (req, res, ctx) => {
    if (ctx.session.role === 'client') {
      const c = clients.getById(ctx.session.clientId);
      return H.ok(res, { clients: c ? [c] : [] });
    }
    return H.ok(res, { clients: clients.list() });
  });

  router.post('/api/clients', async (req, res, ctx) => {
    if (!operatorOnly(ctx.session, res)) return;
    const body = await H.readBody(req);
    if (!body.name) return H.badRequest(res, 'name is required');
    const client = clients.create(body, ctx.session.uid);
    return H.created(res, { client, config: clients.getConfig(client.id) });
  });

  router.get('/api/clients/:id', async (req, res, ctx) => {
    const clientId = ctx.params.id;
    if (ctx.session.role === 'client' && clientId !== ctx.session.clientId) return H.forbidden(res);
    const client = clients.getById(clientId);
    if (!client) return H.notFound(res, 'client not found');
    return H.ok(res, {
      client,
      config: clients.getConfig(clientId),
      effective_mode: clients.modeFor(client),
      sequences: sequences.listForClient(clientId).map((s) => ({ ...s, steps: sequences.stepsFor(s.id) })),
    });
  });

  router.patch('/api/clients/:id', async (req, res, ctx) => {
    if (!operatorOnly(ctx.session, res)) return;
    const body = await H.readBody(req);
    if (body.automation_mode && !MODES.includes(body.automation_mode)) {
      return H.badRequest(res, `automation_mode must be one of ${MODES.join(', ')}`);
    }
    const client = clients.update(ctx.params.id, body, ctx.session.uid);
    if (body.config) clients.updateConfig(ctx.params.id, body.config, ctx.session.uid);
    return H.ok(res, { client, config: clients.getConfig(ctx.params.id) });
  });

  // ---- onboarding --------------------------------------------------------
  // One call that takes the intake form and produces a ready-to-run client.
  router.post('/api/onboard', async (req, res, ctx) => {
    if (!operatorOnly(ctx.session, res)) return;
    const body = await H.readBody(req);
    const required = ['name', 'industry', 'avg_job_value'];
    const missing = required.filter((k) => body[k] === undefined || body[k] === '');
    if (missing.length) return H.badRequest(res, 'missing required fields', missing);

    const client = clients.create({ ...body, automation_mode: 'TEST', status: 'trial' }, ctx.session.uid);
    let user = null;
    if (body.login_email && body.login_password) {
      user = auth.createUser({ email: body.login_email, password: body.login_password,
                               role: 'client', clientId: client.id });
    }
    return H.created(res, {
      client,
      config: clients.getConfig(client.id),
      sequences: sequences.listForClient(client.id).map((s) => ({ ...s, steps: sequences.stepsFor(s.id) })),
      user,
      next_steps: [
        'Review and edit the default follow-up copy under Sequences.',
        'Import or connect a lead source (webhook, CSV, or manual entry).',
        'Run in TEST for a few days and read every simulated message.',
        'Move to ASSISTED so a human approves each send.',
        'Only then consider LIVE, and only with SMS consent recorded.',
      ],
    });
  });

  // ---- leads -------------------------------------------------------------
  router.get('/api/leads', async (req, res, ctx) => {
    const clientId = requireClient(ctx.session, ctx.url, res); if (!clientId) return;
    return H.ok(res, { leads: leads.list(clientId, {
      status: ctx.url.searchParams.get('status'),
      search: ctx.url.searchParams.get('q'),
      limit: Math.min(500, Number(ctx.url.searchParams.get('limit') || 200)),
    }) });
  });

  router.post('/api/leads', async (req, res, ctx) => {
    const body = await H.readBody(req);
    const clientId = ctx.session.role === 'client' ? ctx.session.clientId : body.client_id;
    if (!clientId) return H.badRequest(res, 'client_id required');
    if (!body.phone && !body.email) return H.badRequest(res, 'phone or email required');
    const result = await leads.capture({ ...body, client_id: clientId }, ctx.session.uid);

    // A manually-entered lead still enters the new-lead sequence, so the
    // dashboard reflects what would actually happen in production.
    let enrolled = null;
    if (result.created && body.enroll !== false) {
      enrolled = sequences.enroll({ clientId, leadId: result.lead.id, trigger: 'new_lead' }, ctx.session.uid);
    }
    return H.created(res, { ...result, enrolled });
  });

  router.get('/api/leads/:id', async (req, res, ctx) => {
    const lead = leads.getById(ctx.params.id);
    if (!lead) return H.notFound(res, 'lead not found');
    if (ctx.session.role === 'client' && lead.client_id !== ctx.session.clientId) return H.forbidden(res);
    return H.ok(res, {
      lead,
      timeline: leads.timeline(lead.id),
      messages: db.all('SELECT * FROM messages WHERE lead_id = ? ORDER BY created_at DESC', lead.id),
      enrollments: db.all(
        `SELECT e.*, s.name AS sequence_name FROM enrollments e
           JOIN sequences s ON s.id = e.sequence_id WHERE e.lead_id = ?`, lead.id),
      estimates: db.all('SELECT * FROM estimates WHERE lead_id = ? ORDER BY sent_at DESC', lead.id),
    });
  });

  router.patch('/api/leads/:id', async (req, res, ctx) => {
    const lead = leads.getById(ctx.params.id);
    if (!lead) return H.notFound(res, 'lead not found');
    if (ctx.session.role === 'client' && lead.client_id !== ctx.session.clientId) return H.forbidden(res);
    const body = await H.readBody(req);
    if (body.status) leads.setStatus(lead.id, body.status, ctx.session.uid);
    if (body.opt_out) leads.optOut(lead.id, ctx.session.uid);
    const patch = {};
    for (const k of ['name', 'phone', 'email', 'notes', 'estimated_value']) {
      if (body[k] !== undefined) patch[k] = body[k];
    }
    if (body.consent_sms !== undefined) {
      patch.consent_sms = body.consent_sms ? 1 : 0;
      patch.consent_source = body.consent_source || 'operator_recorded';
    }
    if (Object.keys(patch).length) db.update('leads', lead.id, { ...patch, updated_at: new Date().toISOString() });
    return H.ok(res, { lead: leads.getById(lead.id) });
  });

  // Simulate an inbound reply. Essential for demos and for QA in TEST mode.
  router.post('/api/leads/:id/reply', async (req, res, ctx) => {
    const lead = leads.getById(ctx.params.id);
    if (!lead) return H.notFound(res, 'lead not found');
    if (ctx.session.role === 'client' && lead.client_id !== ctx.session.clientId) return H.forbidden(res);
    const body = await H.readBody(req);
    if (!body.body) return H.badRequest(res, 'body is required');
    const result = await leads.recordResponse(
      { leadId: lead.id, channel: body.channel || 'sms', body: body.body }, ctx.session.uid);
    return H.ok(res, result);
  });

  // ---- estimates / appointments / jobs ------------------------------------
  router.get('/api/estimates', async (req, res, ctx) => {
    const clientId = requireClient(ctx.session, ctx.url, res); if (!clientId) return;
    return H.ok(res, { estimates: pipeline.listEstimates(clientId, ctx.url.searchParams.get('status')) });
  });

  router.post('/api/estimates', async (req, res, ctx) => {
    const body = await H.readBody(req);
    const clientId = ctx.session.role === 'client' ? ctx.session.clientId : body.client_id;
    if (!clientId || !body.lead_id) return H.badRequest(res, 'client_id and lead_id required');
    const result = pipeline.createEstimate({
      clientId, leadId: body.lead_id, amount: body.amount,
      description: body.description, sentAt: body.sent_at }, ctx.session.uid);
    return H.created(res, result);
  });

  router.post('/api/estimates/:id/decide', async (req, res, ctx) => {
    const body = await H.readBody(req);
    if (!['won', 'lost'].includes(body.outcome)) return H.badRequest(res, 'outcome must be won or lost');
    const est = db.get('SELECT * FROM estimates WHERE id = ?', ctx.params.id);
    if (!est) return H.notFound(res, 'estimate not found');
    if (ctx.session.role === 'client' && est.client_id !== ctx.session.clientId) return H.forbidden(res);
    const result = pipeline.decideEstimate(ctx.params.id, body.outcome,
      { lostReason: body.lost_reason, amount: body.amount }, ctx.session.uid);
    return H.ok(res, result);
  });

  router.get('/api/appointments', async (req, res, ctx) => {
    const clientId = requireClient(ctx.session, ctx.url, res); if (!clientId) return;
    return H.ok(res, { appointments: pipeline.listAppointments(clientId) });
  });

  router.post('/api/appointments', async (req, res, ctx) => {
    const body = await H.readBody(req);
    const clientId = ctx.session.role === 'client' ? ctx.session.clientId : body.client_id;
    if (!clientId || !body.lead_id || !body.scheduled_at) {
      return H.badRequest(res, 'client_id, lead_id and scheduled_at required');
    }
    return H.created(res, pipeline.createAppointment({
      clientId, leadId: body.lead_id, scheduledAt: body.scheduled_at, kind: body.kind }, ctx.session.uid));
  });

  router.patch('/api/appointments/:id', async (req, res, ctx) => {
    const body = await H.readBody(req);
    const appt = pipeline.setAppointmentStatus(ctx.params.id, body.status, ctx.session.uid);
    if (!appt) return H.notFound(res, 'appointment not found');
    return H.ok(res, { appointment: appt });
  });

  router.get('/api/jobs', async (req, res, ctx) => {
    const clientId = requireClient(ctx.session, ctx.url, res); if (!clientId) return;
    return H.ok(res, { jobs: pipeline.listJobs(clientId) });
  });

  router.post('/api/jobs', async (req, res, ctx) => {
    const body = await H.readBody(req);
    const clientId = ctx.session.role === 'client' ? ctx.session.clientId : body.client_id;
    if (!clientId || !body.lead_id) return H.badRequest(res, 'client_id and lead_id required');
    return H.created(res, pipeline.recordJob(
      { clientId, leadId: body.lead_id, amount: body.amount, wonAt: body.won_at }, ctx.session.uid));
  });

  // ---- sequences ---------------------------------------------------------
  router.get('/api/sequences', async (req, res, ctx) => {
    const clientId = requireClient(ctx.session, ctx.url, res); if (!clientId) return;
    return H.ok(res, { sequences: sequences.listForClient(clientId)
      .map((s) => ({ ...s, steps: sequences.stepsFor(s.id) })) });
  });

  router.patch('/api/sequences/:id', async (req, res, ctx) => {
    if (!operatorOnly(ctx.session, res)) return;
    const body = await H.readBody(req);
    if (body.enabled !== undefined) sequences.setEnabled(ctx.params.id, body.enabled, ctx.session.uid);
    return H.ok(res, { sequence: db.get('SELECT * FROM sequences WHERE id = ?', ctx.params.id) });
  });

  router.patch('/api/sequence-steps/:id', async (req, res, ctx) => {
    const body = await H.readBody(req);
    const step = sequences.updateStep(ctx.params.id, body, ctx.session.uid);
    if (!step) return H.badRequest(res, 'nothing to update');
    return H.ok(res, { step });
  });

  // Preview rendered copy against a real lead without queueing anything.
  router.post('/api/sequences/preview', async (req, res, ctx) => {
    const body = await H.readBody(req);
    if (!body.template) return H.badRequest(res, 'template required');
    let vars = body.vars || {};
    if (body.lead_id) {
      const lead = leads.getById(body.lead_id);
      if (!lead) return H.notFound(res, 'lead not found');
      if (ctx.session.role === 'client' && lead.client_id !== ctx.session.clientId) return H.forbidden(res);
      vars = scheduler.templateVars({
        lead_id: lead.id, client_id: lead.client_id,
        estimate_id: body.estimate_id || null, appointment_id: null });
    }
    return H.ok(res, { rendered: sequences.render(body.template, vars), vars });
  });

  // ---- approvals (ASSISTED mode) -----------------------------------------
  router.get('/api/approvals', async (req, res, ctx) => {
    const clientId = ctx.session.role === 'client' ? ctx.session.clientId
      : ctx.url.searchParams.get('client_id');
    return H.ok(res, { pending: outbox.pendingApprovals(clientId) });
  });

  router.post('/api/approvals/:id/approve', async (req, res, ctx) => {
    const body = await H.readBody(req);
    const msg = db.get('SELECT * FROM messages WHERE id = ?', ctx.params.id);
    if (!msg) return H.notFound(res, 'message not found');
    if (ctx.session.role === 'client' && msg.client_id !== ctx.session.clientId) return H.forbidden(res);
    const result = await outbox.approve(ctx.params.id, ctx.session.uid, body.body);
    return result.ok ? H.ok(res, result) : H.badRequest(res, result.error);
  });

  router.post('/api/approvals/:id/reject', async (req, res, ctx) => {
    const body = await H.readBody(req);
    const msg = db.get('SELECT * FROM messages WHERE id = ?', ctx.params.id);
    if (!msg) return H.notFound(res, 'message not found');
    if (ctx.session.role === 'client' && msg.client_id !== ctx.session.clientId) return H.forbidden(res);
    const result = outbox.reject(ctx.params.id, ctx.session.uid, body.reason);
    return result.ok ? H.ok(res, result) : H.badRequest(res, result.error);
  });

  // ---- metrics -----------------------------------------------------------
  router.get('/api/metrics', async (req, res, ctx) => {
    const clientId = requireClient(ctx.session, ctx.url, res); if (!clientId) return;
    const days = Math.min(365, Number(ctx.url.searchParams.get('days') || 30));
    return H.ok(res, roi.metrics(clientId, days));
  });

  router.get('/api/roi-report', async (req, res, ctx) => {
    const clientId = requireClient(ctx.session, ctx.url, res); if (!clientId) return;
    const days = Math.min(365, Number(ctx.url.searchParams.get('days') || 30));
    roi.reevaluateClient(clientId);   // refresh attribution before reporting
    const m = roi.metrics(clientId, days);
    return H.ok(res, {
      ...m,
      attributed_jobs: db.all(
        `SELECT j.*, l.name AS lead_name FROM jobs j JOIN leads l ON l.id = j.lead_id
          WHERE j.client_id = ? AND j.attributed = 1 ORDER BY j.won_at DESC`, clientId),
      unattributed_jobs: db.all(
        `SELECT j.*, l.name AS lead_name FROM jobs j JOIN leads l ON l.id = j.lead_id
          WHERE j.client_id = ? AND j.attributed = 0 ORDER BY j.won_at DESC`, clientId),
    });
  });

  router.get('/api/analytics', async (req, res, ctx) => {
    if (!operatorOnly(ctx.session, res)) return;
    return H.ok(res, roi.businessMetrics());
  });

  // ---- sales pipeline (operator only) ------------------------------------
  router.get('/api/prospects', async (req, res, ctx) => {
    if (!operatorOnly(ctx.session, res)) return;
    return H.ok(res, {
      prospects: prospects.list({
        stage: ctx.url.searchParams.get('stage'),
        minScore: Number(ctx.url.searchParams.get('min_score') || 0) }),
      due: prospects.dueForFollowup(),
      signal_weights: prospects.SIGNAL_WEIGHTS,
    });
  });

  router.post('/api/prospects', async (req, res, ctx) => {
    if (!operatorOnly(ctx.session, res)) return;
    const body = await H.readBody(req);
    if (Array.isArray(body.prospects)) {
      return H.created(res, { prospects: body.prospects.map((p) => prospects.create(p, ctx.session.uid)) });
    }
    if (!body.business_name) return H.badRequest(res, 'business_name required');
    return H.created(res, { prospect: prospects.create(body, ctx.session.uid) });
  });

  router.patch('/api/prospects/:id', async (req, res, ctx) => {
    if (!operatorOnly(ctx.session, res)) return;
    const body = await H.readBody(req);
    if (body.signals) prospects.rescore(ctx.params.id, body.signals, ctx.session.uid);
    if (body.stage) {
      const result = prospects.advance(ctx.params.id, body.stage, body.note, ctx.session.uid);
      if (!result.ok) return H.badRequest(res, result.error);
    }
    if (body.notes !== undefined) db.update('prospects', ctx.params.id, { notes: body.notes });
    return H.ok(res, { prospect: prospects.getById(ctx.params.id) });
  });

  // ---- ops ---------------------------------------------------------------
  router.post('/api/engine/tick', async (req, res, ctx) => {
    if (!operatorOnly(ctx.session, res)) return;
    return H.ok(res, await scheduler.tick());
  });

  router.get('/api/logs', async (req, res, ctx) => {
    if (!operatorOnly(ctx.session, res)) return;
    const level = ctx.url.searchParams.get('level');
    return H.ok(res, {
      system: level
        ? db.all('SELECT * FROM system_log WHERE level = ? ORDER BY created_at DESC LIMIT 200', level)
        : db.all('SELECT * FROM system_log ORDER BY created_at DESC LIMIT 200'),
      events: db.all('SELECT * FROM events ORDER BY created_at DESC LIMIT 200'),
      last_tick: db.getSetting('engine.last_tick'),
    });
  });

  router.get('/api/messages', async (req, res, ctx) => {
    const clientId = requireClient(ctx.session, ctx.url, res); if (!clientId) return;
    const status = ctx.url.searchParams.get('status');
    return H.ok(res, { messages: status
      ? db.all(`SELECT m.*, l.name AS lead_name FROM messages m JOIN leads l ON l.id = m.lead_id
                 WHERE m.client_id = ? AND m.status = ? ORDER BY m.created_at DESC LIMIT 300`, clientId, status)
      : db.all(`SELECT m.*, l.name AS lead_name FROM messages m JOIN leads l ON l.id = m.lead_id
                 WHERE m.client_id = ? ORDER BY m.created_at DESC LIMIT 300`, clientId) });
  });
}

module.exports = { register };
