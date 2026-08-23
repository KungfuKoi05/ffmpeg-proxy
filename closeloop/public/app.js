'use strict';
/* Closeloop operator console. Vanilla JS, no build step, CSP-safe (no inline
   handlers - everything is wired with addEventListener). */

const state = { me: null, clients: [], clientId: null, tab: 'dashboard' };

// --- helpers ---------------------------------------------------------------
const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, props = {}, ...kids) => {
  const node = Object.assign(document.createElement(tag), props);
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return node;
};
const money = (n) => '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const pct = (n) => (n == null ? '--' : `${n}%`);
const when = (iso) => {
  if (!iso) return '--';
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
};

async function api(path, options = {}) {
  const res = await fetch(path, {
    method: options.method || 'GET',
    headers: options.body ? { 'content-type': 'application/json' } : {},
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 401) { showLogin(); throw new Error('unauthenticated'); }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `request failed (${res.status})`);
  return json;
}

function notice(kind, text) { return el('div', { className: `notice ${kind}` }, text); }
function metric(label, value, note, hero) {
  return el('div', { className: `card metric${hero ? ' hero' : ''}` },
    el('div', { className: 'label' }, label),
    el('div', { className: 'value' }, value),
    note ? el('div', { className: 'note' }, note) : null);
}
function table(headers, rows) {
  return el('div', { className: 'table-wrap' },
    el('table', {},
      el('thead', {}, el('tr', {}, headers.map((h) => el('th', {}, h)))),
      el('tbody', {}, rows.length
        ? rows
        : el('tr', {}, el('td', { colSpan: headers.length, className: 'muted' }, 'Nothing here yet.')))));
}
const statusBadge = (status) => {
  const good = ['won', 'sent', 'responded', 'simulated', 'completed', 'confirmed', 'approved'];
  const bad = ['lost', 'failed', 'dnc', 'rejected', 'no_show'];
  const warn = ['suppressed', 'pending_approval', 'draft', 'nurture', 'cancelled'];
  const cls = good.includes(status) ? 'good' : bad.includes(status) ? 'bad'
    : warn.includes(status) ? 'warn' : '';
  return el('span', { className: `badge ${cls}` }, status);
};

// --- shell -----------------------------------------------------------------
function showLogin() {
  $('#app').classList.add('hidden');
  $('#login').classList.remove('hidden');
}

async function boot() {
  try {
    state.me = await api('/api/me');
  } catch { return showLogin(); }
  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');

  const { clients } = await api('/api/clients');
  state.clients = clients;
  state.clientId = clients[0]?.id || null;

  renderTabs();
  renderClientPicker();
  renderModePill();

  const path = location.pathname.replace('/', '');
  state.tab = tabsFor().some((t) => t.id === path) ? path : 'dashboard';
  render();
}

const tabsFor = () => {
  const base = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'leads', label: 'Leads' },
    { id: 'approvals', label: 'Approvals' },
    { id: 'messages', label: 'Messages' },
    { id: 'roi', label: 'ROI report' },
  ];
  if (state.me?.user.role === 'operator') {
    base.push({ id: 'sequences', label: 'Sequences' },
              { id: 'admin', label: 'Admin' },
              { id: 'sales', label: 'Sales' },
              { id: 'analytics', label: 'Analytics' },
              { id: 'logs', label: 'Logs' });
  }
  return base;
};

function renderTabs() {
  const nav = $('#tabs');
  nav.textContent = '';
  for (const tab of tabsFor()) {
    const btn = el('button', { className: state.tab === tab.id ? 'active' : '' }, tab.label);
    btn.addEventListener('click', () => {
      state.tab = tab.id;
      history.replaceState(null, '', `/${tab.id}`);
      renderTabs(); render();
    });
    nav.append(btn);
  }
}

