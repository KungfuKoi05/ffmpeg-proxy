'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { freshDb, makeClient, makeLead, db, setGlobalMode } = require('./helpers');
const outbox = require('../src/engine/outbox');
const leads = require('../src/domain/leads');
const providers = require('../src/providers');
const clients = require('../src/domain/clients');

// The global ceiling caps every client, so open it here and let each test set
// the per-client mode it is actually exercising.
test.beforeEach(() => { freshDb(); setGlobalMode('LIVE'); });

// These tests encode the promises made in docs/security.md. If any of them
// fails, the system can spend money or message a stranger without permission.

test('TEST mode simulates and never transmits', async () => {
  const client = makeClient({ automation_mode: 'TEST' });
  const lead = await makeLead(client.id);
  const msg = await outbox.queue({ clientId: client.id, leadId: lead.id,
                                   channel: 'sms', body: 'hello' }, 'test');
  assert.equal(msg.status, 'simulated');
  assert.equal(msg.provider, 'simulator');
});

test('OFF mode suppresses everything', async () => {
  const client = makeClient({ automation_mode: 'OFF' });
  const lead = await makeLead(client.id);
  const msg = await outbox.queue({ clientId: client.id, leadId: lead.id,
                                   channel: 'sms', body: 'hello' }, 'test');
  assert.equal(msg.status, 'suppressed');
  assert.equal(msg.suppress_reason, 'automation_off');
});

test('ASSISTED mode parks the message and does NOT send it', async () => {
  const client = makeClient({ automation_mode: 'ASSISTED' });
  const lead = await makeLead(client.id);
  const msg = await outbox.queue({ clientId: client.id, leadId: lead.id,
                                   channel: 'sms', body: 'hello' }, 'test');
  assert.equal(msg.status, 'pending_approval');
  assert.equal(msg.sent_at, null);
});

test('dispatch REFUSES a message that has not been approved', async () => {
  const client = makeClient({ automation_mode: 'ASSISTED' });
  const lead = await makeLead(client.id);
  const msg = await outbox.queue({ clientId: client.id, leadId: lead.id,
                                   channel: 'sms', body: 'hello' }, 'test');

  // Attempt to bypass the human. This is the attack the whole mode exists to stop.
  const after = await outbox.dispatch(msg.id, 'attacker');
  assert.equal(after.status, 'pending_approval', 'unapproved message must not be dispatched');
  assert.equal(after.sent_at, null);
});

test('approving in ASSISTED mode sends it and records who approved', async () => {
  const client = makeClient({ automation_mode: 'ASSISTED' });
  const lead = await makeLead(client.id);
  const msg = await outbox.queue({ clientId: client.id, leadId: lead.id,
                                   channel: 'sms', body: 'hello' }, 'test');
  const result = await outbox.approve(msg.id, 'operator-1');
  assert.equal(result.ok, true);
  assert.equal(result.message.status, 'sent');
  assert.equal(result.message.approved_by, 'operator-1');
});

test('a human can edit copy at approval time', async () => {
  const client = makeClient({ automation_mode: 'ASSISTED' });
  const lead = await makeLead(client.id);
  const msg = await outbox.queue({ clientId: client.id, leadId: lead.id,
                                   channel: 'sms', body: 'original' }, 'test');
  const result = await outbox.approve(msg.id, 'operator-1', 'edited by a human');
  assert.equal(result.message.body, 'edited by a human');
});

test('rejecting a message stops it permanently', async () => {
  const client = makeClient({ automation_mode: 'ASSISTED' });
  const lead = await makeLead(client.id);
  const msg = await outbox.queue({ clientId: client.id, leadId: lead.id,
                                   channel: 'sms', body: 'hello' }, 'test');
  outbox.reject(msg.id, 'operator-1', 'wrong tone');

  const after = await outbox.dispatch(msg.id, 'system');
  assert.equal(after.status, 'rejected');
  assert.equal(after.sent_at, null);
});

test('an opted-out lead is never messaged again', async () => {
  const client = makeClient({ automation_mode: 'LIVE' });
  const lead = await makeLead(client.id);
  await leads.recordResponse({ leadId: lead.id, channel: 'sms', body: 'STOP' }, 'test');

  const msg = await outbox.queue({ clientId: client.id, leadId: lead.id,
                                   channel: 'sms', body: 'one more thing' }, 'test');
  assert.equal(msg.status, 'suppressed');
  assert.equal(msg.suppress_reason, 'lead_opted_out');
});

test('opting out between approval and dispatch still blocks the send', async () => {
  const client = makeClient({ automation_mode: 'ASSISTED' });
  const lead = await makeLead(client.id);
  const msg = await outbox.queue({ clientId: client.id, leadId: lead.id,
                                   channel: 'sms', body: 'hello' }, 'test');
  db.update('messages', msg.id, { status: 'approved', approved_by: 'operator-1' });

  // The customer texts STOP in the window between approval and send.
  leads.optOut(lead.id, 'test');

  const after = await outbox.dispatch(msg.id, 'system');
  assert.equal(after.status, 'suppressed');
  assert.equal(after.suppress_reason, 'lead_opted_out_before_send');
});

