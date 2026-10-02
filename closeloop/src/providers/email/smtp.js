'use strict';
const net = require('node:net');
const tls = require('node:tls');
const { config } = require('../../config');

// Minimal SMTP client (AUTH LOGIN over STARTTLS or implicit TLS).
// Deliberately dependency-free. Suitable for transactional volume via a free
// tier such as Brevo (300/day) or Resend's SMTP bridge (3k/mo).
module.exports = {
  name: 'smtp',
  costsMoney: true, // free tiers exist, but overage bills - treat as paid
  isConfigured: () => Boolean(config.smtp.host && config.smtp.user && config.smtp.pass && config.smtp.from),
  async send({ to, subject, body }) {
    if (!this.isConfigured()) return { ok: false, error: 'smtp_not_configured' };
    const { host, port, user, pass, from } = config.smtp;
    const b64 = (s) => Buffer.from(s).toString('base64');
    const message = [
      `From: ${from}`, `To: ${to}`, `Subject: ${subject}`,
      'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', '',
      body.replace(/^\./gm, '..'), '.', // dot-stuffing per RFC 5321
    ].join('\r\n');

    return new Promise((resolve) => {
      const useTls = port === 465;
      const socket = useTls
        ? tls.connect({ host, port, servername: host })
        : net.connect({ host, port });

      socket.setEncoding('utf8');
      let stage = 'greet';
      let buf = '';
      let active = socket;

      const fail = (msg) => { try { active.destroy(); } catch {} resolve({ ok: false, error: msg }); };
      const timer = setTimeout(() => fail('smtp_timeout'), 25_000);

      const write = (line) => active.write(line + '\r\n');

      const onData = (chunk) => {
        buf += chunk;
        const lines = buf.split('\r\n').filter(Boolean);
        const last = lines[lines.length - 1] || '';
        if (!/^\d{3} /.test(last)) return; // multiline reply still arriving
        const code = Number(last.slice(0, 3));
        buf = '';

        try {
          switch (stage) {
            case 'greet':
              if (code !== 220) return fail(`smtp_greet_${code}`);
              stage = useTls ? 'ehlo_tls' : 'ehlo'; write(`EHLO closeloop`); return;
            case 'ehlo':
              if (code !== 250) return fail(`smtp_ehlo_${code}`);
              stage = 'starttls'; write('STARTTLS'); return;
            case 'starttls': {
              if (code !== 220) return fail(`smtp_starttls_${code}`);
              active.removeListener('data', onData);
              const secure = tls.connect({ socket, servername: host }, () => {
                stage = 'ehlo_tls'; active = secure; secure.setEncoding('utf8');
                secure.on('data', onData); secure.on('error', (e) => fail(`smtp_tls: ${e.message}`));
                write('EHLO closeloop');
              });
              return;
            }
            case 'ehlo_tls':
              if (code !== 250) return fail(`smtp_ehlo_${code}`);
              stage = 'auth'; write('AUTH LOGIN'); return;
            case 'auth':
              if (code !== 334) return fail(`smtp_auth_${code}`);
              stage = 'user'; write(b64(user)); return;
            case 'user':
              if (code !== 334) return fail(`smtp_user_${code}`);
              stage = 'pass'; write(b64(pass)); return;
            case 'pass':
              if (code !== 235) return fail(`smtp_authfail_${code}`);
              stage = 'from'; write(`MAIL FROM:<${from}>`); return;
            case 'from':
              if (code !== 250) return fail(`smtp_from_${code}`);
              stage = 'rcpt'; write(`RCPT TO:<${to}>`); return;
            case 'rcpt':
              if (![250, 251].includes(code)) return fail(`smtp_rcpt_${code}`);
              stage = 'data'; write('DATA'); return;
            case 'data':
              if (code !== 354) return fail(`smtp_data_${code}`);
              stage = 'body'; active.write(message + '\r\n'); return;
            case 'body': {
              clearTimeout(timer);
              if (code !== 250) return fail(`smtp_send_${code}`);
              stage = 'quit'; write('QUIT');
              try { active.end(); } catch {}
              return resolve({ ok: true, providerId: `smtp_${Date.now().toString(36)}` });
            }
            default: return;
          }
        } catch (err) { return fail(`smtp_error: ${err.message}`); }
      };

      socket.on('data', onData);
      socket.on('error', (e) => { clearTimeout(timer); resolve({ ok: false, error: `smtp_socket: ${e.message}` }); });
    });
  },
};
