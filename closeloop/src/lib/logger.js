'use strict';
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[process.env.LOG_LEVEL || 'info'] || 20;

function emit(level, scope, message, data) {
  if (LEVELS[level] < threshold) return;
  const line = { t: new Date().toISOString(), level, scope, message };
  if (data !== undefined) line.data = data;
  const out = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  out.write(JSON.stringify(line) + '\n');
}

module.exports = {
  debug: (s, m, d) => emit('debug', s, m, d),
  info: (s, m, d) => emit('info', s, m, d),
  warn: (s, m, d) => emit('warn', s, m, d),
  error: (s, m, d) => emit('error', s, m, d),
};