test('LIVE SMS is blocked without recorded consent', async () => {
  const client = makeClient({ automation_mode: 'LIVE' });
  const lead = await makeLead(client.id, { consent_sms: false });
  const msg = await outbox.queue({ clientId: client.id, leadId: lead.id,
                                   channel: 'sms', body: 'hello' }, 'test');
  assert.equal(msg.status, 'suppressed');
  assert.equal(msg.suppress_reason, 'no_sms_consent');
});

test('a message with an unrendered template token is never sent', async () => {
  const client = makeClient({ automation_mode: 'LIVE' });
  const lead = await makeLead(client.id);
  const msg = await outbox.queue({ clientId: client.id, leadId: lead.id, channel: 'sms',
                                   body: 'Hi {{first_name}}, your quote is ready' }, 'test');
  assert.equal(msg.status, 'suppressed');
  assert.equal(msg.suppress_reason, 'unrendered_template');
});

test('a paid provider is downgraded to mock outside LIVE mode', () => {
  // Pretend Twilio is fully configured.
  const twilio = providers.REGISTRY.sms.twilio;
  const originalIsConfigured = twilio.isConfigured;
  twilio.isConfigured = () => true;
  try {
    for (const mode of ['OFF', 'TEST', 'ASSISTED']) {
      const { provider, downgradedFrom } = providers.resolveForSend('sms', mode, 'twilio');
      assert.equal(provider.name, 'mock', `${mode} must not reach a paid provider`);
      assert.equal(downgradedFrom, 'twilio');
      assert.equal(provider.costsMoney, false);
    }
    const live = providers.resolveForSend('sms', 'LIVE', 'twilio');
    assert.equal(live.provider.name, 'twilio', 'LIVE with credentials should use the real provider');
  } finally {
    twilio.isConfigured = originalIsConfigured;
  }
});

test('an unconfigured paid provider falls back to mock rather than failing', () => {
  const resolved = providers.resolve('sms', 'twilio');
  assert.equal(resolved.name, 'mock');
  assert.equal(resolved.costsMoney, false);
});

test('the global mode is a ceiling a client cannot exceed', () => {
  const client = makeClient({ automation_mode: 'LIVE' });
  const { config } = require('../src/config');
  const original = config.automationMode;
  config.automationMode = 'TEST';
  try {
    assert.equal(clients.modeFor(client), 'TEST',
      'a client set to LIVE must still be capped by a global TEST');
  } finally {
    config.automationMode = original;
  }
});

test('the per-client daily send cap holds', async () => {
  const client = makeClient({ automation_mode: 'TEST' });
  const lead = await makeLead(client.id);
  const { config } = require('../src/config');
  const original = config.engine.maxSendsPerClientPerDay;
  config.engine.maxSendsPerClientPerDay = 3;
  try {
    const statuses = [];
    for (let i = 0; i < 5; i += 1) {
      const msg = await outbox.queue({ clientId: client.id, leadId: lead.id,
                                       channel: 'sms', body: `message ${i}` }, 'test');
      statuses.push(msg.status);
    }
    assert.deepEqual(statuses.slice(0, 3), ['simulated', 'simulated', 'simulated']);
    assert.equal(statuses[3], 'suppressed');
    assert.equal(statuses[4], 'suppressed');
  } finally {
    config.engine.maxSendsPerClientPerDay = original;
  }
});

test('quiet hours defer a LIVE send instead of dropping it', async () => {
  // Quiet from 00:00 to 23:59 UTC - effectively always quiet.
  const client = makeClient({ automation_mode: 'LIVE', timezone: 'UTC',
                              quiet_start_hour: 0, quiet_end_hour: 23 });
  const lead = await makeLead(client.id, { consent_sms: true });
  const msg = await outbox.queue({ clientId: client.id, leadId: lead.id,
                                   channel: 'sms', body: 'hello' }, 'test');
  assert.equal(msg.status, 'draft');
  assert.equal(msg.suppress_reason, 'quiet_hours');
  assert.ok(msg.scheduled_for, 'a deferred message must carry a retry time');
});

test('quiet hours do NOT hold back a simulated TEST message', async () => {
  const client = makeClient({ automation_mode: 'TEST', timezone: 'UTC',
                              quiet_start_hour: 0, quiet_end_hour: 23 });
  const lead = await makeLead(client.id);
  const msg = await outbox.queue({ clientId: client.id, leadId: lead.id,
                                   channel: 'sms', body: 'hello' }, 'test');
  assert.equal(msg.status, 'simulated',
    'nothing transmits in TEST, so the operator should see the copy immediately');
});

test('a message with no destination address is suppressed, not sent blindly', async () => {
  const client = makeClient({ automation_mode: 'TEST' });
  const lead = await makeLead(client.id, { phone: null, email: 'x@example.test' });
  const msg = await outbox.queue({ clientId: client.id, leadId: lead.id,
                                   channel: 'sms', body: 'hello' }, 'test');
  assert.equal(msg.status, 'suppressed');
  assert.equal(msg.suppress_reason, 'no_sms_address');
});
