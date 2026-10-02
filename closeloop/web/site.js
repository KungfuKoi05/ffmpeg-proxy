'use strict';
/* Marketing site behaviour: the ROI calculator and the demo request form.
   No inline handlers - the app serves this under a strict CSP. */

const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
const $ = (id) => document.getElementById(id);

// --- ROI calculator --------------------------------------------------------
const form = $('calc-form');
let inFlight = null;

async function recalculate() {
  const payload = Object.fromEntries(
    [...new FormData(form)].map(([k, v]) => [k, Number(v) || 0]));

  // Cancel a request still in flight so fast typing can't render stale numbers.
  if (inFlight) inFlight.abort();
  const controller = new AbortController();
  inFlight = controller;

  try {
    const res = await fetch('/api/public/roi', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error('calculation unavailable');
    render(await res.json());
    $('calc-status').textContent = 'Updating as you type.';
  } catch (err) {
    if (err.name === 'AbortError') return;
    $('calc-status').textContent =
      'Could not reach the calculator. Check your connection and try again.';
  } finally {
    if (inFlight === controller) inFlight = null;
  }
}

function render(r) {
  $('out-monthly').textContent = money(r.potential_recovered_revenue_monthly);
  $('out-calls').textContent = money(r.breakdown.from_missed_calls);
  $('out-estimates').textContent = money(r.breakdown.from_unsold_estimates);
  $('out-annual').textContent = money(r.potential_recovered_revenue_annual);
  $('out-missed').textContent = r.missed_calls_per_month.toLocaleString();
  $('out-opps').textContent = r.missed_opportunities_per_month.toLocaleString();
  $('out-unsold').textContent = r.unsold_estimates_per_month.toLocaleString();
  $('out-disclaimer').textContent = r.disclaimer;

  const warn = $('calc-warnings');
  warn.textContent = '';
  for (const w of r.warnings || []) {
    const div = document.createElement('div');
    div.className = 'calc-warning';
    div.textContent = w;
    warn.append(div);
  }

  const a = r.assumptions;
  const rows = [
    `${Math.round(a.qualified_lead_rate * 100)}% of inbound calls are a genuinely new job (the rest are existing customers, suppliers and spam).`,
    `${Math.round(a.never_call_back_rate * 100)}% of callers who don't reach a person never call back.`,
    `We assume we re-engage ${Math.round(a.missed_call_recovery_rate * 100)}% of missed callers by texting back quickly.`,
    `A recovered lead closes at ${Math.round(a.recovered_lead_close_discount * 100)}% of your normal close rate - it went cold once already.`,
    `${Math.round(a.estimate_recovery_rate * 100)}% of unsold estimates convert when worked with a 4-touch, 7-day cadence.`,
  ];
  const list = $('out-assumptions');
  list.textContent = '';
  for (const text of rows) {
    const li = document.createElement('li');
    li.textContent = text;
    list.append(li);
  }
}

let debounce;
form.addEventListener('input', () => {
  clearTimeout(debounce);
  debounce = setTimeout(recalculate, 220);
});
recalculate();

// --- demo request ----------------------------------------------------------
const demoForm = $('demo-form');
demoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const button = demoForm.querySelector('button');
  button.disabled = true;
  button.textContent = 'Sending...';

  try {
    const res = await fetch('/api/public/demo-request', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(demoForm))),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Something went wrong.');

    const result = $('demo-result');
    result.className = 'result-ok';
    result.textContent = '';
    const h = document.createElement('h3');
    h.textContent = 'Got it - thank you.';
    const p = document.createElement('p');
    p.textContent = json.duplicate
      ? 'You already had a request in with us. We\'ll pick that thread back up.'
      : 'We\'ll be in touch within one business day to book your audit.';
    p.style.margin = '0';
    result.append(h, p);
    demoForm.classList.add('hidden');
  } catch (err) {
    button.disabled = false;
    button.textContent = 'Request my audit';
    const result = $('demo-result');
    result.className = 'calc-warning';
    result.textContent = `${err.message} You can also email us directly.`;
  }
});
