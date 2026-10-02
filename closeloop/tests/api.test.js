'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { freshDb, makeClient, db, setGlobalMode } = require('./helpers');
const auth = require('../src/lib/auth');

// Boot a real HTTP server on an ephemeral port and talk to it over the wire.
// Unit tests can pass while the routing, auth or serialisation layer is broken,
// so at least one suite has to exercise the whole thing.
let server; let base;

test.before(async () => {
  freshDb();
  setGlobalMode('TEST');
  const { createServer } = require('../src/server');
  server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => { server?.close(); });

async function call(method, path, { body, cookie } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON response */ }
  return { status: res.status, json, text, cookie: res.headers.get('set-cookie') };
}

async function loginAs(email, password) {
  const res = await call('POST', '/login', { body: { email, password } });
  assert.equal(res.status, 200, `login failed for ${email}: ${res.text}`);
  return res.cookie.split(';')[0];
}

test('health is public and reports the automation mode', async () => {
  const res = await call('GET', '/health');
  assert.equal(res.status, 200);
  assert.equal(res.json.ok, true);
  assert.equal(res.json.mode, 'TEST');
});

test('the API rejects unauthenticated requests', async () => {
  const res = await call('GET', '/api/clients');
  assert.equal(res.status, 401);
});

test('login with a bad password fails', async () => {
  const res = await call('POST', '/login', {
    body: { email: 'operator@test.local', password: 'wrong' } });
  assert.equal(res.status, 401);
});

test('an operator can log in and read their session', async () => {
  const cookie = await loginAs('operator@test.local', 'operator-test-pw');
  const res = await call('GET', '/api/me', { cookie });
  assert.equal(res.status, 200);
  assert.equal(res.json.user.role, 'operator');
  assert.equal(res.json.automation_mode, 'TEST');
  assert.equal(res.json.providers.sms.effective, 'mock');
});

test('a forged session cookie is rejected', async () => {
  const res = await call('GET', '/api/clients', { cookie: 'cl_session=abc.def' });
  assert.equal(res.status, 401);
});

test('a session with a tampered payload is rejected', async () => {
  const cookie = await loginAs('operator@test.local', 'operator-test-pw');
  const token = cookie.replace('cl_session=', '');
  const [payload, sig] = token.split('.');
  const forged = Buffer.from(JSON.stringify({
    uid: 'usr_attacker', role: 'operator', exp: Date.now() + 100000,
  })).toString('base64url');
  const res = await call('GET', '/api/clients', { cookie: `cl_session=${forged}.${sig}` });
  assert.equal(res.status, 401, 'a re-signed payload must not be accepted');
});

test('full lifecycle: onboard a client, capture a lead, quote it, win it, report ROI', async () => {
  const cookie = await loginAs('operator@test.local', 'operator-test-pw');

  const onboard = await call('POST', '/api/onboard', { cookie, body: {
    name: 'Lifecycle Roofing', industry: 'roofing', avg_job_value: 14_000,
    monthly_fee: 1500, timezone: 'UTC', quiet_start_hour: 0, quiet_end_hour: 0,
    services: ['Roof replacement', 'Repairs'],
  }});
  assert.equal(onboard.status, 201);
  const clientId = onboard.json.client.id;
  assert.equal(onboard.json.client.automation_mode, 'TEST', 'new clients must start in TEST');
  assert.equal(onboard.json.sequences.length, 6);

  const leadRes = await call('POST', '/api/leads', { cookie, body: {
    client_id: clientId, name: 'Priya Raman', phone: '+15125557777',
    email: 'priya@example.test', message: 'need a quote to replace my roof',
    consent_sms: true,
  }});
  assert.equal(leadRes.status, 201);
  assert.equal(leadRes.json.classification.label, 'ESTIMATE');
  const leadId = leadRes.json.lead.id;

  const estRes = await call('POST', '/api/estimates', { cookie, body: {
    client_id: clientId, lead_id: leadId, amount: 18_500, description: 'full tear-off and replace',
  }});
  assert.equal(estRes.status, 201);
  const estimateId = estRes.json.estimate.id;

  // Simulate the customer replying to our follow-up.
  await call('POST', `/api/leads/${leadId}/reply`, { cookie, body: {
    body: 'yes, when could you start?' }});

  const decided = await call('POST', `/api/estimates/${estimateId}/decide`, {
    cookie, body: { outcome: 'won' } });
  assert.equal(decided.status, 200);

  const report = await call('GET', `/api/roi-report?client_id=${clientId}`, { cookie });
  assert.equal(report.status, 200);
  assert.equal(report.json.jobs_won, 1);
  assert.equal(report.json.revenue_total, 18_500);
  assert.ok(report.json.disclaimer.includes('not profit'));
});

