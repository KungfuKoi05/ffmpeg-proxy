'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { freshDb, makeClient, makeLead, db } = require('./helpers');
const leads = require('../src/domain/leads');
const sequences = require('../src/domain/sequences');
const rules = require('../src/providers/ai/mock');

test.beforeEach(() => freshDb());

test('the same phone number in different formats dedupes to one lead', async () => {
  const client = makeClient();
  const a = await leads.capture({ client_id: client.id, phone: '(512) 555-0123',
                                  name: 'Dana' }, 'test');
  const b = await leads.capture({ client_id: client.id, phone: '+15125550123',
                                  name: 'Dana O' }, 'test');
  assert.equal(a.created, true);
  assert.equal(b.created, false, 'inflated lead counts would corrupt every metric we report');
  assert.equal(a.lead.id, b.lead.id);
});

test('recapture fills in blanks without overwriting existing data', async () => {
  const client = makeClient();
  const a = await leads.capture({ client_id: client.id, phone: '+15125550123',
                                  name: 'Dana' }, 'test');
  await leads.capture({ client_id: client.id, phone: '+15125550123',
                        name: 'Someone Else', email: 'dana@example.test' }, 'test');
  const after = leads.getById(a.lead.id);
  assert.equal(after.name, 'Dana', 'an existing name must not be clobbered');
  assert.equal(after.email, 'dana@example.test', 'a missing field should be filled');
});

test('the same number for two different clients stays two separate leads', async () => {
  const one = makeClient({ name: 'Shop One' });
  const two = makeClient({ name: 'Shop Two' });
  const a = await leads.capture({ client_id: one.id, phone: '+15125550123' }, 'test');
  const b = await leads.capture({ client_id: two.id, phone: '+15125550123' }, 'test');
  assert.notEqual(a.lead.id, b.lead.id, 'tenants must not share leads');
});

test('STOP opts the lead out and halts every sequence', async () => {
  const client = makeClient();
  const lead = await makeLead(client.id);
  sequences.enroll({ clientId: client.id, leadId: lead.id, trigger: 'missed_call' }, 'test');

  await leads.recordResponse({ leadId: lead.id, channel: 'sms', body: 'STOP' }, 'test');

  const after = leads.getById(lead.id);
  assert.equal(after.opted_out, 1);
  assert.equal(after.status, 'dnc');
  const active = db.all("SELECT * FROM enrollments WHERE lead_id = ? AND status = 'active'", lead.id);
  assert.equal(active.length, 0);
});

test('opt-out keywords are matched case-insensitively and with punctuation', async () => {
  const client = makeClient();
  for (const [i, word] of ['stop', 'Stop please', 'UNSUBSCRIBE', 'quit'].entries()) {
    const lead = await makeLead(client.id, { phone: `+1512555${1000 + i}`,
                                             email: `l${i}@example.test` });
    await leads.recordResponse({ leadId: lead.id, channel: 'sms', body: word }, 'test');
    assert.equal(leads.getById(lead.id).opted_out, 1, `"${word}" should opt out`);
  }
});

test('a normal reply stops reply-sensitive sequences but not reminders', async () => {
  const client = makeClient();
  const lead = await makeLead(client.id);
  sequences.enroll({ clientId: client.id, leadId: lead.id, trigger: 'missed_call' }, 'test');
  sequences.enroll({ clientId: client.id, leadId: lead.id, trigger: 'appointment',
                     anchorAt: new Date(Date.now() + 86_400_000).toISOString(),
                     appointmentId: null }, 'test');

  await leads.recordResponse({ leadId: lead.id, channel: 'sms',
                               body: 'yes I need a quote' }, 'test');

  const rows = db.all(
    `SELECT s.trigger, e.status FROM enrollments e JOIN sequences s ON s.id = e.sequence_id
      WHERE e.lead_id = ?`, lead.id);
  const byTrigger = Object.fromEntries(rows.map((r) => [r.trigger, r.status]));
  assert.equal(byTrigger.missed_call, 'stopped_reply');
  assert.equal(byTrigger.appointment, 'active',
    'an appointment reminder must still fire after the customer replies');
});

test('a reply moves the lead to responded and stamps first_response_at once', async () => {
  const client = makeClient();
  const lead = await makeLead(client.id);
  await leads.recordResponse({ leadId: lead.id, channel: 'sms', body: 'hello' }, 'test');
  const first = leads.getById(lead.id).first_response_at;
  assert.ok(first);
  assert.equal(leads.getById(lead.id).status, 'responded');

  await leads.recordResponse({ leadId: lead.id, channel: 'sms', body: 'still here' }, 'test');
  assert.equal(leads.getById(lead.id).first_response_at, first,
    'first_response_at must not move - attribution depends on it');
});

test('lead status never regresses', async () => {
  const client = makeClient();
  const lead = await makeLead(client.id);
  leads.setStatus(lead.id, 'estimate', 'test');
  leads.setStatus(lead.id, 'new', 'test');
  assert.equal(leads.getById(lead.id).status, 'estimate');
});

test('lost and won are allowed as terminal states from anywhere', async () => {
  const client = makeClient();
  const lead = await makeLead(client.id);
  leads.setStatus(lead.id, 'estimate', 'test');
  leads.setStatus(lead.id, 'lost', 'test');
  assert.equal(leads.getById(lead.id).status, 'lost');
});

// --- classification -------------------------------------------------------
test('the rule classifier separates urgent from pricing enquiries', async () => {
  const cases = [
    ['my furnace is out and its 40 degrees in here', 'URGENT'],
    ['how much would a new AC unit cost?', 'ESTIMATE'],
    ['need to schedule a maintenance visit', 'SERVICE_REQUEST'],
    ['you installed our system last year, warranty question', 'EXISTING_CUSTOMER'],
    ['do you service the north side?', 'GENERAL_QUESTION'],
  ];
  for (const [text, expected] of cases) {
    const result = await rules.classifyLead({ text });
    assert.equal(result.label, expected, `"${text}" -> expected ${expected}, got ${result.label}`);
    assert.ok(result.confidence > 0 && result.confidence <= 1);
  }
});

test('unrecognised text is OTHER with low confidence rather than a guess', async () => {
  const result = await rules.classifyLead({ text: 'asdfgh qwerty' });
  assert.equal(result.label, 'OTHER');
  assert.ok(result.confidence < 0.5, 'we must not report false confidence');
});

test('empty input does not crash the classifier', async () => {
  const result = await rules.classifyLead({ text: '' });
  assert.equal(result.label, 'OTHER');
});

test('ambiguous text lowers confidence rather than picking blindly', async () => {
  // Matches both URGENT and ESTIMATE.
  const result = await rules.classifyLead({ text: 'emergency! how much to replace it?' });
  assert.equal(result.label, 'URGENT');
  assert.ok(result.confidence < 0.95, 'competing signals should reduce stated confidence');
});