function renderClientPicker() {
  const sel = $('#client-picker');
  sel.textContent = '';
  for (const c of state.clients) sel.append(el('option', { value: c.id }, c.name));
  sel.value = state.clientId || '';
  sel.classList.toggle('hidden', state.clients.length <= 1);
  sel.addEventListener('change', () => {
    state.clientId = sel.value; renderModePill(); render();
  });
}

function renderModePill() {
  const client = state.clients.find((c) => c.id === state.clientId);
  const global = state.me?.automation_mode || 'TEST';
  const order = ['OFF', 'TEST', 'ASSISTED', 'LIVE'];
  const effective = client
    ? order[Math.min(order.indexOf(global), order.indexOf(client.automation_mode))] : global;
  const pill = $('#mode-pill');
  pill.className = `mode mode-${effective}`;
  pill.textContent = effective;
  pill.title = `Global: ${global}${client ? ` | Client: ${client.automation_mode}` : ''}`;
}

// --- views -----------------------------------------------------------------
const VIEWS = {};

async function render() {
  const view = $('#view');
  view.textContent = '';
  view.append(el('p', { className: 'muted' }, 'Loading...'));
  try {
    const node = await VIEWS[state.tab]();
    view.textContent = '';
    view.append(node);
  } catch (err) {
    view.textContent = '';
    view.append(notice('bad', `Could not load: ${err.message}`));
  }
}

VIEWS.dashboard = async () => {
  if (!state.clientId) return notice('warn', 'No client yet. Create one under Admin.');
  const m = await api(`/api/metrics?client_id=${state.clientId}&days=30`);
  const wrap = el('div', { className: 'stack' });

  wrap.append(el('div', {},
    el('h2', {}, `${m.client.name} - last 30 days`),
    el('p', { className: 'sub' }, `Generated ${new Date(m.generated_at).toLocaleString()}`)));

  if (m.messages_pending_approval > 0) {
    wrap.append(notice('warn',
      `${m.messages_pending_approval} message${m.messages_pending_approval === 1 ? '' : 's'} waiting for your approval.`));
  }

  wrap.append(el('div', { className: 'grid cols-4' },
    metric('Revenue attributed', money(m.revenue_attributed),
           `${m.jobs_attributed} of ${m.jobs_won} won jobs`, true),
    metric('Revenue to fee', m.revenue_to_fee_ratio ? `${m.revenue_to_fee_ratio}x` : '--',
           `Fee ${money(m.cost)} for the window`),
    metric('Leads received', m.leads_received, `${m.leads_contacted} contacted`),
    metric('Response rate', pct(m.response_rate), `${m.leads_responded} replied`)));

  wrap.append(el('div', { className: 'grid cols-4' },
    metric('Median first touch', m.median_first_touch_minutes == null ? '--'
      : `${m.median_first_touch_minutes}m`, 'lead created to our first message'),
    metric('Estimates sent', m.estimates_sent, money(m.estimates_value)),
    metric('Open estimates', m.estimates_open, `${money(m.estimates_open_value)} still in play`),
    metric('Estimate close rate', pct(m.estimate_close_rate), `${m.estimates_won} won`)));

  wrap.append(el('div', { className: 'grid cols-4' },
    metric('Appointments', m.appointments_booked, `${m.appointments_completed} completed`),
    metric('Messages sent', m.messages_sent, `${m.messages_suppressed} suppressed by guards`),
    metric('Automation health', pct(m.automation_success_rate), `${m.messages_failed} failures`),
    metric('Total revenue', money(m.revenue_total), 'all won jobs, attributed or not')));

  wrap.append(el('p', { className: 'disclaimer' }, m.disclaimer));
  return wrap;
};

