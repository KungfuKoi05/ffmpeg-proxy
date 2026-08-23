'use strict';
const db = require('../db');
const H = require('../lib/http');
const prospects = require('../domain/prospects');
const { id, nowIso } = require('../lib/ids');

/**
 * ROI CALCULATOR - the model behind the public calculator and the audit PDF.
 *
 * Every number is an ESTIMATE derived from the visitor's own inputs plus
 * published industry benchmarks. It never claims a guaranteed outcome. The
 * benchmarks and their sources are in research/niche-analysis.md.
 */
const BENCHMARKS = {
  // Share of inbound calls that are genuinely a NEW job opportunity. The rest
  // are existing customers, suppliers, spam and wrong numbers. Without this
  // term the calculator produces numbers no contractor believes, which is
  // worse than useless on a sales call.
  qualified_lead_rate: 0.45,
  // Of callers who don't reach a person, ~85% never call back (ServiceTitan /
  // industry surveys - see research/niche-analysis.md).
  never_call_back_rate: 0.85,
  // Of missed callers we text back within minutes, the share that re-engage.
  // Held deliberately conservative.
  missed_call_recovery_rate: 0.25,
  // A recovered lead went cold once. It converts WORSE than a fresh inbound
  // call, so we discount the shop's own close rate rather than applying it flat.
  recovered_lead_close_discount: 0.6,
  // Of unsold estimates worked with a 4-touch / 7-day cadence, the share that
  // converts which would otherwise have gone cold.
  estimate_recovery_rate: 0.08,
  default_close_rate: 0.25,
};

const clampPct = (v, fallback) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(1, Math.max(0, n > 1 ? n / 100 : n));
};

function calculate(input) {
  const monthlyCalls = Math.max(0, Number(input.monthly_calls) || 0);
  const missedPct = clampPct(input.missed_call_pct, 0);
  const avgJob = Math.max(0, Number(input.avg_job_value) || 0);
  const closeRate = clampPct(input.close_rate, BENCHMARKS.default_close_rate);
  const estimatesPerMonth = Math.max(0, Number(input.estimates_per_month) || 0);
  const estimateCloseRate = clampPct(input.estimate_close_rate, closeRate);
  const qualifiedRate = clampPct(input.qualified_lead_rate, BENCHMARKS.qualified_lead_rate);

  const missedCalls = Math.round(monthlyCalls * missedPct);
  // Only the qualified slice represents a job we could have won.
  const missedOpportunities = missedCalls * qualifiedRate;
  const lostForever = missedOpportunities * BENCHMARKS.never_call_back_rate;
  const missedCallRevenueAtRisk = Math.round(lostForever * closeRate * avgJob);

  // Recovered leads close at a discounted rate - they already went cold once.
  const recoveredCloseRate = closeRate * BENCHMARKS.recovered_lead_close_discount;
  const recoveredLeads = missedOpportunities * BENCHMARKS.missed_call_recovery_rate;
  const recoveredCallRevenue = Math.round(recoveredLeads * recoveredCloseRate * avgJob);

  const unsoldEstimates = estimatesPerMonth * (1 - estimateCloseRate);
  const recoveredEstimates = unsoldEstimates * BENCHMARKS.estimate_recovery_rate;
  const recoveredEstimateRevenue = Math.round(recoveredEstimates * avgJob);

  const totalMonthly = recoveredCallRevenue + recoveredEstimateRevenue;

  // Sanity check against the shop's own implied revenue. If our estimate of
  // recoverable revenue exceeds ~25% of what they currently do, the inputs are
  // almost certainly wrong and we say so rather than quoting a fantasy number.
  const impliedJobsPerMonth = monthlyCalls * qualifiedRate * (1 - missedPct) * closeRate
    + estimatesPerMonth * estimateCloseRate;
  const impliedMonthlyRevenue = impliedJobsPerMonth * avgJob;
  const warnings = [];
  if (impliedMonthlyRevenue > 0 && totalMonthly > impliedMonthlyRevenue * 0.25) {
    warnings.push('These inputs imply a recovery larger than 25% of your current revenue. ' +
      'Double-check monthly call volume and average job value before relying on this.');
  }
  if (monthlyCalls > 0 && missedPct > 0.6) {
    warnings.push('A missed-call rate above 60% is unusually high - worth verifying against your phone records.');
  }

  return {
    inputs: {
      monthly_calls: monthlyCalls, missed_call_pct: Math.round(missedPct * 100),
      avg_job_value: avgJob, close_rate: Math.round(closeRate * 100),
      estimates_per_month: estimatesPerMonth,
      estimate_close_rate: Math.round(estimateCloseRate * 100),
      qualified_lead_rate: Math.round(qualifiedRate * 100),
    },
    missed_calls_per_month: missedCalls,
    missed_opportunities_per_month: Math.round(missedOpportunities),
    callers_who_never_call_back: Math.round(lostForever),
    revenue_at_risk_monthly: missedCallRevenueAtRisk,
    revenue_at_risk_annual: missedCallRevenueAtRisk * 12,
    unsold_estimates_per_month: Math.round(unsoldEstimates),
    potential_recovered_leads_monthly: Math.round(recoveredLeads),
    potential_recovered_estimates_monthly: Math.round(recoveredEstimates * 10) / 10,
    potential_recovered_revenue_monthly: totalMonthly,
    potential_recovered_revenue_annual: totalMonthly * 12,
    breakdown: {
      from_missed_calls: recoveredCallRevenue,
      from_unsold_estimates: recoveredEstimateRevenue,
    },
    implied_current_monthly_revenue: Math.round(impliedMonthlyRevenue),
    warnings,
    assumptions: BENCHMARKS,
    disclaimer: 'These are ESTIMATES based on the figures you entered and published ' +
      'industry benchmarks. They are not a prediction, a guarantee, or a quote. ' +
      'Your actual results depend on your market, your pricing, and how quickly ' +
      'your team follows up.',
  };
}

