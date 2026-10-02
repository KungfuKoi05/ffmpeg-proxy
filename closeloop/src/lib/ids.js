'use strict';
const crypto = require('node:crypto');

// Prefixed, sortable-ish ids. The prefix makes logs and URLs readable and
// makes a copy-pasted id self-describing when debugging with a client.
function id(prefix) {
  return `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(5).toString('hex')}`;
}
const nowIso = () => new Date().toISOString();
const isoPlusHours = (hours, from = new Date()) =>
  new Date(from.getTime() + hours * 3600_000).toISOString();

module.exports = { id, nowIso, isoPlusHours };