VIEWS.leads = async () => {
  const { leads } = await api(`/api/leads?client_id=${state.clientId}`);
  const wrap = el('div', { className: 'stack' });
  wrap.append(el('h2', {}, 'Leads'), el('p', { className: 'sub' },
    `${leads.length} lead${leads.length === 1 ? '' : 's'}. Click a row for the full timeline.`));

  const form = el('form', { className: 'card' });
  form.append(el('h3', {}, 'Add a lead manually'),
    el('div', { className: 'row' },
      el('div', {}, el('label', {}, 'Name'), el('input', { name: 'name', placeholder: 'Dana Okafor' })),
      el('div', {}, el('label', {}, 'Phone'), el('input', { name: 'phone', placeholder: '+1 512 555 0123' })),
      el('div', {}, el('label', {}, 'Email'), el('input', { name: 'email', type: 'email' })),
      el('div', {}, el('label', {}, 'What they want'), el('input', { name: 'message', placeholder: 'quote on a new AC' })),
      el('button', { className: 'btn', type: 'submit' }, 'Add lead')));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    if (!data.phone && !data.email) return alert('A phone number or an email is required.');
    try {
      await api('/api/leads', { method: 'POST', body: { ...data, client_id: state.clientId } });
      form.reset(); render();
    } catch (err) { alert(err.message); }
  });
  wrap.append(form);

  const rows = leads.map((l) => {
    const tr = el('tr', { style: 'cursor:pointer' },
      el('td', {}, el('strong', {}, l.name || '(no name)'),
        el('div', { className: 'muted mono' }, l.phone || l.email || '')),
      el('td', {}, statusBadge(l.status)),
      el('td', {}, l.classification
        ? el('span', { className: 'badge', title: `confidence ${l.classification_confidence}` },
              l.classification) : el('span', { className: 'muted' }, '--')),
      el('td', {}, l.source),
      el('td', {}, l.estimated_value ? money(l.estimated_value) : '--'),
      el('td', {}, when(l.last_contact_at)),
      el('td', {}, l.last_response_at ? when(l.last_response_at) : el('span', { className: 'muted' }, 'no reply')),
      el('td', {}, l.opted_out ? el('span', { className: 'badge bad' }, 'opted out')
        : l.consent_sms ? el('span', { className: 'badge good' }, 'SMS ok')
        : el('span', { className: 'badge warn' }, 'no consent')));
    tr.addEventListener('click', () => openLead(l.id));
    return tr;
  });
  wrap.append(table(['Lead', 'Status', 'Classified', 'Source', 'Value', 'Last touch', 'Last reply', 'Consent'], rows));
  return wrap;
};