test('a client user cannot read another client\'s data', async () => {
  const cookie = await loginAs('operator@test.local', 'operator-test-pw');
  const mine = makeClient({ name: 'Tenant A' });
  const theirs = makeClient({ name: 'Tenant B' });
  auth.createUser({ email: 'tenant-a@test.local', password: 'tenant-a-pw',
                    role: 'client', clientId: mine.id });

  const clientCookie = await loginAs('tenant-a@test.local', 'tenant-a-pw');

  // Explicitly ask for the other tenant. The server must ignore the parameter.
  const leaked = await call('GET', `/api/leads?client_id=${theirs.id}`, { cookie: clientCookie });
  assert.equal(leaked.status, 200);
  const list = await call('GET', '/api/clients', { cookie: clientCookie });
  assert.equal(list.json.clients.length, 1);
  assert.equal(list.json.clients[0].id, mine.id);

  const direct = await call('GET', `/api/clients/${theirs.id}`, { cookie: clientCookie });
  assert.equal(direct.status, 403, 'direct access to another tenant must be forbidden');
});

test('a client user cannot reach operator-only endpoints', async () => {
  const clientCookie = await loginAs('tenant-a@test.local', 'tenant-a-pw');
  for (const path of ['/api/analytics', '/api/prospects', '/api/logs']) {
    const res = await call('GET', path, { cookie: clientCookie });
    assert.equal(res.status, 403, `${path} should be operator-only`);
  }
  const tick = await call('POST', '/api/engine/tick', { cookie: clientCookie });
  assert.equal(tick.status, 403);
});

test('automation_mode is validated', async () => {
  const cookie = await loginAs('operator@test.local', 'operator-test-pw');
  const client = makeClient();
  const res = await call('PATCH', `/api/clients/${client.id}`, {
    cookie, body: { automation_mode: 'YOLO' } });
  assert.equal(res.status, 400);
});

test('the public ROI calculator needs no auth and labels its output as an estimate', async () => {
  const res = await call('POST', '/api/public/roi', { body: {
    monthly_calls: 200, missed_call_pct: 30, avg_job_value: 12_000,
    close_rate: 30, estimates_per_month: 20, estimate_close_rate: 25 }});
  assert.equal(res.status, 200);
  assert.ok(res.json.potential_recovered_revenue_monthly > 0);
  assert.match(res.json.disclaimer, /ESTIMATES/);
  assert.ok(!('guarantee' in res.json));
});

test('the ROI calculator handles empty and nonsense input without crashing', async () => {
  const empty = await call('POST', '/api/public/roi', { body: {} });
  assert.equal(empty.status, 200);
  assert.equal(empty.json.potential_recovered_revenue_monthly, 0);

  const junk = await call('POST', '/api/public/roi', { body: {
    monthly_calls: -500, missed_call_pct: 9999, avg_job_value: 'abc' }});
  assert.equal(junk.status, 200);
  assert.ok(junk.json.potential_recovered_revenue_monthly >= 0);
});

