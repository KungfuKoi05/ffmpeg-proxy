'use strict';
/**
 * Seed a realistic demo dataset.
 *
 * This exists for two reasons: tests need fixtures, and a sales demo needs a
 * dashboard with believable numbers on it. Everything here is clearly
 * synthetic - names are obviously fictional and the client is named
 * "DEMO -". We never present seeded data as a real case study.
 */
const db = require('./index');
const auth = require('../lib/auth');
const clients = require('../domain/clients');
const leads = require('../domain/leads');
const pipeline = require('../domain/pipeline');
const sequences = require('../domain/sequences');
const outbox = require('../engine/outbox');
const roi = require('../domain/roi');
const { config } = require('../config');
const { nowIso } = require('../lib/ids');

const daysAgo = (d) => new Date(Date.now() - d * 86_400_000).toISOString();
const hoursAgo = (h) => new Date(Date.now() - h * 3600_000).toISOString();

const FIRST = ['Dana', 'Marcus', 'Priya', 'Tom', 'Alicia', 'Ben', 'Renee', 'Victor',
               'Sofia', 'Chris', 'Nadia', 'Owen', 'Kelly', 'Ravi', 'Jules', 'Maren'];
const LAST = ['Okafor', 'Whitfield', 'Raman', 'Delgado', 'Byrne', 'Castellano',
              'Nguyen', 'Achebe', 'Lindqvist', 'Moreau', 'Sandoval', 'Petrov'];
const INTENTS = [
  { text: 'AC stopped cooling upstairs, house is 85 degrees', value: 8500 },
  { text: 'need a quote on replacing the whole system', value: 12500 },
  { text: 'furnace making a grinding noise', value: 1800 },
  { text: 'how much for a new heat pump?', value: 11000 },
  { text: 'no heat at all, its 40 degrees inside', value: 6200 },
  { text: 'want pricing on a mini split for the garage', value: 5400 },
  { text: 'annual maintenance, you did our install last year', value: 320 },
  { text: 'do you work on commercial rooftop units?', value: 0 },
  { text: 'ductwork replacement estimate', value: 9800 },
  { text: 'thermostat not responding', value: 450 },
];

let counter = 0;
const phone = () => `+1512555${String(1000 + (counter += 1)).slice(-4)}`;
const pick = (arr, i) => arr[i % arr.length];