async function openLead(leadId) {
  const data = await api(`/api/leads/${leadId}`);
  const view = $('#view');
  view.textContent = '';
  const l = data.lead;

  const back = el('button', { className: 'btn secondary sm' }, '← Back to leads');
  back.addEventListener('click', () => render());

  const wrap = el('div', { className: 'stack' },
    back,
    el('h2', {}, l.name || '(no name)'),
    el('p', { className: 'sub mono' }, `${l.phone || ''} ${l.email || ''}`.trim() || 'no contact details'),
    el('div', { className: 'grid cols-4' },
      metric('Status', l.status), metric('Source', l.source),
      metric('Classified', l.classification || '--',
             l.classification_confidence ? `confidence ${l.classification_confidence}` : ''),
      metric('Estimated value', l.estimated_value ? money(l.estimated_value) : '--')));

  // Simulate a reply - essential for demos and QA in TEST mode.
  const replyForm = el('form', { className: 'card' });
  replyForm.append(el('h3', {}, 'Simulate an inbound reply'),
    el('p', { className: 'muted', style: 'margin-top:-6px;font-size:12px' },
      'Records an inbound message exactly as the SMS webhook would. Sending "STOP" opts the lead out.'),
    el('div', { className: 'row' },
      el('div', {}, el('input', { name: 'body', placeholder: 'yes, when could you start?', required: true })),
      el('button', { className: 'btn', type: 'submit' }, 'Record reply')));
  replyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = new FormData(replyForm).get('body');
    await api(`/api/leads/${leadId}/reply`, { method: 'POST', body: { body } });
    openLead(leadId);
  });
  wrap.append(replyForm);

  if (data.estimates.length) {
    wrap.append(el('h3', {}, 'Estimates'),
      table(['Amount', 'Description', 'Status', 'Sent', ''], data.estimates.map((e) => {
        const actions = el('td', {});
        if (e.status === 'open') {
          const won = el('button', { className: 'btn sm' }, 'Mark won');
          won.addEventListener('click', async () => {
            await api(`/api/estimates/${e.id}/decide`, { method: 'POST', body: { outcome: 'won' } });
            openLead(leadId);
          });
          const lost = el('button', { className: 'btn secondary sm' }, 'Lost');
          lost.addEventListener('click', async () => {
            await api(`/api/estimates/${e.id}/decide`, { method: 'POST', body: { outcome: 'lost' } });
            openLead(leadId);
          });
          actions.append(won, ' ', lost);
        }
        return el('tr', {}, el('td', {}, money(e.amount)), el('td', {}, e.description || '--'),
          el('td', {}, statusBadge(e.status)), el('td', {}, when(e.sent_at)), actions);
      })));
  }

  wrap.append(el('h3', {}, 'Messages'),
    table(['When', 'Dir', 'Channel', 'Status', 'Body'], data.messages.map((m) => el('tr', {},
      el('td', {}, when(m.created_at)),
      el('td', {}, m.direction === 'inbound' ? el('span', { className: 'badge good' }, 'in')
                                             : el('span', { className: 'badge' }, 'out')),
      el('td', {}, m.channel),
      el('td', {}, statusBadge(m.status),
         m.suppress_reason ? el('div', { className: 'muted mono' }, m.suppress_reason) : null),
      el('td', { className: 'msg-body' }, m.body)))));

  wrap.append(el('h3', {}, 'Timeline'),
    table(['When', 'Event', 'Actor'], data.timeline.slice(0, 40).map((t) => el('tr', {},
      el('td', {}, when(t.created_at)), el('td', { className: 'mono' }, t.type),
      el('td', { className: 'muted' }, t.actor)))));

  view.append(wrap);
}

VIEWS.approvals = async () => {
  const { pending } = await api(`/api/approvals${state.clientId ? `?client_id=${state.clientId}` : ''}`);
  const wrap = el('div', { className: 'stack' });
  wrap.append(el('h2', {}, 'Approvals'), el('p', { className: 'sub' },
    'Messages waiting on a human in ASSISTED mode. Nothing here is sent until you approve it.'));

  if (!pending.length) {
    wrap.append(notice('info', 'Nothing waiting. In TEST mode messages are simulated rather than queued for approval.'));
    return wrap;
  }

  for (const m of pending) {
    const card = el('div', { className: 'card' });
    const textarea = el('textarea', { value: m.body });
    card.append(
      el('div', { className: 'muted mono' },
        `${m.channel.toUpperCase()} to ${m.lead_name || '(no name)'} <${m.to_addr}> - queued ${when(m.created_at)}`),
      m.subject ? el('div', {}, el('strong', {}, m.subject)) : null,
      textarea);
    const approve = el('button', { className: 'btn' }, 'Approve and send');
    approve.addEventListener('click', async () => {
      approve.disabled = true;
      try { await api(`/api/approvals/${m.id}/approve`, { method: 'POST', body: { body: textarea.value } }); render(); }
      catch (err) { alert(err.message); approve.disabled = false; }
    });
    const reject = el('button', { className: 'btn danger sm' }, 'Reject');
    reject.addEventListener('click', async () => {
      await api(`/api/approvals/${m.id}/reject`, { method: 'POST', body: { reason: 'rejected by operator' } });
      render();
    });
    card.append(el('div', { className: 'row' }, approve, reject));
    wrap.append(card);
  }
  return wrap;
};

