-- Revenue Recovery AI -- initial schema.
-- Tenancy model: every customer-facing row carries business_id. RLS restricts
-- reads/writes to businesses the caller belongs to via business_members.
-- Webhook handlers use the service role, which bypasses RLS by design and does
-- its own tenant resolution (phone number -> business) server-side.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums ----
create type member_role          as enum ('owner', 'admin', 'staff');
create type lead_status          as enum ('new','contacted','qualified','booked','completed','lost','spam');
create type lead_urgency         as enum ('emergency','urgent','routine','unknown');
create type conversation_channel as enum ('voice','sms','web');
create type conversation_status  as enum ('active','completed','escalated','abandoned');
create type message_direction    as enum ('inbound','outbound');
create type appointment_status   as enum ('scheduled','confirmed','completed','cancelled','no_show');
create type subscription_status  as enum ('trialing','active','past_due','canceled','incomplete','unpaid');
create type safety_class         as enum ('SAFE','NEEDS_HUMAN','HIGH_VALUE','RISK','SPAM');

-- ---------------------------------------------------------------- users ----
-- Mirrors auth.users so app tables can hold a real FK.
create table users (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null,
  name            text,
  is_super_admin  boolean not null default false,
  created_at      timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------- businesses ----
create table businesses (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null references users(id) on delete restrict,
  name                  text not null,
  slug                  text not null unique,
  phone                 text,
  email                 text,
  website               text,
  industry              text not null default 'hvac',
  address               text,
  service_area          jsonb not null default '{"cities":[],"zip_codes":[],"radius_miles":null}'::jsonb,
  timezone              text not null default 'America/New_York',
  business_hours        jsonb not null default '{}'::jsonb,
  emergency_enabled     boolean not null default false,
  emergency_instructions text,
  booking_url           text,
  booking_availability  jsonb not null default '{"days":[1,2,3,4,5],"start":"08:00","end":"17:00"}'::jsonb,
  appointment_duration_minutes integer not null default 120,
  onboarding_completed  boolean not null default false,
  ai_enabled            boolean not null default true,
  sms_enabled           boolean not null default true,
  voice_enabled         boolean not null default true,
  booking_enabled       boolean not null default true,
  web_chat_enabled      boolean not null default false,
  is_demo               boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table business_members (
  business_id uuid not null references businesses(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  role        member_role not null default 'staff',
  created_at  timestamptz not null default now(),
  primary key (business_id, user_id)
);

create table business_services (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references businesses(id) on delete cascade,
  name                text not null,
  description         text,
  category            text,
  emergency_available boolean not null default false,
  average_job_value   numeric(12,2) not null default 0,
  active              boolean not null default true,
  created_at          timestamptz not null default now()
);

create table business_faqs (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  question    text not null,
  answer      text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- leads ----
create table leads (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references businesses(id) on delete cascade,
  name              text,
  phone             text,
  email             text,
  address           text,
  service_requested text,
  urgency           lead_urgency not null default 'unknown',
  source            conversation_channel not null default 'voice',
  status            lead_status not null default 'new',
  estimated_value   numeric(12,2) not null default 0,
  actual_value      numeric(12,2),
  ai_summary        text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table conversations (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references businesses(id) on delete cascade,
  lead_id           uuid references leads(id) on delete set null,
  channel           conversation_channel not null,
  external_id       text,
  status            conversation_status not null default 'active',
  classification    safety_class,
  escalation_reason text,
  started_at        timestamptz not null default now(),
  ended_at          timestamptz,
  summary           text
);

create table messages (
  id                  uuid primary key default gen_random_uuid(),
  conversation_id     uuid not null references conversations(id) on delete cascade,
  business_id         uuid not null references businesses(id) on delete cascade,
  direction           message_direction not null,
  sender              text not null,
  body                text not null,
  external_message_id text,
  created_at          timestamptz not null default now()
);

create table calls (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references businesses(id) on delete cascade,
  lead_id         uuid references leads(id) on delete set null,
  conversation_id uuid references conversations(id) on delete set null,
  twilio_call_sid text unique,
  from_number     text,
  to_number       text,
  duration        integer,
  outcome         text,
  recording_url   text,
  transcript      text,
  created_at      timestamptz not null default now()
);

create table appointments (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  lead_id     uuid references leads(id) on delete set null,
  start_time  timestamptz not null,
  end_time    timestamptz not null,
  status      appointment_status not null default 'scheduled',
  source      conversation_channel not null default 'voice',
  notes       text,
  created_at  timestamptz not null default now(),
  constraint appointment_time_order check (end_time > start_time)
);

create table appointment_blackouts (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  start_time  timestamptz not null,
  end_time    timestamptz not null,
  reason      text,
  constraint blackout_time_order check (end_time > start_time)
);

create table revenue_events (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references businesses(id) on delete cascade,
  lead_id         uuid references leads(id) on delete set null,
  appointment_id  uuid references appointments(id) on delete set null,
  event_type      text not null,
  estimated_value numeric(12,2) not null default 0,
  actual_value    numeric(12,2),
  created_at      timestamptz not null default now()
);

create table ai_actions (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references businesses(id) on delete cascade,
  lead_id         uuid references leads(id) on delete set null,
  conversation_id uuid references conversations(id) on delete set null,
  agent           text not null,
  action          text not null,
  input_summary   text,
  output_summary  text,
  success         boolean not null default true,
  error           text,
  model           text,
  input_tokens    integer,
  output_tokens   integer,
  estimated_cost  numeric(12,6),
  latency_ms      integer,
  created_at      timestamptz not null default now()
);

create table subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  business_id            uuid not null unique references businesses(id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text unique,
  plan                   text not null default 'starter',
  status                 subscription_status not null default 'incomplete',
  current_period_end     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table usage_events (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references businesses(id) on delete cascade,
  event_type     text not null,
  quantity       numeric(12,4) not null default 1,
  estimated_cost numeric(12,6) not null default 0,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create table phone_numbers (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references businesses(id) on delete cascade,
  provider     text not null default 'twilio',
  phone_number text not null unique,
  twilio_sid   text,
  status       text not null default 'active',
  created_at   timestamptz not null default now()
);

create table prospects (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references businesses(id) on delete cascade,
  company            text not null,
  website            text,
  phone              text,
  city               text,
  state              text,
  industry           text not null default 'hvac',
  rating             numeric(3,2),
  review_count       integer,
  services           text[],
  emergency_service  boolean,
  website_quality    text,
  lead_score         integer not null default 0,
  opportunity_reason text,
  contact_status     text not null default 'new',
  outreach           jsonb,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table audit_logs (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  user_id     uuid references users(id) on delete set null,
  action      text not null,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- -------------------------------------------------------------- indexes ----
create index idx_business_members_user       on business_members(user_id);
create index idx_business_services_business  on business_services(business_id);
create index idx_business_faqs_business      on business_faqs(business_id);
create index idx_leads_business_created      on leads(business_id, created_at desc);
create index idx_leads_business_status       on leads(business_id, status);
create index idx_leads_phone                 on leads(phone);
create index idx_conversations_business      on conversations(business_id, started_at desc);
create index idx_conversations_lead          on conversations(lead_id);
create index idx_conversations_external      on conversations(external_id);
create index idx_messages_conversation       on messages(conversation_id, created_at);
create index idx_messages_business           on messages(business_id, created_at desc);
create index idx_calls_business_created      on calls(business_id, created_at desc);
create index idx_calls_lead                  on calls(lead_id);
create index idx_appointments_business_start on appointments(business_id, start_time);
create index idx_appointments_lead           on appointments(lead_id);
create index idx_blackouts_business          on appointment_blackouts(business_id, start_time);
create index idx_revenue_business_created    on revenue_events(business_id, created_at desc);
create index idx_revenue_lead                on revenue_events(lead_id);
create index idx_ai_actions_business_created on ai_actions(business_id, created_at desc);
create index idx_ai_actions_lead             on ai_actions(lead_id);
create index idx_usage_business_created      on usage_events(business_id, created_at desc);
create index idx_phone_numbers_business      on phone_numbers(business_id);
create index idx_prospects_business_score    on prospects(business_id, lead_score desc);
create index idx_prospects_status            on prospects(business_id, contact_status);
create index idx_audit_business_created      on audit_logs(business_id, created_at desc);
