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
  const img = section.querySelector('.frame img');
  const half2 = section.querySelector('.half-2');
  const caption = section.querySelector('.layers-caption');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canCrop = window.CSS && CSS.supports('object-view-box', 'inset(0%)');

  // Baseline: three fixed distances switched by CSS. Runs until GSAP takes over, and for good when
  // GSAP is unavailable, the browser cannot crop with object-view-box, or the visitor prefers reduced motion.
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

  if (reduce || !canCrop || !('IntersectionObserver' in window)) return;

  // Upgrade: GSAP ScrollTrigger scrubs the zoom with the scroll, pausing on the chimney flashing and the
  // ridge. GSAP (about 46 KB compressed) is only fetched when the section comes near, so it never
  // competes with the first screen.
  const load = (src) => new Promise((resolve, reject) => {
    const tag = document.createElement('script');
    tag.src = src; tag.onload = resolve; tag.onerror = reject;
    document.head.appendChild(tag);
  });
  function scrub() {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    delete section.dataset.stage;
    gsap.registerPlugin(ScrollTrigger);
    section.classList.add('is-scrubbed');
    const box = { t: 0, r: 0, b: 0, l: 0 };
    const draw = () => { img.style.objectViewBox = `inset(${box.t}% ${box.r}% ${box.b}% ${box.l}%)`; };
    gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: section, start: 'top top', end: 'bottom bottom', scrub: 0.6 },
    })
      .to(box, { t: 11.6, r: 10.6, b: 32.8, l: 33.8, duration: 1, ease: 'power1.inOut', onUpdate: draw })
      .fromTo(half2, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4 }, 0.4)
      .to({}, { duration: 0.25 })
      .to(box, { t: 14.4, r: 37.8, b: 54.3, l: 30.9, duration: 1, ease: 'power1.inOut', onUpdate: draw })
      .fromTo(caption, { opacity: 0 }, { opacity: 1, duration: 0.3 }, '-=0.3')
      .to({}, { duration: 0.25 });
  }
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    load('vendor/gsap.min.js')
      .then(() => load('vendor/ScrollTrigger.min.js'))
      .then(scrub)
      .catch(() => { /* stay on the three-step zoom */ });
  }, { rootMargin: '150% 0px' });
  io.observe(section);
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