VIEWS.messages = async () => {
  const { messages } = await api(`/api/messages?client_id=${state.clientId}`);
  const wrap = el('div', { className: 'stack' });
  wrap.append(el('h2', {}, 'Message log'), el('p', { className: 'sub' },
    'Every outbound and inbound message, including the ones a guard blocked.'));
  wrap.append(table(['When', 'Lead', 'Dir', 'Channel', 'Status', 'Mode', 'Body'],
    messages.map((m) => el('tr', {},
      el('td', {}, when(m.created_at)),
      el('td', {}, m.lead_name || '--'),
      el('td', {}, m.direction === 'inbound' ? 'in' : 'out'),
      el('td', {}, m.channel),
      el('td', {}, statusBadge(m.status),
         m.suppress_reason ? el('div', { className: 'muted mono' }, m.suppress_reason) : null),
      el('td', { className: 'mono muted' }, m.mode_at_creation),
      el('td', { className: 'msg-body' }, m.body)))));
  return wrap;
};

VIEWS.roi = async () => {
  const r = await api(`/api/roi-report?client_id=${state.clientId}&days=30`);
  const wrap = el('div', { className: 'stack' });
  wrap.append(el('h2', {}, `ROI report - ${r.client.name}`),
    el('p', { className: 'sub' }, 'Last 30 days. This is the report you send the client each month.'));

  wrap.append(el('div', { className: 'grid cols-4' },
    metric('Revenue attributed', money(r.revenue_attributed), `${r.jobs_attributed} jobs`, true),
    metric('Your cost', money(r.cost), 'monthly fee'),
    metric('Net', money(r.net_revenue_attributed), 'attributed revenue minus fee'),
    metric('Return', r.revenue_to_fee_ratio ? `${r.revenue_to_fee_ratio}x` : '--', 'revenue per $1 of fee')));

  wrap.append(el('h3', {}, 'Jobs we are claiming credit for'),
    table(['Won', 'Customer', 'Amount', 'Why it counts'],
      r.attributed_jobs.map((j) => el('tr', {},
        el('td', {}, when(j.won_at)), el('td', {}, j.lead_name || '--'),
        el('td', {}, money(j.amount)),
        el('td', { className: 'mono muted' }, j.attribution_reason)))));

  wrap.append(el('h3', {}, 'Jobs we are NOT claiming'),
    el('p', { className: 'muted', style: 'margin-top:-8px;font-size:12px' },
      'Shown deliberately. If we cannot trace a job back to a follow-up we delivered, we do not count it.'),
    table(['Won', 'Customer', 'Amount', 'Why it does not count'],
      r.unattributed_jobs.map((j) => el('tr', {},
        el('td', {}, when(j.won_at)), el('td', {}, j.lead_name || '--'),
        el('td', {}, money(j.amount)),
        el('td', { className: 'mono muted' }, j.attribution_reason)))));

  wrap.append(el('p', { className: 'disclaimer' }, r.disclaimer));
  return wrap;
};

VIEWS.sequences = async () => {
  const { sequences } = await api(`/api/sequences?client_id=${state.clientId}`);
  const wrap = el('div', { className: 'stack' });
  wrap.append(el('h2', {}, 'Follow-up sequences'), el('p', { className: 'sub' },
    'Edit the copy the client sends. Changes take effect on the next scheduled step.'));

  for (const seq of sequences) {
    const card = el('div', { className: 'card' });
    const toggle = el('button', { className: `btn sm ${seq.enabled ? '' : 'secondary'}` },
      seq.enabled ? 'Enabled' : 'Disabled');
    toggle.addEventListener('click', async () => {
      await api(`/api/sequences/${seq.id}`, { method: 'PATCH', body: { enabled: !seq.enabled } });
      render();
    });
    card.append(el('div', { className: 'row' },
      el('div', {}, el('h3', {}, seq.name), el('span', { className: 'badge' }, seq.trigger)), toggle));

    for (const step of seq.steps) {
      const ta = el('textarea', { value: step.template });
      const subject = step.channel === 'email'
        ? el('input', { value: step.subject || '', placeholder: 'Subject line' }) : null;
      const save = el('button', { className: 'btn sm secondary' }, 'Save');
      save.addEventListener('click', async () => {
        await api(`/api/sequence-steps/${step.id}`, { method: 'PATCH',
          body: { template: ta.value, subject: subject ? subject.value : undefined } });
        save.textContent = 'Saved';
        setTimeout(() => { save.textContent = 'Save'; }, 1500);
      });
      card.append(el('div', { style: 'margin-top:12px' },
        el('label', {}, `Step ${step.step_index + 1} - ${step.channel.toUpperCase()} at ` +
          `${step.delay_hours < 0 ? `${Math.abs(step.delay_hours)}h before` : `+${step.delay_hours}h`}`),
        subject, ta, save));
    }
    wrap.append(card);
  }
  return wrap;
};

