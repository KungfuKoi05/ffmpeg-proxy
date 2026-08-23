'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { config } = require('../config');
const { id, nowIso } = require('../lib/ids');

let db = null;

// node:sqlite hands back null-prototype rows. Those break `instanceof Object`
// checks and spread awkwardly in some call sites, so normalise once here.
const plain = (row) => (row ? { ...row } : row);
const plainAll = (rows) => rows.map((r) => ({ ...r }));

function open(dbPath = config.dbPath) {
  if (db) return db;
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new DatabaseSync(dbPath);
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  return db;
}

function handle() {
  if (!db) open();
  return db;
}

function close() {
  if (db) { db.close(); db = null; }
}

// --- query helpers ---------------------------------------------------------
const run = (sql, ...params) => handle().prepare(sql).run(...params);
const get = (sql, ...params) => plain(handle().prepare(sql).get(...params));
const all = (sql, ...params) => plainAll(handle().prepare(sql).all(...params));

// Wrap a function in a transaction. node:sqlite has no helper for this.
function tx(fn) {
  const h = handle();
  h.exec('BEGIN');
  try {
    const result = fn();
    h.exec('COMMIT');
    return result;
  } catch (err) {
    h.exec('ROLLBACK');
    throw err;
  }
}

/**
 * Insert a row from a plain object. Keeps call sites free of column lists that
 * drift out of sync with the schema.
 */
function insert(table, row) {
  const keys = Object.keys(row);
  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
  handle().prepare(sql).run(...keys.map((k) => normalise(row[k])));
  return row.id;
}

function update(table, rowId, patch) {
  const keys = Object.keys(patch);
  if (!keys.length) return;
  const sql = `UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`;
  handle().prepare(sql).run(...keys.map((k) => normalise(patch[k])), rowId);
}

// SQLite has no boolean and no undefined. Normalise at the boundary so callers
// can pass natural JS values.
function normalise(v) {
  if (v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v !== null && typeof v === 'object') return JSON.stringify(v);
  return v;
}

/** Append to the audit trail. Never throws into the caller's path. */
function logEvent({ clientId = null, entityType, entityId, type, data = null, actor = 'system' }) {
  try {
    insert('events', {
      id: id('evt'),
      client_id: clientId,
      entity_type: entityType,
      entity_id: entityId,
      type,
      data: data ? JSON.stringify(data) : null,
      actor,
      created_at: nowIso(),
    });
  } catch (err) {
    process.stderr.write(`event log failed: ${err.message}\n`);
  }
}

function logSystem(level, scope, message, data = null) {
  try {
    insert('system_log', {
      id: id('log'), level, scope, message,
      data: data ? JSON.stringify(data) : null,
      created_at: nowIso(),
    });
  } catch { /* logging must never break the caller */ }
}

const setSetting = (key, value) =>
  run(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      key, String(value), nowIso());

const getSetting = (key, fallback = null) => {
  const row = get('SELECT value FROM settings WHERE key = ?', key);
  return row ? row.value : fallback;
};

module.exports = {
  open, close, handle, run, get, all, tx, insert, update,
  logEvent, logSystem, setSetting, getSetting,
};
