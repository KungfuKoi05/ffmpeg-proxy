'use strict';
const crypto = require('node:crypto');
const db = require('../db');
const { config } = require('../config');
const { id, nowIso } = require('../lib/ids');

// scrypt with a per-user salt. Node ships it, it is memory-hard, and it needs
// no dependency. Cost parameters are the Node defaults (N=16384, r=8, p=1).
const KEYLEN = 64;

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, KEYLEN).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  const candidate = crypto.scryptSync(password, salt, KEYLEN);
  const expected = Buffer.from(hash, 'hex');
  // Length check first: timingSafeEqual throws on a length mismatch.
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

// Stateless signed session cookie: base64(payload).hmac. No session table to
// keep clean, and revocation comes from rotating SESSION_SECRET.
const SESSION_TTL_MS = 12 * 3600_000;

function sign(payloadB64) {
  return crypto.createHmac('sha256', config.sessionSecret).update(payloadB64).digest('base64url');
}

function createSession(user) {
  const payload = Buffer.from(JSON.stringify({
    uid: user.id, role: user.role, clientId: user.client_id || null,
    exp: Date.now() + SESSION_TTL_MS,
  })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function readSession(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');
  const expected = sign(payload);
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch { return null; }
}

const parseCookies = (header) => Object.fromEntries(
  (header || '').split(';').map((p) => p.trim()).filter(Boolean)
    .map((p) => { const i = p.indexOf('='); return [p.slice(0, i), decodeURIComponent(p.slice(i + 1))]; }));

function sessionFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie);
  return readSession(cookies.cl_session);
}

function cookieHeader(token, { clear = false } = {}) {
  const secure = config.baseUrl.startsWith('https') ? '; Secure' : '';
  if (clear) return `cl_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
  return `cl_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}${secure}`;
}

function createUser({ email, password, role, clientId = null }) {
  const { hash, salt } = hashPassword(password);
  const userId = id('usr');
  db.insert('users', {
    id: userId, email: email.toLowerCase(), password_hash: hash, password_salt: salt,
    role, client_id: clientId, created_at: nowIso(),
  });
  return db.get('SELECT id, email, role, client_id FROM users WHERE id = ?', userId);
}

function authenticate(email, password) {
  const user = db.get('SELECT * FROM users WHERE email = ?', String(email || '').toLowerCase());
  if (!user) {
    // Burn equivalent time on a missing user so the response time doesn't
    // reveal which addresses exist.
    crypto.scryptSync(String(password || ''), 'decoy-salt', KEYLEN);
    return null;
  }
  if (!verifyPassword(String(password || ''), user.password_hash, user.password_salt)) return null;
  db.update('users', user.id, { last_login_at: nowIso() });
  return { id: user.id, email: user.email, role: user.role, client_id: user.client_id };
}

/**
 * Create or reconcile the operator account from env.
 *
 * The env file is the source of truth for the single operator login, so this
 * also RESETS the stored password when ADMIN_PASSWORD has changed. Without
 * that, editing ADMIN_PASSWORD after first boot silently does nothing and
 * locks the operator out of their own instance - which is exactly what a
 * person does the first time they take this off localhost.
 */
function ensureOperator() {
  const existing = db.get('SELECT * FROM users WHERE role = ? LIMIT 1', 'operator');
  if (!existing) {
    return createUser({ email: config.adminEmail, password: config.adminPassword, role: 'operator' });
  }

  const patch = {};
  if (existing.email !== config.adminEmail.toLowerCase()) {
    patch.email = config.adminEmail.toLowerCase();
  }
  if (!verifyPassword(config.adminPassword, existing.password_hash, existing.password_salt)) {
    const { hash, salt } = hashPassword(config.adminPassword);
    patch.password_hash = hash;
    patch.password_salt = salt;
  }
  if (Object.keys(patch).length) {
    db.update('users', existing.id, patch);
    db.logSystem('info', 'auth', 'operator credentials reconciled from environment',
                 { changed: Object.keys(patch) });
    return db.get('SELECT * FROM users WHERE id = ?', existing.id);
  }
  return existing;
}

module.exports = {
  hashPassword, verifyPassword, createSession, readSession, sessionFromRequest,
  cookieHeader, createUser, authenticate, ensureOperator, parseCookies,
};