VIEWS.admin = async () => {
  const wrap = el('div', { className: 'stack' });
  wrap.append(el('h2', {}, 'Admin'));

  const p = state.me.providers;
  wrap.append(el('div', { className: 'grid cols-4' },
    metric('Global mode', state.me.automation_mode, 'set by AUTOMATION_MODE'),
    metric('SMS provider', p.sms.effective, p.sms.costsMoney ? 'PAID' : 'free / mock'),
    metric('Email provider', p.email.effective, p.email.costsMoney ? 'PAID' : 'free / mock'),
    metric('AI provider', p.ai.effective, p.ai.costsMoney ? 'PAID' : 'free / rules')));

  for (const w of state.me.warnings || []) wrap.append(notice('warn', w));

  // Per-client mode control, with an explicit confirmation before LIVE.
  const client = state.clients.find((c) => c.id === state.clientId);
  if (client) {
    const card = el('div', { className: 'card' });
    const sel = el('select', {});
    for (const m of ['OFF', 'TEST', 'ASSISTED', 'LIVE']) {
      sel.append(el('option', { value: m, selected: client.automation_mode === m }, m));
    }
    const save = el('button', { className: 'btn' }, 'Update mode');
    save.addEventListener('click', async () => {
      if (sel.value === 'LIVE' && !confirm(
        `Set ${client.name} to LIVE?\n\nReal messages will be sent to real customers ` +
        `for any lead with recorded SMS consent. Make sure you have reviewed the copy.`)) return;
      await api(`/api/clients/${client.id}`, { method: 'PATCH', body: { automation_mode: sel.value } });
      const { clients } = await api('/api/clients');
      state.clients = clients; renderModePill(); render();
    });
    card.append(el('h3', {}, `Automation mode - ${client.name}`),
      el('p', { className: 'muted', style: 'font-size:12px;margin-top:-6px' },
        'OFF: nothing runs. TEST: messages are rendered and logged only. ' +
        'ASSISTED: a human approves each send. LIVE: sends automatically.'),
      el('div', { className: 'row' }, sel, save));
    wrap.append(card);
  }

  const tick = el('button', { className: 'btn secondary' }, 'Run the engine now');
  tick.addEventListener('click', async () => {
    const r = await api('/api/engine/tick', { method: 'POST' });
    alert(`Engine tick: ${r.enrollments.length} step(s), ${r.deferred} deferred, ${r.errors} error(s).`);
    render();
  });
  wrap.append(el('div', { className: 'card' },
    el('h3', {}, 'Engine'),
    el('p', { className: 'muted', style: 'font-size:12px' },
      'The scheduler runs automatically every 60 seconds. Use this to trigger it immediately.'),
    tick));

  // Onboarding form.
  const form = el('form', { className: 'card' });
  form.append(el('h3', {}, 'Onboard a new client'),
    el('div', { className: 'row' },
      el('div', {}, el('label', {}, 'Business name *'), el('input', { name: 'name', required: true })),
      el('div', {}, el('label', {}, 'Industry *'), el('input', { name: 'industry', value: 'hvac', required: true })),
      el('div', {}, el('label', {}, 'Average job value *'), el('input', { name: 'avg_job_value', type: 'number', required: true }))),
    el('div', { className: 'row' },
      el('div', {}, el('label', {}, 'Monthly fee'), el('input', { name: 'monthly_fee', type: 'number', value: '1500' })),
      el('div', {}, el('label', {}, 'Timezone'), el('input', { name: 'timezone', value: 'America/Chicago' })),
      el('div', {}, el('label', {}, 'Phone'), el('input', { name: 'phone' })),
      el('button', { className: 'btn', type: 'submit' }, 'Onboard')));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const r = await api('/api/onboard', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
      const { clients } = await api('/api/clients');
      state.clients = clients; state.clientId = r.client.id;
      renderClientPicker(); renderModePill(); form.reset(); render();
    } catch (err) { alert(err.message); }
  });
  wrap.append(form);
  return wrap;
};

