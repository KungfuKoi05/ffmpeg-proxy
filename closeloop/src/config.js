'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// Minimal .env loader. Avoids a dependency for something this small.
// Precedence: real process env wins over .env file.
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

const ROOT = path.resolve(__dirname, '..');
loadEnvFile(path.join(ROOT, '.env'));

const MODES = ['OFF', 'TEST', 'ASSISTED', 'LIVE'];

function readMode(value, fallback = 'TEST') {
  const v = String(value || '').toUpperCase();
  return MODES.includes(v) ? v : fallback;
}

// The global mode acts as a ceiling over every client's mode.
// effectiveMode = the more restrictive of (global, client).
function effectiveMode(globalMode, clientMode) {
  return MODES[Math.min(MODES.indexOf(readMode(globalMode)), MODES.indexOf(readMode(clientMode)))];
}

const config = {
  root: ROOT,
  port: Number(process.env.PORT || 3000),
  baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
  env: process.env.NODE_ENV || 'development',

  dbPath: process.env.DB_PATH || path.join(ROOT, 'data', 'closeloop.db'),

  adminEmail: process.env.ADMIN_EMAIL || 'owner@example.com',
  adminPassword: process.env.ADMIN_PASSWORD || 'change-me-now',
  // A random per-boot secret is fine for local dev; it just invalidates
  // sessions on restart. Production must set SESSION_SECRET.
  sessionSecret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  sessionSecretProvided: Boolean(process.env.SESSION_SECRET),

  automationMode: readMode(process.env.AUTOMATION_MODE, 'TEST'),

  providers: {
    sms: process.env.SMS_PROVIDER || 'mock',
    email: process.env.EMAIL_PROVIDER || 'mock',
    ai: process.env.AI_PROVIDER || 'mock',
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    from: process.env.TWILIO_FROM_NUMBER || '',
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || '',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
    baseUrl: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
  },

  webhookSecret: process.env.WEBHOOK_SECRET || '',

  engine: {
    // How often the scheduler wakes up. 60s is plenty; follow-ups are
    // scheduled in hours and days, not seconds.
    tickMs: Number(process.env.ENGINE_TICK_MS || 60_000),
    enabled: process.env.ENGINE_ENABLED !== 'false',
    // Hard ceiling on outbound sends per client per day. A runaway loop
    // costs money and burns a client's phone number reputation.
    maxSendsPerClientPerDay: Number(process.env.MAX_SENDS_PER_CLIENT_PER_DAY || 200),
  },
};

// Startup warnings the operator must not miss.
config.warnings = [];
if (config.automationMode === 'LIVE') {
  config.warnings.push('AUTOMATION_MODE=LIVE - real messages will be sent to real people.');
}
if (config.adminPassword === 'change-me-now') {
  config.warnings.push('ADMIN_PASSWORD is still the default. Change it before exposing this app.');
}
if (!config.sessionSecretProvided) {
  config.warnings.push('SESSION_SECRET not set - sessions reset on every restart.');
}

module.exports = { config, MODES, effectiveMode, readMode };
