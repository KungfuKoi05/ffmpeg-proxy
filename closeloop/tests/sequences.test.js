'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { freshDb, makeClient, makeLead, db, setGlobalMode } = require('./helpers');
const sequences = require('../src/domain/sequences');
const scheduler = require('../src/engine/scheduler');
const pipeline = require('../src/domain/pipeline');
const leads = require('../src/domain/leads');

test.beforeEach(() => { freshDb(); setGlobalMode('TEST'); });

test('render fills tokens and reports the ones it could not', () => {
  const { text, missing } = sequences.render(
    'Hi {{first_name}}, this is {{business}}. {{nope}}',
    { first_name: 'Dana', business: 'Acme HVAC' });
  assert.equal(text, 'Hi Dana, this is Acme HVAC.');
  assert.deepEqual(missing, ['nope']);
});

test('render never leaks a raw token to a customer', () => {
  const { text } = sequences.render('Your quote {{amount}} is ready', {});
  assert.ok(!text.includes('{{'), 'a customer must never see template syntax');
});

test('a new client gets the full default sequence set', () => {
  const client = makeClient();
  const list = sequences.listForClient(client.id);
  const triggers = list.map((s) => s.trigger).sort();
  assert.deepEqual(triggers, ['appointment', 'estimate_sent', 'missed_call',
                              'new_lead', 'reactivation', 'review_request']);
});

test('reactivation is disabled by default', () => {
  const client = makeClient();
  const reactivation = sequences.listForClient(client.id).find((s) => s.trigger === 'reactivation');
  assert.equal(reactivation.enabled, 0,
    'messaging a past-customer list must be a deliberate, explicit decision');
});

test('the estimate sequence is 4 touches over 14 days', () => {
  const client = makeClient();
  const seq = sequences.findByTrigger(client.id, 'estimate_sent');
  const steps = sequences.stepsFor(seq.id);
  assert.equal(steps.length, 4);
  assert.deepEqual(steps.map((s) => s.delay_hours), [24, 72, 168, 336]);
});

test('every SMS sequence opens with an opt-out notice', () => {
  const client = makeClient();
  for (const seq of sequences.listForClient(client.id)) {
    const steps = sequences.stepsFor(seq.id);
    const firstSms = steps.find((s) => s.channel === 'sms');
    if (!firstSms) continue;
    if (seq.trigger === 'appointment') continue;   // transactional reminder, not marketing
    assert.match(firstSms.template, /STOP/i,
      `${seq.trigger}: the first SMS must carry an opt-out`);
  }
});

test('a lead is not enrolled twice in the same sequence', async () => {
  const client = makeClient();
  const lead = await makeLead(client.id);
  const first = sequences.enroll({ clientId: client.id, leadId: lead.id, trigger: 'missed_call' }, 'test');
  const second = sequences.enroll({ clientId: client.id, leadId: lead.id, trigger: 'missed_call' }, 'test');
  assert.equal(first.enrolled, true);
  assert.equal(second.enrolled, false);
  assert.equal(second.reason, 'already_enrolled');
});

test('a disabled sequence does not enroll', async () => {
  const client = makeClient();
  const seq = sequences.findByTrigger(client.id, 'missed_call');
  sequences.setEnabled(seq.id, false, 'test');
  const lead = await makeLead(client.id);
  const result = sequences.enroll({ clientId: client.id, leadId: lead.id, trigger: 'missed_call' }, 'test');
  assert.equal(result.enrolled, false);
  assert.equal(result.reason, 'no_enabled_sequence');
});

test('the scheduler steps a due enrollment and schedules the next one', async () => {
  const client = makeClient();
  const lead = await makeLead(client.id);
  // Anchor in the past so step 0 is already due.
  sequences.enroll({ clientId: client.id, leadId: lead.id, trigger: 'missed_call',
                     anchorAt: new Date(Date.now() - 3600_000).toISOString() }, 'test');

  const result = await scheduler.tick();
  assert.equal(result.enrollments.length, 1);
  assert.equal(result.enrollments[0].action, 'stepped');
  assert.equal(result.enrollments[0].messageStatus, 'simulated');

  const enrollment = db.get('SELECT * FROM enrollments WHERE lead_id = ?', lead.id);
  assert.equal(enrollment.next_step, 1);
  assert.ok(enrollment.next_run_at, 'the next touch must be scheduled');
});

