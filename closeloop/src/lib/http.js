'use strict';
const fs = require('node:fs');
const path = require('node:path');

// A tiny router. Express would work, but this app's whole routing surface is
// ~40 routes of static segments and one :param each, which is about 60 lines.
// Zero dependencies means zero install step and no supply-chain surface.

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.csv': 'text/csv; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json',
};

class Router {
  constructor() { this.routes = []; }
  add(method, pattern, handler) {
    const segments = pattern.split('/').filter(Boolean);
    this.routes.push({ method, segments, handler, pattern });
    return this;
  }
  get(p, h) { return this.add('GET', p, h); }
  post(p, h) { return this.add('POST', p, h); }
  patch(p, h) { return this.add('PATCH', p, h); }
  put(p, h) { return this.add('PUT', p, h); }
  delete(p, h) { return this.add('DELETE', p, h); }

  match(method, pathname) {
    const parts = pathname.split('/').filter(Boolean);
    for (const route of this.routes) {
      if (route.method !== method) continue;
      if (route.segments.length !== parts.length) continue;
      const params = {};
      let ok = true;
      for (let i = 0; i < route.segments.length; i += 1) {
        const seg = route.segments[i];
        if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(parts[i]);
        else if (seg !== parts[i]) { ok = false; break; }
      }
      if (ok) return { handler: route.handler, params };
    }
    return null;
  }
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'x-content-type-options': 'nosniff',
  });
  res.end(body);
}

const ok = (res, payload) => json(res, 200, payload);
const created = (res, payload) => json(res, 201, payload);
const badRequest = (res, message, detail) => json(res, 400, { error: message, detail });
const unauthorized = (res, message = 'authentication required') => json(res, 401, { error: message });
const forbidden = (res, message = 'forbidden') => json(res, 403, { error: message });
const notFound = (res, message = 'not found') => json(res, 404, { error: message });

/** Read and parse a JSON body with a hard size cap. */
function readBody(req, limitBytes = 1_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let aborted = false;
    const chunks = [];
    req.on('data', (chunk) => {
      if (aborted) return;
      size += chunk.length;
      if (size > limitBytes) {
        // Reject, but leave the socket alive: destroying it here races the
        // 413 response and the client sees a connection error instead.
        aborted = true;
        chunks.length = 0;
        reject(new Error('payload_too_large'));
        req.resume();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (aborted) return;
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      const type = req.headers['content-type'] || '';
      try {
        if (type.includes('application/x-www-form-urlencoded')) {
          return resolve(Object.fromEntries(new URLSearchParams(raw)));
        }
        return resolve(JSON.parse(raw));
      } catch { return reject(new Error('invalid_json')); }
    });
    req.on('error', reject);
  });
}

/**
 * Serve a file from `root`, refusing anything that escapes it.
 * The resolve-then-prefix-check is the important line: it defeats
 * "../../etc/passwd" and its encoded variants after normalisation.
 */
function serveStatic(res, root, urlPath, { index = 'index.html' } = {}) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel.endsWith('/')) rel += index;
  const resolved = path.resolve(root, '.' + path.posix.normalize(rel));
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    json(res, 403, { error: 'forbidden' });
    return true;
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return false;

  const ext = path.extname(resolved).toLowerCase();
  const stat = fs.statSync(resolved);
  const etag = `W/"${stat.size}-${stat.mtimeMs}"`;
  res.writeHead(200, {
    'content-type': MIME[ext] || 'application/octet-stream',
    'content-length': stat.size,
    etag,
    'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
    'x-content-type-options': 'nosniff',
  });
  fs.createReadStream(resolved).pipe(res);
  return true;
}

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = {
  Router, json, ok, created, badRequest, unauthorized, forbidden, notFound,
  readBody, serveStatic, escapeHtml, MIME,
};