VIEWS.sales = async () => {
  const { prospects, due, signal_weights: weights } = await api('/api/prospects');
  const wrap = el('div', { className: 'stack' });
  wrap.append(el('h2', {}, 'Sales pipeline'), el('p', { className: 'sub' },
    `${prospects.length} prospects. ${due.length} due for follow-up today.`));

  const form = el('form', { className: 'card' });
  const signalBoxes = Object.keys(weights).map((k) =>
    el('label', { style: 'display:inline-flex;gap:6px;align-items:center;margin-right:14px;font-weight:400' },
      el('input', { type: 'checkbox', name: k, style: 'width:auto;margin:0' }),
      `${k.replace(/_/g, ' ')} (+${weights[k]})`));
  form.append(el('h3', {}, 'Add a prospect'),
    el('div', { className: 'row' },
      el('div', {}, el('label', {}, 'Business *'), el('input', { name: 'business_name', required: true })),
      el('div', {}, el('label', {}, 'Industry'), el('input', { name: 'industry' })),
      el('div', {}, el('label', {}, 'City'), el('input', { name: 'city' })),
      el('div', {}, el('label', {}, 'Phone'), el('input', { name: 'phone' })),
      el('div', {}, el('label', {}, 'Rating'), el('input', { name: 'rating', type: 'number', step: '0.1' }))),
    el('div', { style: 'margin-bottom:12px' }, el('label', {}, 'Signals'), signalBoxes),
    el('button', { className: 'btn', type: 'submit' }, 'Add and score'));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const signals = {};
    for (const k of Object.keys(weights)) if (fd.get(k)) signals[k] = true;
    if (fd.get('rating')) signals.rating = Number(fd.get('rating'));
    await api('/api/prospects', { method: 'POST', body: {
      business_name: fd.get('business_name'), industry: fd.get('industry'),
      city: fd.get('city'), phone: fd.get('phone'),
      rating: fd.get('rating') ? Number(fd.get('rating')) : null, signals } });
    form.reset(); render();
  });
  wrap.append(form);

  const STAGES = ['new', 'researched', 'contacted', 'replied', 'meeting', 'audit_sent',
                  'proposal', 'won', 'lost', 'disqualified'];
  wrap.append(table(['Score', 'Business', 'Industry', 'City', 'Stage', 'Next follow-up', 'Why this score'],
    prospects.map((p) => {
      const sel = el('select', { style: 'margin:0' });
      for (const s of STAGES) sel.append(el('option', { value: s, selected: p.stage === s }, s));
      sel.addEventListener('change', async () => {
        await api(`/api/prospects/${p.id}`, { method: 'PATCH', body: { stage: sel.value } });
        render();
      });
      return el('tr', {},
        el('td', {}, el('span', { className: `badge ${p.tier === 'A' ? 'good' : p.tier === 'D' ? 'bad' : 'warn'}` },
          `${p.score} ${p.tier}`)),
        el('td', {}, el('strong', {}, p.business_name),
           p.phone ? el('div', { className: 'muted mono' }, p.phone) : null),
        el('td', {}, p.industry || '--'), el('td', {}, p.city || '--'),
        el('td', {}, sel),
        el('td', {}, p.next_followup_at ? when(p.next_followup_at) : '--'),
        el('td', { className: 'muted', style: 'font-size:11px;max-width:280px' }, p.score_reason));
    })));
  return wrap;
};