function register(router) {
  router.get('/api/public/health', async (req, res) => H.ok(res, {
    ok: true, service: 'closeloop', time: nowIso(),
  }));

  router.post('/api/public/roi', async (req, res) => {
    const body = await H.readBody(req, 10_000);
    return H.ok(res, calculate(body));
  });

  /** Demo request from the marketing site. Lands in our own sales pipeline. */
  router.post('/api/public/demo-request', async (req, res) => {
    const body = await H.readBody(req, 20_000);
    if (!body.business_name || (!body.email && !body.phone)) {
      return H.badRequest(res, 'business_name and an email or phone are required');
    }
    const existing = body.email
      ? db.get('SELECT * FROM prospects WHERE lower(COALESCE(email,\'\')) = lower(?)', body.email) : null;

    if (existing) {
      db.insert('prospect_events', { id: id('pev'), prospect_id: existing.id,
        type: 'inbound.demo_request_repeat', note: body.message || null, created_at: nowIso() });
      return H.ok(res, { received: true, duplicate: true });
    }

    const prospect = prospects.create({
      business_name: body.business_name, email: body.email, phone: body.phone,
      website: body.website, industry: body.industry, city: body.city, state: body.state,
      owner_name: body.name,
      // Inbound interest is the strongest buying signal there is.
      signals: { high_ticket_trade: true, runs_paid_ads: Boolean(body.runs_ads) },
      stage: 'replied',
      notes: `INBOUND DEMO REQUEST: ${body.message || '(no message)'}`,
    }, 'public_form');

    db.logSystem('info', 'sales', 'inbound demo request', { prospectId: prospect.id,
                                                            business: body.business_name });
    return H.created(res, { received: true, prospect_id: prospect.id });
  });
}

module.exports = { register, calculate, BENCHMARKS };
