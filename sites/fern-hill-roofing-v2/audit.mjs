// Functional + accessibility audit for the Fern Hill Roofing sample site, draft 2.
// Usage: CHROME_PATH=/path/to/chrome node audit.mjs public
// The checks under "2. behaviour" are written for this page (size slider, layers zoom, FAQ, booking links);
// everything else applies to any static site.
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const root = resolve(process.argv[2]);
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg' };

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
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } window.scrollTo(0, 0); });
  const broken = await page.evaluate(() => Promise.all([...document.images].map(async (img) => { try { await img.decode(); } catch {} return img.naturalWidth ? null : img.getAttribute('src'); })).then((a) => a.filter(Boolean)));
  check(broken.length === 0, `every photo loads @${width}`, broken.join(', '));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 0, `no sideways scroll @${width}`, `page is ${overflow}px wider than the screen`);
  // elements that stick out past the right edge (ignoring marquee tracks, which are clipped on purpose)
  const sticking = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((el) => {
    if (el.closest('svg, .frame')) return false; // the zoom frame clips its own picture
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
const vendorHits = [];
page.on('request', (r) => { if (/\/vendor\//.test(r.url())) vendorHits.push(r.url().replace(/^.*\//, '')); });
await page.goto(URL_, { waitUntil: 'networkidle' });
check(vendorHits.length === 0, 'GSAP is not downloaded with the first screen', vendorHits.join(', '));

const deadAnchors = await page.evaluate(() => [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href')).filter((h) => h.length > 1 && !document.getElementById(h.slice(1))));
check(deadAnchors.length === 0, 'every in-page link has a target', deadAnchors.join(', '));
const ids = await page.evaluate(() => { const seen = {}; document.querySelectorAll('[id]').forEach((e) => { seen[e.id] = (seen[e.id] || 0) + 1; }); return Object.entries(seen).filter(([, n]) => n > 1).map(([k]) => k); });
check(ids.length === 0, 'no duplicate ids', ids.join(', '));
const noAlt = await page.evaluate(() => [...document.images].filter((i) => !i.alt || i.alt.length < 10).map((i) => i.getAttribute('src')));
check(noAlt.length === 0, 'every photo has a real description (alt text)', noAlt.join(', '));

// price table: printed rows agree with the formula, and the slider updates them
const RATES = { comp: [600, 850, 15], metal: [1200, 1700, 6], cedar: [1300, 1900, 6] };
const fmt = (n) => '$' + (Math.round(n / 50) * 50).toLocaleString('en-US');
const want = (key, sq) => { const [lo, hi, perDay] = RATES[key]; const d = Math.max(1, Math.ceil(sq / perDay)); return { price: `${fmt(sq * lo)}–${fmt(sq * hi)}`, days: `${d} dry ${d === 1 ? 'day' : 'days'}` }; };
const read = () => page.evaluate(() => Object.fromEntries(['comp', 'metal', 'cedar'].map((k) => [k, { price: document.querySelector(`[data-price="${k}"]`).textContent, days: document.querySelector(`[data-days="${k}"]`).textContent }])));
const html = readFileSync(join(root, 'index.html'), 'utf8');
for (const key of Object.keys(RATES)) {
  const printed = { price: html.match(new RegExp(`data-price="${key}">([^<]+)<`))[1], days: html.match(new RegExp(`data-days="${key}">([^<]+)<`))[1] };
  check(JSON.stringify(printed) === JSON.stringify(want(key, 22)), `printed row matches the formula (${key}, 22 squares)`, `${JSON.stringify(printed)} vs ${JSON.stringify(want(key, 22))}`);
}
check(await page.isVisible('[data-sizer]'), 'size slider is shown when scripts run');
for (const sq of [8, 15, 30, 45]) {
  await page.$eval('#squares', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, String(sq));
  const got = await read(); const exp = Object.fromEntries(Object.keys(RATES).map((k) => [k, want(k, sq)]));
  check(JSON.stringify(got) === JSON.stringify(exp), `slider at ${sq} squares updates all three roofs`, `${JSON.stringify(got)} vs ${JSON.stringify(exp)}`);
}
const cap = await page.textContent('.price-table caption');
check(/45 squares/.test(cap), 'table caption follows the slider (for screen readers)', cap);
const hrefs = await page.$$eval('[data-book]', (as) => as.map((a) => a.href));
check(hrefs.length >= 2 && hrefs.every((h) => /^mailto:estimates@fernhill-roofing\.example/.test(h) && /45%20squares/.test(h)), 'booking links carry the chosen roof size', hrefs[0].slice(0, 140));
await page.focus('#squares'); await page.keyboard.press('ArrowLeft');
check(await page.textContent('[data-out="squares"]') === '44', 'slider works from the keyboard', await page.textContent('[data-out="squares"]'));

// layers: GSAP ScrollTrigger scrubs the zoom with the scroll (whole house → chimney flashing → ridge)
const STAGE2 = [11.6, 10.6, 32.8, 33.8], STAGE3 = [14.4, 37.8, 54.3, 30.9];
const near = (a, b, tol = 0.6) => a.length === 4 && a.every((v, i) => Math.abs(v - b[i]) <= tol);
const crop = (p) => p.evaluate(() => (getComputedStyle(document.querySelector('.frame img')).objectViewBox.match(/-?[\d.]+/g) || []).map(Number).concat([0, 0, 0, 0]).slice(0, 4));
const layersBox = (p) => p.evaluate(() => { const r = document.querySelector('[data-layers]').getBoundingClientRect(); return { top: r.top + scrollY, h: r.height }; });
const scrollTo = async (p, box, f) => { await p.evaluate((y) => window.scrollTo(0, y), Math.round(box.top + (box.h - 900) * f)); await p.waitForTimeout(1200); };
const lbox = await layersBox(page);
await scrollTo(page, lbox, 0.02);
check(await page.evaluate(() => typeof window.gsap?.version === 'string' && !!window.ScrollTrigger), 'GSAP and ScrollTrigger load (self-hosted) once the zoom section is near', `${await page.evaluate(() => window.gsap?.version)} via ${vendorHits.join(', ')}`);
check(await page.evaluate(() => document.querySelector('[data-layers]').classList.contains('is-scrubbed')), 'the zoom is driven by GSAP');
const crops = [];
for (const f of [0.02, 0.25, 0.5, 0.95]) { await scrollTo(page, lbox, f); crops.push(await crop(page)); }
check(near(crops[0], [0, 0, 0, 0]), 'zoom starts on the whole house', JSON.stringify(crops[0]));
check(!near(crops[1], [0, 0, 0, 0]) && !near(crops[1], STAGE2), 'zoom moves smoothly between distances (not in jumps)', JSON.stringify(crops[1]));
check(near(crops[2], STAGE2), 'zoom holds on the chimney flashing mid-way', JSON.stringify(crops[2]));
check(near(crops[3], STAGE3), 'zoom ends on the ridge', JSON.stringify(crops[3]));
const zoomOk = await page.evaluate(() => { const f = document.querySelector('.frame').getBoundingClientRect(); const i = document.querySelector('.frame img').getBoundingClientRect(); return Math.abs(f.width - i.width) < 2 && Math.abs(f.height - i.height) < 2; });
check(zoomOk, 'zoomed photo stays inside its frame');
check(await page.evaluate(() => ['.half-2', '.layers-caption'].map((s) => getComputedStyle(document.querySelector(s)).opacity).every((o) => o === '1')), 'heading and caption are fully shown at the end');
await scrollTo(page, lbox, 0.02);
check(near(await crop(page), [0, 0, 0, 0]) && await page.evaluate(() => getComputedStyle(document.querySelector('.layers-caption')).opacity) === '0', 'scrolling back up reverses the zoom', JSON.stringify(await crop(page)));

// if GSAP fails to load, the three-step CSS zoom still works
const noGsap = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const pg = await noGsap.newPage();
await pg.route('**/vendor/*.js', (r) => r.abort());
await pg.goto(URL_, { waitUntil: 'load' });
const gbox = await layersBox(pg); const steps = [];
for (const f of [0.1, 0.5, 0.9]) { await scrollTo(pg, gbox, f); steps.push(await pg.getAttribute('[data-layers]', 'data-stage')); }
check(JSON.stringify(steps) === '["1","2","3"]', 'without GSAP, the zoom falls back to three steps', JSON.stringify(steps));
await noGsap.close();

// faq: one answer open at a time
await page.evaluate(() => document.querySelector('#faq').scrollIntoView());
await page.click('#faq details:nth-of-type(2) summary');
await page.click('#faq details:nth-of-type(4) summary');
const openCount = await page.evaluate(() => [...document.querySelectorAll('#faq details[open]')].map((d) => d.querySelector('summary').textContent.trim()));
check(openCount.length === 1 && /moss/.test(openCount[0]), 'FAQ: one answer open at a time', JSON.stringify(openCount));
await page.close();

// ---------- 3. without JavaScript ----------
const nojs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
const p2 = await nojs.newPage();
await p2.goto(URL_, { waitUntil: 'networkidle' });
const nojsState = await p2.evaluate(() => ({
  sliderHidden: document.querySelector('[data-sizer]').hidden,
  rows: document.querySelectorAll('.price-table tr').length,
  hiddenReveal: [...document.querySelectorAll('[data-reveal]')].filter((e) => getComputedStyle(e).opacity === '0').length,
  layersText: ['.half-2', '.layers-caption'].map((s) => getComputedStyle(document.querySelector(s)).opacity),
}));
check(nojsState.sliderHidden && nojsState.rows === 8, 'no-JS: price table readable, dead slider hidden', JSON.stringify(nojsState));
check(nojsState.hiddenReveal === 0, 'no-JS: nothing left invisible', JSON.stringify(nojsState));
check(nojsState.layersText.every((o) => o === '1'), 'no-JS: both halves of the layers heading and its caption show', JSON.stringify(nojsState));
await nojs.close();

// ---------- 4. reduced motion ----------
const rm = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
const p3 = await rm.newPage();
const rmVendor = [];
p3.on('request', (r) => { if (/\/vendor\//.test(r.url())) rmVendor.push(r.url()); });
await p3.goto(URL_, { waitUntil: 'networkidle' });
await p3.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); } });
await p3.waitForTimeout(800);
check(rmVendor.length === 0, 'reduced motion: GSAP is never downloaded', rmVendor.join(', '));
const anim = await p3.evaluate(() => ['.name-word', '.slot', '.slot img', '.hero-foot'].map((s) => getComputedStyle(document.querySelector(s)).animationName));
check(anim.every((a) => a === 'none'), 'reduced motion: no load animations', anim.join(', '));
check(await p3.evaluate(() => getComputedStyle(document.querySelector('.frame img')).transitionDuration) === '0s', 'reduced motion: zoom changes without travel');
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
