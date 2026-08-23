'use strict';
// Every test file gets its own in-memory database. node:test runs each file
// in a separate process, so the db singleton is naturally isolated per file.
process.env.AUTOMATION_MODE = process.env.AUTOMATION_MODE || 'TEST';
process.env.SESSION_SECRET = 'test-secret-not-used-in-production';
process.env.ADMIN_EMAIL = 'operator@test.local';
process.env.ADMIN_PASSWORD = 'operator-test-pw';

const db = require('../src/db');

function freshDb() {
  db.close();
  db.open(':memory:');
  // Production always boots with an operator account (server.start does this).
  // Creating it here keeps tests faithful to a real instance.
  require('../src/lib/auth').ensureOperator();
  return db;
}

const clients = require('../src/domain/clients');

function makeClient(overrides = {}) {
  return clients.create({
    name: 'Test HVAC Co',
    industry: 'hvac',
    timezone: 'UTC',
    avg_job_value: 9000,
    monthly_fee: 1500,
    status: 'active',
    // Wide-open quiet hours by default so time-of-day never makes a test flaky.
    quiet_start_hour: 0,
    quiet_end_hour: 0,
    ...overrides,
  }, 'test');
}

const leads = require('../src/domain/leads');

async function makeLead(clientId, overrides = {}) {
  const { lead } = await leads.capture({
    client_id: clientId,
    name: 'Dana Okafor',
    phone: '+15125550123',
    email: 'dana@example.test',
    source: 'missed_call',
    consent_sms: true,
    ...overrides,
  }, 'test');
  return lead;
}

module.exports = { freshDb, makeClient, makeLead, db };

// ---------------------------------------------------------------------------
// Deterministic event chains.
//
// Attribution depends on strict ordering (outbound -> reply -> win). In
// production those are minutes or days apart; in a test they would all land in
// the same millisecond and make ordering assertions flaky. These helpers write
// explicit timestamps so ordering is decided by the test, not the clock.
// ---------------------------------------------------------------------------
const outbox = require('../src/engine/outbox');
const pipeline = require('../src/domain/pipeline');
const leadsDomain = require('../src/domain/leads');

const hoursAgo = (h) => new Date(Date.now() - h * 3600_000).toISOString();

/** Queue an outbound message and stamp it at a fixed point in the past. */
async function outboundAt(clientId, leadId, hoursBack, body = 'test follow-up') {
  const msg = await outbox.queue({ clientId, leadId, channel: 'sms', body }, 'test');
  const at = hoursAgo(hoursBack);
  db.update('messages', msg.id, { created_at: at, sent_at: at, updated_at: at });
  return db.get('SELECT * FROM messages WHERE id = ?', msg.id);
}

/** Record an inbound reply and stamp it at a fixed point in the past. */
async function replyAt(leadId, hoursBack, body = 'yes, please send a quote') {
  const result = await leadsDomain.recordResponse({ leadId, channel: 'sms', body }, 'test');
  const at = hoursAgo(hoursBack);
  db.run(`UPDATE messages SET created_at = ? WHERE lead_id = ? AND direction = 'inbound'
            AND created_at = (SELECT MAX(created_at) FROM messages
                               WHERE lead_id = ? AND direction = 'inbound')`,
         at, leadId, leadId);
  db.update('leads', leadId, { last_response_at: at });
  return result;
}

/** Record a won job at a fixed point in the past, then run attribution. */
function jobAt(clientId, leadId, hoursBack, amount) {
  return pipeline.recordJob({ clientId, leadId, amount, wonAt: hoursAgo(hoursBack) }, 'test');
}

module.exports.outboundAt = outboundAt;
module.exports.replyAt = replyAt;
module.exports.jobAt = jobAt;
module.exports.hoursAgo = hoursAgo;

/**
 * Raise or lower the GLOBAL automation ceiling for a test file.
 *
 * The global mode caps every client, so a test exercising per-client ASSISTED
 * or LIVE behaviour must first open the ceiling. Doing this explicitly keeps
 * the ceiling semantics visible rather than quietly working around them.
 */
function setGlobalMode(mode) {
  const { config } = require('../src/config');
  const previous = config.automationMode;
  config.automationMode = mode;
  return () => { config.automationMode = previous; };
}
module.exports.setGlobalMode = setGlobalMode;
