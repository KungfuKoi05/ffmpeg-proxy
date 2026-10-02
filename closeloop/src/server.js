'use strict';
const http = require('node:http');
const path = require('node:path');
const { config } = require('./config');
const db = require('./db');
const H = require('./lib/http');
const auth = require('./lib/auth');
const log = require('./lib/logger');
const scheduler = require('./engine/scheduler');

const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const WEB_DIR = path.resolve(__dirname, '..', 'web');

// Paths that never require a session.
const OPEN_PREFIXES = ['/api/public/', '/webhooks/', '/login', '/logout', '/health'];
const isOpen = (pathname) => OPEN_PREFIXES.some((p) => pathname.startsWith(p));

function buildRouter() {
  const router = new H.Router();
  require('./routes/public').register(router);
  require('./routes/webhooks').register(router);
  require('./routes/api').register(router);

  router.post('/login', async (req, res) => {
    const body = await H.readBody(req, 10_000);
    const user = auth.authenticate(body.email, body.password);
    if (!user) {
      db.logSystem('warn', 'auth', 'failed login', { email: String(body.email || '').slice(0, 80) });
      return H.unauthorized(res, 'invalid email or password');
    }
    const token = auth.createSession(user);
    res.setHeader('set-cookie', auth.cookieHeader(token));
    return H.ok(res, { user: { id: user.id, email: user.email, role: user.role, clientId: user.client_id } });
  });

  router.post('/logout', async (req, res) => {
    res.setHeader('set-cookie', auth.cookieHeader(null, { clear: true }));
    return H.ok(res, { ok: true });
  });

  router.get('/health', async (req, res) => {
    let dbOk = true;
    try { db.get('SELECT 1 AS x'); } catch { dbOk = false; }
    return H.json(res, dbOk ? 200 : 503, {
      ok: dbOk,
      mode: config.automationMode,
      last_tick: db.getSetting('engine.last_tick'),
      version: require('../package.json').version,
    });
  });

  return router;
}

function createServer() {
  const router = buildRouter();

  return http.createServer(async (req, res) => {
    const started = Date.now();
    const url = new URL(req.url, config.baseUrl);
    const pathname = url.pathname;

    // Security headers. The CSP is strict: no inline script, no remote origins.
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('x-frame-options', 'DENY');
    res.setHeader('referrer-policy', 'same-origin');
    res.setHeader('content-security-policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");

    try {
      // Authenticate before routing for the whole protected API surface.
      // Doing it here rather than only on matched routes means an unknown
      // /api/ path answers 401 exactly like a real one, so an unauthenticated
      // caller cannot enumerate which endpoints exist.
      let session = null;
      const needsAuth = (pathname.startsWith('/api/') || pathname.startsWith('/admin'))
        && !isOpen(pathname);
      if (needsAuth) {
        session = auth.sessionFromRequest(req);
        if (!session) return H.unauthorized(res);
      }

      const match = router.match(req.method, pathname);
      if (match) {
        if (!session && !isOpen(pathname)) {
          session = auth.sessionFromRequest(req);
          if (!session) return H.unauthorized(res);
        }
        await match.handler(req, res, { params: match.params, url, session: session || {} });
        return;
      }
      if (needsAuth) return H.notFound(res, `no route for ${req.method} ${pathname}`);

      // Static: the marketing site at /site, the app UI everywhere else.
      if (req.method === 'GET') {
        if (pathname === '/' || pathname.startsWith('/site')) {
          const rel = pathname === '/' ? '/index.html' : pathname.replace(/^\/site/, '') || '/index.html';
          if (H.serveStatic(res, WEB_DIR, rel)) return;
        }
        const appPath = pathname === '/' ? '/index.html' : pathname;
        if (H.serveStatic(res, PUBLIC_DIR, appPath)) return;
        // Client-side routes (/dashboard, /admin, /sales, /analytics) all
        // resolve to the same shell; the UI reads the path itself.
        if (['/dashboard', '/admin', '/sales', '/analytics', '/onboarding']
              .some((p) => pathname.startsWith(p))) {
          if (H.serveStatic(res, PUBLIC_DIR, '/index.html')) return;
        }
      }

      return H.notFound(res, `no route for ${req.method} ${pathname}`);
    } catch (err) {
      if (err.message === 'invalid_json') return H.badRequest(res, 'invalid JSON body');
      if (err.message === 'payload_too_large') return H.json(res, 413, { error: 'payload too large' });
      log.error('http', 'unhandled error', { path: pathname, error: err.message, stack: err.stack });
      db.logSystem('error', 'http', `unhandled: ${err.message}`, { path: pathname });
      if (!res.headersSent) return H.json(res, 500, { error: 'internal error' });
      return res.end();
    } finally {
      const ms = Date.now() - started;
      if (ms > 500) log.warn('http', 'slow request', { path: pathname, ms });
    }
  });
}

function start() {
  db.open();
  const operator = auth.ensureOperator();

  for (const warning of config.warnings) log.warn('startup', warning);
  log.info('startup', 'closeloop starting', {
    mode: config.automationMode,
    providers: config.providers,
    operator: operator.email,
    db: config.dbPath,
  });

  const server = createServer();
  server.listen(config.port, () => {
    log.info('startup', `listening on ${config.baseUrl}`);
    process.stdout.write(
      `\n  Closeloop is running.\n` +
      `    App     : ${config.baseUrl}\n` +
      `    Site    : ${config.baseUrl}/site\n` +
      `    Health  : ${config.baseUrl}/health\n` +
      `    Mode    : ${config.automationMode}${config.automationMode === 'TEST' ? '  (nothing is transmitted)' : ''}\n` +
      `    Login   : ${operator.email}\n\n`);
  });

  scheduler.start();

  const shutdown = (signal) => {
    log.info('shutdown', `received ${signal}`);
    scheduler.stop();
    server.close(() => { db.close(); process.exit(0); });
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
}

if (require.main === module) start();

module.exports = { createServer, start, buildRouter };
