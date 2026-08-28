# Local setup

## Prerequisites
Node 20+, a Supabase account (free), and optionally Anthropic/Twilio/Stripe keys.

## 1. Install
```bash
cd revenue-recovery-ai
npm install
cp .env.example .env.local
```

## 2. Database
Create a Supabase project, then in the SQL editor run in order:
1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_rls.sql`

Copy the project URL, anon key and service role key into `.env.local`.

Verify RLS is on — every table should show "RLS enabled" in the table editor.
If it does not, tenant isolation is not active and you must not go live.

## 3. Run
```bash
npm run dev
```
Sign up at `/signup`, complete `/onboarding`, and you land on `/dashboard`.

## 4. Working without keys
```bash
AI_PROVIDER=mock npm run dev
```
The assistant runs against a deterministic local adapter. `/demo` needs nothing
at all — no keys, no database.

## 5. Seed demo data
```bash
SEED_OWNER_EMAIL=you@example.com npm run db:seed
```
Sign up first so the user exists. Safe to re-run.

## 6. Testing webhooks locally
Twilio must reach your machine:
```bash
npx localtunnel --port 3000     # or ngrok http 3000
```
Set `NEXT_PUBLIC_APP_URL` to the public URL — signature verification rebuilds
the signed URL from it, so a mismatch fails verification.

## Commands
| Command | Does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest |
| `npm run db:seed` | Seed a demo tenant |
