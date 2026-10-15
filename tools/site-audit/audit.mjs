// Functional + accessibility audit for the Fern Hill Roofing sample site.
// Usage: CHROME_PATH=/path/to/chrome node audit.mjs <site-dir>
// The checks under "2. behaviour" are written for the Fern Hill sample (estimator, process, FAQ, contact bar);
// everything else applies to any static site.
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const root = resolve(process.argv[2]);
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

// apply the global block of Cloudflare's _headers file, so the audit runs under the real security policy
const HEADERS = {};
if (existsSync(join(root, '_headers'))) {
  let on = false;
  for (const line of readFileSync(join(root, '_headers'), 'utf8').split('\n')) {
    if (/^\S/.test(line) && !line.startsWith('#')) on = line.trim() === '/*';
    else if (on && /^\s+[\w-]+:/.test(line)) { const i = line.indexOf(':'); HEADERS[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
  }
}
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = join(root, p);
  if (!f.startsWith(root) || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { ...HEADERS, 'content-type': TYPES[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const URL_ = `http://127.0.0.1:${server.address().port}/`;

const findings = [];
console.log('headers applied:', Object.keys(HEADERS).join(', '));
const pass = [];
const check = (ok, name, detail = '') => (ok ? pass : findings).push(detail ? `${name}: ${detail}` : name);

// CHROME_PATH: any installed Chrome or Chromium. --no-sandbox is needed when running as root (CI, containers).
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });

// ---------- 1. errors, broken requests, overflow at five widths ----------
for (const width of [320, 390, 768, 1024, 1440]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = []; const failed = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  page.on('requestfailed', (r) => failed.push(`failed ${r.url()}`));
  await page.goto(URL_, { waitUntil: 'networkidle' });
  check(errors.length === 0, `no script/console errors @${width}`, errors.join(' | '));
  check(failed.length === 0, `no failed requests @${width}`, failed.join(' | '));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 0, `no sideways scroll @${width}`, `page is ${overflow}px wider than the screen`);
  // elements that stick out past the right edge (ignoring marquee tracks, which are clipped on purpose)
  const sticking = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((el) => {
    if (el.closest('svg, .marquee, .swatch-strip, .name-band')) return false;
    const r = el.getBoundingClientRect(); return r.width > 0 && r.right > window.innerWidth + 1;
  }).slice(0, 5).map((el) => el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : '')));
  check(sticking.length === 0, `nothing sticks out past the edge @${width}`, sticking.join(', '));
  if (width <= 390) {
    const small = await page.evaluate(() => [...document.querySelectorAll('a, button, input, summary, [role="tab"]')].filter((el) => {
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) return false;
      if (getComputedStyle(el).display === 'inline' && el.closest('p')) return false; // inline links in running text are exempt (WCAG 2.5.8)
      return r.height < 44 || r.width < 44;
    }).map((el) => `${(el.textContent || el.getAttribute('aria-label') || el.id).trim().slice(0, 30)} (${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)})`));
    check(small.length === 0, `tap targets at least 44px @${width}`, small.join('; '));
  }
  await page.close();
}

// ---------- 2. behaviour ----------
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleMsgs = [];
page.on('console', (m) => consoleMsgs.push(m.text()));
await page.goto(URL_, { waitUntil: 'networkidle' });

