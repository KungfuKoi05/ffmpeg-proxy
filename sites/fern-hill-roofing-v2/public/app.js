// Fern Hill Roofing, draft 2. Everything here is progressive: the page reads fully without it.

const EMAIL = 'estimates@fernhill-roofing.example';

// Sample installed price per square (100 sq ft), and squares a crew can finish per dry day.
const MATERIALS = {
  comp: { name: 'composition', low: 600, high: 850, perDay: 15 },
  metal: { name: 'standing-seam metal', low: 1200, high: 1700, perDay: 6 },
  cedar: { name: 'cedar shake', low: 1300, high: 1900, perDay: 6 },
};

const fmt = (n) => '$' + (Math.round(n / 50) * 50).toLocaleString('en-US');
const daysFor = (squares, m) => Math.max(1, Math.ceil(squares / m.perDay));
const dryDays = (d) => `${d} dry ${d === 1 ? 'day' : 'days'}`;

function bookingHref(squares) {
  const body = [
    'Hello Fern Hill Roofing,',
    '',
    `I'd like a free roof inspection. My roof is roughly ${squares} squares.`,
    '',
    'Address of the roof:',
    'Best phone number:',
    'What I’ve noticed (leak, moss, missing shingles, age):',
  ].join('\n');
  return `mailto:${EMAIL}?subject=${encodeURIComponent('Roof inspection request')}&body=${encodeURIComponent(body)}`;
}

// ---------- price table: the roof-size slider ----------
(() => {
  const sizer = document.querySelector('[data-sizer]');
  if (!sizer) return;
  const range = sizer.querySelector('#squares');
  const caption = document.querySelector('.price-table caption');

  function render() {
    const squares = Number(range.value);
    sizer.querySelector('[data-out="squares"]').textContent = squares;
    for (const [key, m] of Object.entries(MATERIALS)) {
      document.querySelector(`[data-price="${key}"]`).textContent = `${fmt(squares * m.low)}–${fmt(squares * m.high)}`;
      document.querySelector(`[data-days="${key}"]`).textContent = dryDays(daysFor(squares, m));
    }
    caption.textContent = `Sample prices. New roofs are shown for a roof of ${squares} squares.`;
    document.querySelectorAll('[data-book]').forEach((a) => { a.href = bookingHref(squares); });
  }

  sizer.hidden = false;
  range.addEventListener('input', render);
  render();
})();

// ---------- layers: one frame, three distances ----------
(() => {
  const section = document.querySelector('[data-layers]');
  if (!section) return;
  let ticking = false;
  function update() {
    ticking = false;
    const r = section.getBoundingClientRect();
    const travel = r.height - window.innerHeight;
    const p = travel > 0 ? Math.min(1, Math.max(0, -r.top / travel)) : 0;
    const stage = p < 0.34 ? '1' : p < 0.67 ? '2' : '3';
    if (section.dataset.stage !== stage) section.dataset.stage = stage;
  }
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
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

document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
