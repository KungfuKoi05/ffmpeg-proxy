// Fern Hill Roofing sample site. Everything here is progressive: the page reads fully without it.

const EMAIL = 'estimates@fernhill-roofing.example';

// Sample installed price per square (100 sq ft) and squares a crew can finish per dry day.
const MATERIALS = {
  comp: { name: 'Composition shingle', low: 600, high: 850, perDay: 15 },
  metal: { name: 'Standing-seam metal', low: 1200, high: 1700, perDay: 6 },
  cedar: { name: 'Cedar shake', low: 1300, high: 1900, perDay: 6 },
};

const fmt = (n) => '$' + (Math.round(n / 50) * 50).toLocaleString('en-US');
const daysFor = (squares, m) => Math.max(1, Math.ceil(squares / m.perDay));

const state = { material: 'comp', squares: 22 };

function mailto(subject, lines) {
  return `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
}

function updateBookingLinks() {
  const m = MATERIALS[state.material];
  const href = mailto('Roof inspection request', [
    'Hello Fern Hill Roofing,',
    '',
    `I'd like a free roof inspection. I'm thinking about ${m.name.toLowerCase()}, roughly ${state.squares} squares.`,
    '',
    'Address of the roof:',
    'Best phone number:',
  ]);
  document.querySelectorAll('[data-book]').forEach((a) => { a.href = href; });
}

// ---------- estimator: material tabs and "your roof" band ----------
(() => {
  const root = document.querySelector('[data-estimator]');
  if (!root) return;
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const panels = [...root.querySelectorAll('[data-panel]')];
  const yours = root.querySelector('[data-yours]');
  const range = root.querySelector('#squares');
  const out = (k) => root.querySelector(`[data-out="${k}"]`);

  function render() {
    const m = MATERIALS[state.material];
    const d = daysFor(state.squares, m);
    out('squares').textContent = state.squares;
    out('price').textContent = `${fmt(state.squares * m.low)}–${fmt(state.squares * m.high)}`;
    out('days').textContent = `${d} dry ${d === 1 ? 'day' : 'days'}`;
    updateBookingLinks();
  }

  function select(tab, focus) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach((p) => { p.hidden = p.dataset.panel !== tab.dataset.material; });
    state.material = tab.dataset.material;
    if (focus) tab.focus();
    render();
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (e) => {
      const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
      if (e.key in keys) { e.preventDefault(); select(tabs[(i + keys[e.key] + tabs.length) % tabs.length], true); }
      if (e.key === 'Home') { e.preventDefault(); select(tabs[0], true); }
      if (e.key === 'End') { e.preventDefault(); select(tabs[tabs.length - 1], true); }
    });
  });

  range.addEventListener('input', () => { state.squares = Number(range.value); render(); });
  yours.hidden = false;
  select(tabs[0]);
})();

// ---------- process: one stage open at a time ----------
(() => {
  const stages = [...document.querySelectorAll('[data-stages] .stage')];
  stages.forEach((stage) => {
    stage.querySelector('.stage-btn').addEventListener('click', () => {
      stages.forEach((s) => {
        const open = s === stage;
        s.classList.toggle('is-open', open);
        s.querySelector('.stage-btn').setAttribute('aria-expanded', String(open));
      });
    });
  });
})();

// ---------- contact bar: compose the email ----------
(() => {
  const form = document.querySelector('[data-contact]');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const name = form.elements.name.value.trim();
    const address = form.elements.address.value.trim();
    window.location.href = mailto(`Roof inspection request from ${name}`, [
      'Hello Fern Hill Roofing,',
      '',
      `Please book a free roof inspection at ${address}.`,
      '',
      `Name: ${name}`,
      'Best phone number:',
      'What I’ve noticed (leak, moss, missing shingles, age):',
    ]);
  });
})();

// ---------- reveal once on entering the viewport ----------
(() => {
  const targets = document.querySelectorAll('[data-reveal]');
  if (!targets.length) return;
  if (!('IntersectionObserver' in window)) { targets.forEach((el) => el.classList.add('is-in')); return; }
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
  targets.forEach((el) => io.observe(el));
  window.addEventListener('load', () => setTimeout(() => {
    targets.forEach((el) => { const r = el.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) el.classList.add('is-in'); });
  }, 2500));
})();

// ---------- pause the loops while they are off screen ----------
(() => {
  const loops = document.querySelectorAll('.marquee, .swatch-strip');
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) entry.target.classList.toggle('is-paused', !entry.isIntersecting);
  });
  loops.forEach((el) => io.observe(el));
})();

document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