VIEWS.analytics = async () => {
  const a = await api('/api/analytics');
  const wrap = el('div', { className: 'stack' });
  wrap.append(el('h2', {}, 'Business analytics'), el('p', { className: 'sub' },
    'Our business, not a client\'s.'));

  wrap.append(el('div', { className: 'grid cols-4' },
    metric('MRR', money(a.mrr), `${a.progress_pct}% of the $10k target`, true),
    metric('Paying customers', a.customers_paying, `${a.customers_total} total incl. trials`),
    metric('ARPU', money(a.arpu), a.clients_needed_at_arpu != null
      ? `${a.clients_needed_at_arpu} more at this ARPU reaches $10k` : 'no paying customers yet'),
    metric('Churn', `${a.churn_rate}%`, `${a.churned} churned`)));

  wrap.append(el('h3', {}, 'Per client'),
    table(['Client', 'Fee', 'Leads (30d)', 'Replied', 'Attributed revenue', 'Return', 'Churn risk'],
      a.per_client.map((c) => el('tr', {},
        el('td', {}, c.name, el('div', { className: 'muted mono' }, c.mode)),
        el('td', {}, money(c.monthly_fee)), el('td', {}, c.leads), el('td', {}, c.responded),
        el('td', {}, money(c.revenue_attributed)),
        el('td', {}, c.ratio ? `${c.ratio}x` : '--'),
        el('td', {}, el('span', { className: `badge ${c.churn_risk === 'low' ? 'good'
          : c.churn_risk === 'high' ? 'bad' : 'warn'}` }, c.churn_risk))))));

  wrap.append(el('h3', {}, 'Sales pipeline'),
    table(['Stage', 'Count'], Object.entries(a.pipeline).map(([stage, n]) =>
      el('tr', {}, el('td', {}, stage), el('td', {}, n)))));
  return wrap;
};

VIEWS.logs = async () => {
  const l = await api('/api/logs');
  const wrap = el('div', { className: 'stack' });
  wrap.append(el('h2', {}, 'Logs'), el('p', { className: 'sub' },
    `Engine last ran ${l.last_tick ? when(l.last_tick) : 'never'}.`));
  wrap.append(el('h3', {}, 'System'),
    table(['When', 'Level', 'Scope', 'Message'], l.system.map((s) => el('tr', {},
      el('td', {}, when(s.created_at)),
      el('td', {}, el('span', { className: `badge ${s.level === 'error' ? 'bad' : s.level === 'warn' ? 'warn' : ''}` }, s.level)),
      el('td', { className: 'mono' }, s.scope), el('td', {}, s.message)))));
  wrap.append(el('h3', {}, 'Events'),
    table(['When', 'Type', 'Entity', 'Actor'], l.events.slice(0, 60).map((e) => el('tr', {},
      el('td', {}, when(e.created_at)), el('td', { className: 'mono' }, e.type),
      el('td', { className: 'mono muted' }, `${e.entity_type}:${e.entity_id.slice(0, 12)}`),
      el('td', { className: 'muted' }, e.actor)))));
  return wrap;
};

// --- wiring ----------------------------------------------------------------
$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#login-error');
  err.classList.add('hidden');
  try {
    const res = await fetch('/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: $('#login-email').value, password: $('#login-password').value }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Sign in failed');
    boot();
  } catch (e2) { err.textContent = e2.message; err.classList.remove('hidden'); }
});

$('#logout').addEventListener('click', async () => {
  await fetch('/logout', { method: 'POST' });
  location.reload();
});

boot();