// in-page links all have a target
const deadAnchors = await page.evaluate(() => [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href')).filter((h) => h.length > 1 && !document.getElementById(h.slice(1))));
check(deadAnchors.length === 0, 'every in-page link has a target', deadAnchors.join(', '));
const ids = await page.evaluate(() => { const seen = {}; document.querySelectorAll('[id]').forEach((e) => { seen[e.id] = (seen[e.id] || 0) + 1; }); return Object.entries(seen).filter(([, n]) => n > 1).map(([k]) => k); });
check(ids.length === 0, 'no duplicate ids', ids.join(', '));

// estimator: static rows agree with the formula in app.js
const RATES = { comp: [600, 850], metal: [1200, 1700], cedar: [1300, 1900] };
const PER_DAY = { comp: 15, metal: 6, cedar: 6 };
const fmt = (n) => '$' + (Math.round(n / 50) * 50).toLocaleString('en-US');
const rows = await page.evaluate(() => [...document.querySelectorAll('[data-panel]')].flatMap((p) => [...p.querySelectorAll('.band')].map((b) => ({
  material: p.dataset.panel,
  squares: parseInt(b.querySelector('.band-size').textContent, 10),
  price: b.querySelector('.band-price').childNodes[0].textContent.trim(),
  days: b.querySelector('.band-days').textContent.trim(),
}))));
for (const r of rows) {
  const [lo, hi] = RATES[r.material]; const d = Math.max(1, Math.ceil(r.squares / PER_DAY[r.material]));
  const want = `${fmt(r.squares * lo)}–${fmt(r.squares * hi)}`; const wantDays = `${d} dry ${d === 1 ? 'day' : 'days'}`;
  check(r.price === want && r.days === wantDays, `printed price row matches the calculator (${r.material}, ${r.squares} sq)`, `page says "${r.price}, ${r.days}", calculator gives "${want}, ${wantDays}"`);
}

const visiblePanels = () => page.evaluate(() => [...document.querySelectorAll('[data-panel]')].filter((p) => !p.hidden && p.offsetParent).map((p) => p.dataset.panel));
check(JSON.stringify(await visiblePanels()) === '["comp"]', 'estimator starts on composition only', JSON.stringify(await visiblePanels()));
await page.click('#tab-metal');
check(JSON.stringify(await visiblePanels()) === '["metal"]', 'clicking a material tab shows only that material', JSON.stringify(await visiblePanels()));
check(await page.getAttribute('#tab-metal', 'aria-selected') === 'true', 'clicked tab is marked selected');
await page.focus('#tab-metal'); await page.keyboard.press('ArrowRight');
check(await page.evaluate(() => document.activeElement.id) === 'tab-cedar', 'arrow keys move between tabs', await page.evaluate(() => document.activeElement.id));
await page.keyboard.press('ArrowRight');
check(await page.evaluate(() => document.activeElement.id) === 'tab-comp', 'arrow keys wrap around');

for (const [material, sq] of [['comp', 8], ['comp', 45], ['metal', 30], ['cedar', 13]]) {
  await page.click(`#tab-${material}`);
  await page.$eval('#squares', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, String(sq));
  const shown = await page.evaluate(() => ({ p: document.querySelector('[data-out="price"]').textContent, d: document.querySelector('[data-out="days"]').textContent, s: document.querySelector('[data-out="squares"]').textContent }));
  const [lo, hi] = RATES[material]; const d = Math.max(1, Math.ceil(sq / PER_DAY[material]));
  const want = { p: `${fmt(sq * lo)}–${fmt(sq * hi)}`, d: `${d} dry ${d === 1 ? 'day' : 'days'}`, s: String(sq) };
  check(JSON.stringify(shown) === JSON.stringify(want), `slider result (${material}, ${sq} sq)`, `${JSON.stringify(shown)} vs ${JSON.stringify(want)}`);
}
const bookHref = await page.getAttribute('[data-book]', 'href');
check(/cedar%20shake/.test(bookHref) && /13%20squares/.test(bookHref), 'booking links carry the chosen material and size', bookHref.slice(0, 160));

// process accordion
await page.click('.s3 .stage-btn');
const stageState = await page.evaluate(() => [...document.querySelectorAll('.stage')].map((s) => [s.classList.contains('is-open'), s.querySelector('.stage-btn').getAttribute('aria-expanded')]));
check(JSON.stringify(stageState) === JSON.stringify([[false, 'false'], [false, 'false'], [true, 'true'], [false, 'false'], [false, 'false']]), 'process: one stage open at a time', JSON.stringify(stageState));
const openBodyVisible = await page.evaluate(() => { const b = document.querySelector('.s3 .stage-body'); const cs = getComputedStyle(b); return cs.visibility; });
await page.waitForTimeout(700);
check(await page.evaluate(() => getComputedStyle(document.querySelector('.s3 .stage-body')).opacity) === '1', 'process: opened stage shows its text', openBodyVisible);

// faq: one open at a time
await page.click('#faq details:nth-of-type(3) summary');
const openCount = await page.evaluate(() => document.querySelectorAll('#faq details[open]').length);
check(openCount === 1, 'FAQ: one answer open at a time', `${openCount} open`);

// contact form
await page.click('.cell-submit');
const blocked = await page.evaluate(() => !document.querySelector('#c-name').checkValidity());
check(blocked, 'contact: empty form is not sent');
consoleMsgs.length = 0;
await page.fill('#c-name', 'Sam Rivera'); await page.fill('#c-addr', '1907 N Junett St, Tacoma');
const nav = await Promise.race([
  page.waitForEvent('console', { predicate: (m) => /mailto:/.test(m.text()), timeout: 3000 }).then((m) => m.text()).catch(() => null),
  page.click('.cell-submit').then(() => new Promise((r) => setTimeout(() => r(null), 3100))),
]);
const mailtoText = nav || consoleMsgs.find((t) => /mailto:/.test(t)) || '';
check(/mailto:estimates@fernhill-roofing\.example/.test(mailtoText) && /Sam%20Rivera/.test(mailtoText) && /Junett/.test(mailtoText), 'contact: sending opens an email with the name and address filled in', mailtoText.slice(0, 200) || 'no mailto navigation seen');

// ---------- 3. without JavaScript ----------
const nojs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
const p2 = await nojs.newPage();
await p2.goto(URL_, { waitUntil: 'networkidle' });
const nojsState = await p2.evaluate(() => ({
  panels: [...document.querySelectorAll('[data-panel]')].filter((p) => p.offsetParent).length,
  hiddenReveal: [...document.querySelectorAll('[data-reveal]')].filter((e) => getComputedStyle(e).opacity === '0').length,
  stageText: [...document.querySelectorAll('.stage-body')].filter((b) => b.offsetParent && getComputedStyle(b).visibility !== 'hidden').length,
}));
check(nojsState.panels === 3, 'no-JS: all three price tables readable', JSON.stringify(nojsState));
check(nojsState.hiddenReveal === 0, 'no-JS: nothing left invisible', JSON.stringify(nojsState));
check(nojsState.stageText === 5, 'no-JS: every process step readable', JSON.stringify(nojsState));
await nojs.close();

// ---------- 4. reduced motion ----------
const rm = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
const p3 = await rm.newPage();
await p3.goto(URL_, { waitUntil: 'networkidle' });
const anim = await p3.evaluate(() => ['.marquee-track', '.swatch-track', '.rain rect'].map((s) => getComputedStyle(document.querySelector(s)).animationName));
check(anim.every((a) => a === 'none'), 'reduced motion stops the moving parts', anim.join(', '));
await rm.close();

// ---------- 5. axe accessibility scan ----------
for (const width of [1440, 390]) {
  const axeCtx = await browser.newContext({ bypassCSP: true, viewport: { width, height: 900 } }); // only so the scanner itself can be injected
  const p = await axeCtx.newPage();
  await p.goto(URL_, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.querySelectorAll('[data-reveal]').forEach((e) => e.classList.add('is-in')));
  await p.waitForTimeout(1200);
  await p.addScriptTag({ content: AXE });
  const res = await p.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, eg: v.nodes.slice(0, 3).map((n) => n.target.join(' ') + (n.any[0]?.message ? ' → ' + n.any[0].message.slice(0, 120) : '')) })));
  check(res.length === 0, `axe accessibility scan @${width}`, res.map((v) => `[${v.impact}] ${v.id} ×${v.n}: ${v.help} — ${v.eg.join(' ; ')}`).join('\n      '));
  await p.close();
}

await browser.close();
server.close();
console.log(`\nPASSED (${pass.length})`); pass.forEach((p) => console.log('  ✓ ' + p));
console.log(`\nPROBLEMS (${findings.length})`); findings.forEach((f) => console.log('  ✗ ' + f));
