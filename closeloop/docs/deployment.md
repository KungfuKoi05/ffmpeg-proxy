# Deployment

## Run it locally (2 minutes, $0)

```bash
cd closeloop
node --version          # must be >= 22.5
npm run seed            # creates data/closeloop.db with a demo client
npm start               # http://localhost:3000
```

`npm install` is not required — there are no dependencies.

| URL | What |
|---|---|
| `http://localhost:3000/` | marketing site + ROI calculator |
| `http://localhost:3000/dashboard` | operator console |
| `http://localhost:3000/health` | health check |

Default login is `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`
(`owner@example.com` / `change-me-now` if unset). The seed also creates a
client-role login: `demo-client@example.test` / `demo-client-pw`.

## Before anyone else can reach it

Non-negotiable, in order:

1. **`cp .env.example .env`** and set:
   - `ADMIN_PASSWORD` — a real password. Changing it later and restarting now
     works: the app reconciles the operator credential from the environment.
   - `SESSION_SECRET` — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
     Without it, everyone is logged out on every restart.
   - `WEBHOOK_SECRET` — otherwise anyone who learns a `client_id` can inject leads.
   - `BASE_URL` — your real https URL, so session cookies get the `Secure` flag.
2. **Terminate TLS.** Caddy or nginx in front. Never expose port 3000 directly.
3. **Set up backups.** The entire business is one SQLite file. See below.
4. Leave `AUTOMATION_MODE=TEST` until you have read what the system would send.

## Hosting options

Ranked by cost, which is the constraint that matters at $100 of capital.

### 1. A $5 VPS (recommended)

Hetzner CX22 (~€4/mo), DigitalOcean, or Vultr. One process, one file, systemd.
Cheapest path to a persistent, always-on service.

```ini
# /etc/systemd/system/closeloop.service
[Unit]
Description=Closeloop
After=network.target

[Service]
Type=simple
User=closeloop
WorkingDirectory=/opt/closeloop
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=5
EnvironmentFile=/opt/closeloop/.env
# Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/opt/closeloop/data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now closeloop
sudo journalctl -u closeloop -f
```

Caddy gives you HTTPS in two lines:

```
closeloop.example.com {
    reverse_proxy localhost:3000
}
```

### 2. Container

```dockerfile
FROM node:22-slim
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY public ./public
COPY web ./web
RUN mkdir -p data && chown -R node:node /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
```

Mount a volume at `/app/data` or you lose the database on redeploy.

Works on Fly.io, Railway, Render. **Attach a persistent volume** — ephemeral
container filesystems will silently destroy your data.

### 3. Serverless (Vercel/Cloudflare) — not recommended as-is

The marketing site in `web/` is static and deploys anywhere for free. The **app**
assumes a local filesystem and an in-process scheduler, so serverless needs the
Postgres migration first. Don't split them until there's a reason.

### Splitting the marketing site off

`web/` is fully static apart from two API calls (`/api/public/roi`,
`/api/public/demo-request`). To host it free on Vercel/Cloudflare Pages, deploy
`web/` and point those two paths at the app's origin with CORS enabled. Worth
doing once the site gets real traffic; not before.

## Backups

**Do this before your first paying client.** The whole business is in one file.

```bash
# /etc/cron.daily/closeloop-backup
#!/bin/sh
set -e
STAMP=$(date +%Y%m%d-%H%M)
# .backup is safe on a live database; cp is not (WAL mode).
sqlite3 /opt/closeloop/data/closeloop.db ".backup '/opt/closeloop/backups/db-$STAMP.sqlite'"
find /opt/closeloop/backups -name 'db-*.sqlite' -mtime +30 -delete
```

Copy off-box weekly (`rclone`, `scp`, anything). **Test a restore once** — an
untested backup is a rumour.

## Going LIVE with real messages

Do these in order. Do not skip ahead.

1. Run in `TEST` for at least a few days. Read every simulated message in the
   Messages tab. Fix the copy until you'd be happy to send it yourself.
2. Buy a Twilio number (~$1.15/mo) and complete **10DLC registration** — US
   carriers will filter unregistered A2P traffic.
3. Set `TWILIO_*` and `SMS_PROVIDER=twilio` in `.env`. Restart.
4. Move the **global** mode to `ASSISTED`. Approve messages by hand for a week.
   You will find copy problems here that you missed reading them in TEST.
5. Confirm consent records exist for the leads you intend to message.
6. Move a **single client** to `LIVE`. Watch the Messages and Logs tabs daily.
7. Only then consider a second client.

## Monitoring

| Check | How |
|---|---|
| Is it up? | `GET /health` — returns 503 if the DB is unreachable |
| Is the engine running? | `last_tick` in `/health`; stale = investigate |
| Errors | Logs tab, or `system_log` where `level='error'` |
| Failed sends | Messages tab filtered to `failed` |
| Spend | Twilio console. Nothing here caps your carrier bill but the daily send cap |

A free uptime monitor (UptimeRobot, Better Stack) pointed at `/health` is worth
the five minutes.

## Rollback

```bash
git log --oneline -5
git checkout <previous-sha>
sudo systemctl restart closeloop
```

The schema uses `CREATE TABLE IF NOT EXISTS` and is additive, so rolling code
back does not require rolling the database back.
