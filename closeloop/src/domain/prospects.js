'use strict';
// OUR sales pipeline. Scoring uses only signals observable from the outside
// without contacting the business, so a rep can score a list before outreach.
const db = require('../db');
const { id, nowIso } = require('../lib/ids');

/**
 * Prospect score, 0-100.
 *
 * Weighted toward evidence that the business (a) has demand it is failing to
 * capture and (b) is big enough to afford us but small enough to lack a
 * dedicated follow-up person. High review counts with a low rating is the
 * strongest single tell: lots of customers, and service complaints.
 */
const SIGNAL_WEIGHTS = {
  high_ticket_trade: 20,      // roofing/HVAC-install/remodel: one recovered job pays for us
  no_web_form: 12,            // no lead capture at all
  no_online_booking: 8,
  slow_or_no_response: 15,    // verified by our own mystery-shop
  many_reviews: 10,           // >50 reviews = real inbound volume
  review_mentions_no_callback: 15,  // customers publicly complaining about follow-up
  owner_answers_phone: 10,    // owner-operated = they feel the pain personally
  runs_paid_ads: 10,          // already paying for leads, so waste is expensive
};

const TIER = (score) => (score >= 70 ? 'A' : score >= 45 ? 'B' : score >= 25 ? 'C' : 'D');

function score(signals = {}) {
  let total = 0;
  const reasons = [];
  for (const [key, weight] of Object.entries(SIGNAL_WEIGHTS)) {
    if (signals[key]) { total += weight; reasons.push(`${key} (+${weight})`); }
  }
  // Rating penalty/bonus: a great shop with many reviews still misses calls,
  // but a poorly-rated one is a harder reference customer later.
  if (typeof signals.rating === 'number') {
    if (signals.rating < 3.5) { total -= 10; reasons.push('rating<3.5 (-10)'); }
    else if (signals.rating >= 4.5) { total += 5; reasons.push('rating>=4.5 (+5)'); }
  }
  const capped = Math.max(0, Math.min(100, total));
  return { score: capped, tier: TIER(capped), reasons };
}

function create(input, actor = 'operator') {
  const now = nowIso();
  const signals = input.signals || {};
  const scored = score(signals);
  const prospectId = id('pro');
  db.insert('prospects', {
    id: prospectId,
    business_name: input.business_name,
    industry: input.industry || null,
    city: input.city || null,
    state: input.state || null,
    website: input.website || null,
    phone: input.phone || null,
    email: input.email || null,
    owner_name: input.owner_name || null,
    review_count: input.review_count ?? null,
    rating: input.rating ?? null,
    signals: JSON.stringify(signals),
    score: scored.score,
    score_reason: scored.reasons.join(', ') || 'no signals recorded',
    stage: input.stage || 'new',
    notes: input.notes || null,
    created_at: now, updated_at: now,
  });
  db.insert('prospect_events', {
    id: id('pev'), prospect_id: prospectId, type: 'created',
    note: `scored ${scored.score} (${scored.tier})`, created_at: now,
  });
  return getById(prospectId);
}

function getById(prospectId) {
  const row = db.get('SELECT * FROM prospects WHERE id = ?', prospectId);
  if (!row) return null;
  try { row.signals = JSON.parse(row.signals || '{}'); } catch { row.signals = {}; }
  row.tier = TIER(row.score);
  return row;
}

function list({ stage = null, minScore = 0 } = {}) {
  const rows = stage
    ? db.all('SELECT * FROM prospects WHERE stage = ? AND score >= ? ORDER BY score DESC, created_at DESC', stage, minScore)
    : db.all('SELECT * FROM prospects WHERE score >= ? ORDER BY score DESC, created_at DESC', minScore);
  return rows.map((r) => {
    try { r.signals = JSON.parse(r.signals || '{}'); } catch { r.signals = {}; }
    r.tier = TIER(r.score);
    return r;
  });
}

const STAGES = ['new', 'researched', 'contacted', 'replied', 'meeting', 'audit_sent',
                'proposal', 'won', 'lost', 'disqualified'];

function advance(prospectId, stage, note = null, actor = 'operator') {
  if (!STAGES.includes(stage)) return { ok: false, error: 'invalid_stage' };
  const p = db.get('SELECT * FROM prospects WHERE id = ?', prospectId);
  if (!p) return { ok: false, error: 'not_found' };
  const now = nowIso();
  const patch = { stage, updated_at: now };
  if (['contacted', 'replied', 'meeting', 'audit_sent', 'proposal'].includes(stage)) {
    patch.last_contact_at = now;
    // Default cadence: chase again in 3 days unless the operator sets a date.
    patch.next_followup_at = new Date(Date.now() + 3 * 86_400_000).toISOString();
  }
  if (['won', 'lost', 'disqualified'].includes(stage)) patch.next_followup_at = null;
  db.update('prospects', prospectId, patch);
  db.insert('prospect_events', {
    id: id('pev'), prospect_id: prospectId, type: `stage.${stage}`, note, created_at: now,
  });
  return { ok: true, prospect: getById(prospectId) };
}

function rescore(prospectId, signals, actor = 'operator') {
  const scored = score(signals);
  db.update('prospects', prospectId, {
    signals: JSON.stringify(signals), score: scored.score,
    score_reason: scored.reasons.join(', '), updated_at: nowIso(),
  });
  return getById(prospectId);
}

const events = (prospectId) => db.all(
  'SELECT * FROM prospect_events WHERE prospect_id = ? ORDER BY created_at DESC', prospectId);

/** Prospects whose follow-up date has arrived. Drives the daily sales list. */
const dueForFollowup = () => db.all(
  `SELECT * FROM prospects WHERE next_followup_at IS NOT NULL AND next_followup_at <= ?
     AND stage NOT IN ('won','lost','disqualified') ORDER BY score DESC`, nowIso());

module.exports = { create, getById, list, advance, rescore, events, score, dueForFollowup, STAGES, SIGNAL_WEIGHTS };
