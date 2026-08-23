'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { freshDb, makeClient, makeLead, db, outboundAt, replyAt, jobAt } = require('./helpers');
const roi = require('../src/domain/roi');
const pipeline = require('../src/domain/pipeline');
const leads = require('../src/domain/leads');
const outbox = require('../src/engine/outbox');
const { nowIso } = require('../src/lib/ids');

test.beforeEach(() => freshDb());

// The attribution rule is the commercial core of the product. If it over-claims
// even once, a client spot-checks it, catches us, and churns. These tests exist
// to make over-claiming impossible to ship.

test('does NOT attribute a job when we never messaged the lead', async () => {
  const client = makeClient();
  const lead = await makeLead(client.id);
  const { attribution } = pipeline.recordJob(
    { clientId: client.id, leadId: lead.id, amount: 9000 }, 'test');

  assert.equal(attribution.attributed, false);
  assert.equal(attribution.reason, roi.REASONS.NO_MESSAGE);
});

test('does NOT attribute a job when we messaged but the lead never replied', async () => {
  const client = makeClient();
  const lead = await makeLead(client.id);
  await outbox.queue({ clientId: client.id, leadId: lead.id, channel: 'sms',
                       body: 'Sorry we missed your call.' }, 'test');

  const { attribution } = pipeline.recordJob(
    { clientId: client.id, leadId: lead.id, amount: 9000 }, 'test');

  assert.equal(attribution.attributed, false);
  assert.equal(attribution.reason, roi.REASONS.NO_RESPONSE);
});

test('does NOT attribute a job won BEFORE our first message', async () => {
  const client = makeClient();
  const lead = await makeLead(client.id);

  // The job closed yesterday; our follow-up went out today.
  const yesterday = new Date(Date.now() - 86_400_000).toISOString();
  await outbox.queue({ clientId: client.id, leadId: lead.id, channel: 'sms',
                       body: 'Following up.' }, 'test');
  const { attribution } = pipeline.recordJob(
    { clientId: client.id, leadId: lead.id, amount: 9000, wonAt: yesterday }, 'test');

  assert.equal(attribution.attributed, false);
  assert.equal(attribution.reason, roi.REASONS.NO_MESSAGE,
    'a message sent after the win must not count as having caused it');
});

test('DOES attribute when the full chain exists: we messaged, they replied, then it closed', async () => {
  const client = makeClient();
  const lead = await makeLead(client.id);

  await outboundAt(client.id, lead.id, 72, 'Sorry we missed your call - what do you need?');
  await replyAt(lead.id, 48, 'need a quote on a new AC unit');
  const { attribution } = jobAt(client.id, lead.id, 1, 9000);

  assert.equal(attribution.attributed, true);
  assert.equal(attribution.reason, roi.REASONS.ATTRIBUTED);
  assert.ok(attribution.evidence.outboundAt);
  assert.ok(attribution.evidence.responseAt);
});

test('a reply that arrived BEFORE our message does not create attribution', async () => {
  const client = makeClient();
  const lead = await makeLead(client.id);

  // Lead replies first (e.g. they texted the shop directly).
  await leads.recordResponse({ leadId: lead.id, channel: 'sms', body: 'are you open?' }, 'test');
  // Then our sequence fires.
  await outbox.queue({ clientId: client.id, leadId: lead.id, channel: 'sms',
                       body: 'Following up.' }, 'test');
  const { attribution } = pipeline.recordJob(
    { clientId: client.id, leadId: lead.id, amount: 9000 }, 'test');

  assert.equal(attribution.attributed, false);
  assert.equal(attribution.reason, roi.REASONS.NO_RESPONSE);
});

test('suppressed messages never count as contact for attribution', async () => {
  const client = makeClient();
  const lead = await makeLead(client.id);
  leads.optOut(lead.id, 'test');

  const msg = await outbox.queue({ clientId: client.id, leadId: lead.id, channel: 'sms',
                                   body: 'Following up.' }, 'test');
  assert.equal(msg.status, 'suppressed');

  await leads.recordResponse({ leadId: lead.id, channel: 'sms', body: 'ok fine' }, 'test');
  const { attribution } = pipeline.recordJob(
    { clientId: client.id, leadId: lead.id, amount: 9000 }, 'test');

  assert.equal(attribution.attributed, false, 'a message we never sent cannot have caused a win');
});

test('metrics report attributed and total revenue separately', async () => {
  const client = makeClient();

  // Job A: full chain, should be attributed.
  const leadA = await makeLead(client.id, { phone: '+15125550001', email: 'a@example.test' });
  await outboundAt(client.id, leadA.id, 72, 'hi');
  await replyAt(leadA.id, 48, 'yes please');
  jobAt(client.id, leadA.id, 1, 10_000);

  // Job B: walked in off the street, we never touched it.
  const leadB = await makeLead(client.id, { phone: '+15125550002', email: 'b@example.test' });
  pipeline.recordJob({ clientId: client.id, leadId: leadB.id, amount: 25_000 }, 'test');

  const m = roi.metrics(client.id, 30);
  assert.equal(m.jobs_won, 2);
  assert.equal(m.revenue_total, 35_000);
  assert.equal(m.jobs_attributed, 1);
  assert.equal(m.revenue_attributed, 10_000,
    'the walk-in must not be counted as revenue we recovered');
  assert.equal(m.revenue_to_fee_ratio, Number((10_000 / 1500).toFixed(2)));
});

test('reevaluate corrects attribution when a late reply arrives', async () => {
  const client = makeClient();
  const lead = await makeLead(client.id);
  await outbox.queue({ clientId: client.id, leadId: lead.id, channel: 'sms', body: 'hi' }, 'test');

  const { job, attribution } = pipeline.recordJob(
    { clientId: client.id, leadId: lead.id, amount: 9000 }, 'test');
  assert.equal(attribution.attributed, false);

  // The reply lands afterwards, but before the job's won_at is re-read. Push
  // the win forward so the chain is genuinely ordered, then re-evaluate.
  await leads.recordResponse({ leadId: lead.id, channel: 'sms', body: 'sounds good' }, 'test');
  db.update('jobs', job.id, { won_at: nowIso() });

  const results = roi.reevaluateClient(client.id);
  assert.equal(results[0].attributed, true);
});
