-- Toolbench schema.
--
-- Not yet applied anywhere: the app runs without a database (lib/storage.ts
-- counts events in memory), which is what makes it deployable for $0 today.
-- Apply this when persistence is needed -- Supabase free tier is the intended
-- first home.
--
-- Design rule: this schema CANNOT store user content. There is no files table
-- and no column that holds a document, because every tool runs in the browser
-- and nothing is uploaded. Privacy is enforced by the absence of a place to
-- put the data, not by a policy.

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------- accounts ----
create table users (
  id            uuid primary key default gen_random_uuid(),
  email         citext unique not null,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz
);

create table plans (
  id             text primary key,          -- 'free' | 'pro' | 'business'
  name           text not null,
  monthly_cents  integer not null default 0,
  annual_cents   integer,
  features       jsonb not null default '{}'::jsonb,
  limits         jsonb not null default '{}'::jsonb,
  active         boolean not null default true
);

create table subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references users(id) on delete cascade,
  plan_id                text not null references plans(id),
  status                 text not null,      -- trialing|active|past_due|canceled
  stripe_customer_id     text,
  stripe_subscription_id text unique,
  current_period_end     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table payments (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references users(id) on delete set null,
  stripe_payment_id text unique,
  amount_cents      integer not null,
  currency          text not null default 'usd',
  status            text not null,
  created_at        timestamptz not null default now()
);

create table api_keys (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  -- Only a hash is stored; the key itself is shown once at creation.
  key_hash     text not null unique,
  label        text,
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------- measurement ----
-- Anonymous by construction: session_id is a per-tab random value that is
-- never persisted client-side and cannot be joined to a person.
create table tool_events (
  id          bigserial primary key,
  name        text not null,
  tool        text,
  path        text,
  referrer    text,
  session_id  text not null,
  props       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- Rolled up nightly so dashboards never scan the raw event table.
create table tool_usage_daily (
  day         date not null,
  tool        text not null,
  views       integer not null default 0,
  uses        integer not null default 0,
  successes   integer not null default 0,
  failures    integer not null default 0,
  primary key (day, tool)
);

create table errors (
  id          bigserial primary key,
  tool        text,
  message     text not null,
  context     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create table feedback (
  id          bigserial primary key,
  tool        text,
  rating      smallint check (rating between 1 and 5),
  message     text,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------ growth ------
create table seo_pages (
  slug             text primary key,
  title            text not null,
  description      text not null,
  indexed          boolean not null default true,
  impressions      integer not null default 0,
  clicks           integer not null default 0,
  average_position numeric(5,2),
  updated_at       timestamptz not null default now()
);

create table experiments (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,
  variants    jsonb not null,
  status      text not null default 'draft',
  started_at  timestamptz,
  ended_at    timestamptz,
  notes       text
);

create table rate_limits (
  bucket      text primary key,
  count       integer not null default 0,
  reset_at    timestamptz not null
);

create table audit_logs (
  id          bigserial primary key,
  user_id     uuid references users(id) on delete set null,
  action      text not null,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- -------------------------------------------------------------- indexes ----
create index idx_tool_events_created  on tool_events (created_at desc);
create index idx_tool_events_tool     on tool_events (tool, created_at desc);
create index idx_tool_events_name     on tool_events (name, created_at desc);
create index idx_tool_events_session  on tool_events (session_id);
create index idx_usage_daily_tool     on tool_usage_daily (tool, day desc);
create index idx_subs_user            on subscriptions (user_id);
create index idx_payments_user        on payments (user_id, created_at desc);
create index idx_errors_created       on errors (created_at desc);
create index idx_api_keys_user        on api_keys (user_id);

-- Raw events are for debugging, not for keeping. Retention keeps the free
-- tier viable and means an old event can never become a liability.
-- Run daily:
--   delete from tool_events where created_at < now() - interval '90 days';

insert into plans (id, name, monthly_cents, annual_cents, features, limits) values
  ('free',     'Free',     0,    null,
   '{"ads": true}',
   '{"batch": 1, "history": 0}'),
  ('pro',      'Pro',      900,  7900,
   '{"ads": false, "batch": true, "history": true, "priority": true}',
   '{"batch": 50, "history": 100}'),
  ('business', 'Business', 2900, 27900,
   '{"ads": false, "batch": true, "history": true, "api": true, "team": true}',
   '{"batch": 500, "history": 1000, "api_calls_per_month": 50000}')
on conflict (id) do nothing;