test('the scheduler does not fire a step before it is due', async () => {
  const client = makeClient();
  const lead = await makeLead(client.id);
  sequences.enroll({ clientId: client.id, leadId: lead.id, trigger: 'estimate_sent',
                     anchorAt: new Date().toISOString() }, 'test');
  const result = await scheduler.tick();
  assert.equal(result.enrollments.length, 0, 'step 0 is +24h, nothing should fire yet');
});

test('the scheduler completes a sequence after its last step', async () => {
  const client = makeClient();
  const lead = await makeLead(client.id);
  const seq = sequences.findByTrigger(client.id, 'review_request'); // single step
  sequences.enroll({ clientId: client.id, leadId: lead.id, trigger: 'review_request',
                     anchorAt: new Date(Date.now() - 48 * 3600_000).toISOString() }, 'test');

  await scheduler.tick();
  const enrollment = db.get('SELECT * FROM enrollments WHERE sequence_id = ?', seq.id);
  assert.equal(enrollment.status, 'completed');
  assert.equal(enrollment.next_run_at, null);
});

test('a suppressed step does not wedge the rest of the sequence', async () => {
  const client = makeClient();
  // No phone, so every SMS step suppresses; the email step should still run.
  const lead = await makeLead(client.id, { phone: null, email: 'dana@example.test' });
  sequences.enroll({ clientId: client.id, leadId: lead.id, trigger: 'estimate_sent',
                     anchorAt: new Date(Date.now() - 100 * 3600_000).toISOString() }, 'test');

  await scheduler.tick();  // step 0, sms -> suppressed
  await scheduler.tick();  // step 1, email -> simulated

  const statuses = db.all(
    'SELECT channel, status FROM messages WHERE lead_id = ? ORDER BY created_at', lead.id);
  assert.equal(statuses[0].status, 'suppressed');
  assert.equal(statuses[1].channel, 'email');
  assert.equal(statuses[1].status, 'simulated');
});

test('winning a job stops outstanding follow-up', async () => {
  const client = makeClient();
  const lead = await makeLead(client.id);
  const { estimate } = pipeline.createEstimate(
    { clientId: client.id, leadId: lead.id, amount: 9000 }, 'test');
  pipeline.decideEstimate(estimate.id, 'won', {}, 'test');

  const stillChasing = db.all(
    `SELECT e.* FROM enrollments e JOIN sequences s ON s.id = e.sequence_id
      WHERE e.lead_id = ? AND e.status = 'active' AND s.trigger = 'estimate_sent'`, lead.id);
  assert.equal(stillChasing.length, 0, 'we must not keep chasing a customer who already bought');
});

test('creating an estimate enrolls the lead in the follow-up sequence', async () => {
  const client = makeClient();
  const lead = await makeLead(client.id);
  const { enrolled } = pipeline.createEstimate(
    { clientId: client.id, leadId: lead.id, amount: 12_000, description: 'new heat pump' }, 'test');
  assert.equal(enrolled.enrolled, true);
  assert.equal(leads.getById(lead.id).status, 'estimate');
  assert.equal(leads.getById(lead.id).estimated_value, 12_000);
});

test('appointment reminders are scheduled BEFORE the appointment', async () => {
  const client = makeClient();
  const lead = await makeLead(client.id);
  const when = new Date(Date.now() + 72 * 3600_000).toISOString();
  const { enrolled } = pipeline.createAppointment(
    { clientId: client.id, leadId: lead.id, scheduledAt: when }, 'test');
  assert.equal(enrolled.enrolled, true);
  assert.ok(new Date(enrolled.firstRun) < new Date(when),
    'a reminder that fires after the appointment is useless');
});

test('templateVars renders a real estimate follow-up end to end', async () => {
  const client = makeClient({ name: 'Ridgeline Heating' });
  const lead = await makeLead(client.id, { name: 'Dana Okafor' });
  const { estimate } = pipeline.createEstimate(
    { clientId: client.id, leadId: lead.id, amount: 12_500, description: 'full system swap' }, 'test');
  const enrollment = db.get('SELECT * FROM enrollments WHERE estimate_id = ?', estimate.id);

  const vars = scheduler.templateVars(enrollment);
  const seq = sequences.findByTrigger(client.id, 'estimate_sent');
  const step = sequences.stepsFor(seq.id)[0];
  const { text } = sequences.render(step.template, vars);

  assert.match(text, /Dana/);
  assert.match(text, /Ridgeline Heating/);
  assert.match(text, /full system swap/);
  assert.ok(!text.includes('{{'));
});