async function seed() {
  db.open();
  const operator = auth.ensureOperator();
  process.stdout.write(`operator account: ${operator.email}\n`);

  if (db.get("SELECT id FROM clients WHERE name LIKE 'DEMO%' LIMIT 1")) {
    process.stdout.write('demo client already exists - skipping seed\n');
    return;
  }

  const client = clients.create({
    name: 'DEMO - Ridgeline Heating & Air',
    industry: 'hvac',
    timezone: 'America/Chicago',
    phone: '+15125550100',
    email: 'office@example-ridgeline.test',
    website: 'https://example-ridgeline.test',
    automation_mode: 'TEST',
    avg_job_value: 9500,
    close_rate: 0.3,
    monthly_fee: 1500,
    status: 'active',
    services: ['AC repair', 'AC replacement', 'Furnace repair', 'Heat pump install', 'Ductwork'],
    booking_method: 'phone',
    booking_url: 'https://example-ridgeline.test/book',
    brand_voice: 'Straight-talking, no upsell pressure. Texas friendly, never corporate.',
    signature: 'Ridgeline Heating & Air',
    escalation: { urgent_to: '+15125550100', after_hours: 'text owner' },
    extra: { review_url: 'https://example-ridgeline.test/review' },
  }, 'seed');
  process.stdout.write(`created client ${client.id}\n`);

  auth.createUser({ email: 'demo-client@example.test', password: 'demo-client-pw',
                    role: 'client', clientId: client.id });

  // ---- leads across the funnel -------------------------------------------
  const created = [];
  for (let i = 0; i < 34; i += 1) {
    const intent = pick(INTENTS, i);
    const age = 1 + (i % 26);
    const { lead } = await leads.capture({
      client_id: client.id,
      name: `${pick(FIRST, i)} ${pick(LAST, i * 3)}`,
      phone: phone(),
      email: `lead${i}@example.test`,
      source: pick(['missed_call', 'web_form', 'missed_call', 'referral', 'google_lsa'], i),
      intent_note: intent.text,
      estimated_value: intent.value,
      consent_sms: i % 3 !== 0,
      consent_source: i % 3 !== 0 ? 'web_form_checkbox' : null,
    }, 'seed');
    db.update('leads', lead.id, { created_at: daysAgo(age), updated_at: daysAgo(age) });
    created.push({ lead, intent, age });
  }

  // ---- simulate the follow-up history ------------------------------------
  // Rather than fabricate message rows directly, drive the real outbox so the
  // seeded data exercises exactly the code path production uses.
  for (let i = 0; i < created.length; i += 1) {
    const { lead, intent, age } = created[i];
    const trigger = lead.source === 'missed_call' ? 'missed_call' : 'new_lead';
    sequences.enroll({ clientId: client.id, leadId: lead.id, trigger,
                       anchorAt: daysAgo(age) }, 'seed');

    // First outbound touch for most leads.
    if (i % 7 !== 0) {
      const msg = await outbox.queue({
        clientId: client.id, leadId: lead.id, channel: 'sms',
        body: `Hi ${lead.name.split(' ')[0]}, this is Ridgeline Heating & Air - sorry we missed your call. What can we help with? Reply STOP to opt out.`,
      }, 'seed');
      db.update('messages', msg.id, { created_at: daysAgo(age), sent_at: daysAgo(age - 0.01),
                                      updated_at: daysAgo(age) });
    }

    // Roughly a third reply.
    if (i % 3 === 1) {
      await leads.recordResponse({ leadId: lead.id, channel: 'sms',
        body: intent.text }, 'seed');
      db.run(`UPDATE messages SET created_at = ? WHERE lead_id = ? AND direction = 'inbound'`,
             daysAgo(age - 0.2), lead.id);
      db.update('leads', lead.id, { first_response_at: daysAgo(age - 0.2),
                                    last_response_at: daysAgo(age - 0.2) });
    }

    // Some of the repliers get an estimate.
    if (i % 3 === 1 && intent.value > 3000) {
      const { estimate } = pipeline.createEstimate({
        clientId: client.id, leadId: lead.id, amount: intent.value,
        description: intent.text, sentAt: daysAgo(Math.max(1, age - 1)),
      }, 'seed');

      // Of those, a few close - and only those with a real reply chain will
      // pass attribution, which is the honest outcome we want to show.
      if (i % 9 === 1) {
        pipeline.decideEstimate(estimate.id, 'won', {}, 'seed');
        db.run('UPDATE jobs SET won_at = ?, created_at = ? WHERE lead_id = ?',
               daysAgo(Math.max(0, age - 3)), daysAgo(Math.max(0, age - 3)), lead.id);
      } else if (i % 9 === 4) {
        pipeline.decideEstimate(estimate.id, 'lost', { lostReason: 'went with a cheaper bid' }, 'seed');
      }
    }

    // A couple of appointments in the near future.
    if (i % 11 === 2) {
      pipeline.createAppointment({
        clientId: client.id, leadId: lead.id,
        scheduledAt: new Date(Date.now() + (1 + (i % 5)) * 86_400_000).toISOString(),
      }, 'seed');
    }

    // One opt-out, so the suppression path is visible in the demo.
    if (i === 5) {
      await leads.recordResponse({ leadId: lead.id, channel: 'sms', body: 'STOP' }, 'seed');
    }
  }

  // Attribution must be recomputed after the timestamps were rewritten above.
  roi.reevaluateClient(client.id);

  // ---- our own sales pipeline --------------------------------------------
  const prospects = require('../domain/prospects');
  const seedProspects = [
    { business_name: 'DEMO - Hill Country Roofing', industry: 'roofing', city: 'Austin', state: 'TX',
      rating: 4.7, review_count: 143, stage: 'contacted',
      signals: { high_ticket_trade: true, no_web_form: true, slow_or_no_response: true,
                 many_reviews: true, owner_answers_phone: true, runs_paid_ads: true } },
    { business_name: 'DEMO - Brightline HVAC', industry: 'hvac', city: 'Round Rock', state: 'TX',
      rating: 4.2, review_count: 88, stage: 'researched',
      signals: { high_ticket_trade: true, no_online_booking: true, many_reviews: true,
                 review_mentions_no_callback: true } },
    { business_name: 'DEMO - Cedar Park Remodeling', industry: 'remodeling', city: 'Cedar Park', state: 'TX',
      rating: 4.9, review_count: 41, stage: 'new',
      signals: { high_ticket_trade: true, no_web_form: true, owner_answers_phone: true } },
  ];
  for (const p of seedProspects) prospects.create(p, 'seed');

  const m = roi.metrics(client.id, 30);
  process.stdout.write(
    `\nseeded 30-day snapshot for ${client.name}:\n` +
    `  leads received      ${m.leads_received}\n` +
    `  contacted           ${m.leads_contacted}\n` +
    `  responded           ${m.leads_responded}  (${m.response_rate}%)\n` +
    `  estimates sent      ${m.estimates_sent}  ($${m.estimates_value.toLocaleString()})\n` +
    `  jobs won            ${m.jobs_won}  ($${m.revenue_total.toLocaleString()})\n` +
    `  ATTRIBUTED          ${m.jobs_attributed}  ($${m.revenue_attributed.toLocaleString()})\n` +
    `  revenue-to-fee      ${m.revenue_to_fee_ratio}x\n` +
    `\nlogin: ${config.adminEmail} / (ADMIN_PASSWORD)\n` +
    `client login: demo-client@example.test / demo-client-pw\n`);
}

if (require.main === module) {
  seed().then(() => process.exit(0)).catch((err) => {
    process.stderr.write(`seed failed: ${err.stack}\n`); process.exit(1);
  });
}

module.exports = { seed };