test('a missed-call webhook creates a lead and starts recovery', async () => {
  const cookie = await loginAs('operator@test.local', 'operator-test-pw');
  const client = makeClient({ name: 'Webhook Test Co', timezone: 'UTC',
                              quiet_start_hour: 0, quiet_end_hour: 0 });

  const res = await call('POST', '/webhooks/missed-call', { body: {
    client_id: client.id, from: '+15125558888', duration: 0 }});
  assert.equal(res.status, 201);
  assert.equal(res.json.created, true);
  assert.equal(res.json.enrolled.enrolled, true);

  // The same caller ringing again must not create a second lead.
  const again = await call('POST', '/webhooks/missed-call', { body: {
    client_id: client.id, from: '(512) 555-8888' }});
  assert.equal(again.json.created, false);
});

test('a webhook for an unknown client is rejected', async () => {
  const res = await call('POST', '/webhooks/missed-call', { body: {
    client_id: 'cli_does_not_exist', from: '+15125550000' }});
  assert.equal(res.status, 404);
});

test('an inbound STOP via webhook opts the lead out', async () => {
  const client = makeClient({ name: 'Optout Test Co' });
  await call('POST', '/webhooks/missed-call', { body: {
    client_id: client.id, from: '+15125559999' }});

  const res = await call('POST', '/webhooks/sms-reply', { body: {
    From: '+15125559999', Body: 'STOP' }});
  assert.equal(res.status, 200);
  assert.equal(res.json.opted_out, true);

  const lead = db.get('SELECT * FROM leads WHERE phone LIKE ?', '%5559999');
  assert.equal(lead.opted_out, 1);
});

test('a demo request from the marketing site lands in the sales pipeline', async () => {
  const res = await call('POST', '/api/public/demo-request', { body: {
    business_name: 'Inbound Roofing Co', email: 'owner@inbound-example.test',
    message: 'saw your calculator, want to talk' }});
  assert.equal(res.status, 201);

  const cookie = await loginAs('operator@test.local', 'operator-test-pw');
  const list = await call('GET', '/api/prospects', { cookie });
  const found = list.json.prospects.find((p) => p.business_name === 'Inbound Roofing Co');
  assert.ok(found, 'the inbound request should appear in the pipeline');
  assert.equal(found.stage, 'replied');
});

test('malformed JSON returns 400, not a stack trace', async () => {
  const res = await fetch(`${base}/api/public/roi`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{not json' });
  assert.equal(res.status, 400);
  const text = await res.text();
  assert.ok(!text.includes('at Object.'), 'internals must not leak to the client');
});

test('an oversized body is rejected', async () => {
  const res = await fetch(`${base}/api/public/roi`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ monthly_calls: 1, junk: 'x'.repeat(50_000) }) });
  assert.equal(res.status, 413);
});

test('static file serving refuses directory traversal', async () => {
  for (const attack of ['/../package.json', '/../../etc/passwd',
                        '/%2e%2e%2fpackage.json', '/..%2f..%2fetc%2fpasswd']) {
    const res = await fetch(`${base}${attack}`, { redirect: 'manual' });
    const text = await res.text();
    assert.ok(!text.includes('"name": "closeloop"'),
      `${attack} leaked package.json`);
    assert.ok(!text.includes('root:x:'), `${attack} leaked /etc/passwd`);
  }
});

test('security headers are set on every response', async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
});

test('an unknown route returns a clean 404', async () => {
  const res = await call('GET', '/api/does-not-exist');
  assert.equal(res.status, 401, 'unknown API paths still require auth first');
  const cookie = await loginAs('operator@test.local', 'operator-test-pw');
  const authed = await call('GET', '/api/does-not-exist', { cookie });
  assert.equal(authed.status, 404);
});

test('logout clears the session', async () => {
  const cookie = await loginAs('operator@test.local', 'operator-test-pw');
  const res = await call('POST', '/logout', { cookie });
  assert.equal(res.status, 200);
  assert.match(res.cookie, /Max-Age=0/);
});
