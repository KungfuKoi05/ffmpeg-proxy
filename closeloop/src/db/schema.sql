-- Closeloop schema. SQLite (node:sqlite).
-- Convention: all timestamps are ISO-8601 UTC strings (TEXT), never epoch ints.
-- Rationale: node:sqlite returns large INTEGERs as BigInt, which breaks JSON
-- serialisation. TEXT timestamps sort correctly in SQLite and serialise cleanly.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Operator + client accounts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('operator','client')),
  client_id     TEXT REFERENCES clients(id) ON DELETE CASCADE,
  created_at    TEXT NOT NULL,
  last_login_at TEXT
);

-- A client is a business paying us. This is the tenant boundary.
CREATE TABLE IF NOT EXISTS clients (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  industry          TEXT NOT NULL DEFAULT 'other',
  timezone          TEXT NOT NULL DEFAULT 'America/New_York',
  phone             TEXT,
  email             TEXT,
  website           TEXT,
  -- Per-client automation ceiling. Effective mode = min(global, client).
  automation_mode   TEXT NOT NULL DEFAULT 'TEST'
                    CHECK (automation_mode IN ('OFF','TEST','ASSISTED','LIVE')),
  -- Economics, used by the ROI report. Set during onboarding.
  avg_job_value     REAL NOT NULL DEFAULT 0,
  close_rate        REAL NOT NULL DEFAULT 0.25,   -- 0..1
  monthly_fee       REAL NOT NULL DEFAULT 0,
  -- Quiet hours: no outbound between these local hours (24h clock).
  quiet_start_hour  INTEGER NOT NULL DEFAULT 21,
  quiet_end_hour    INTEGER NOT NULL DEFAULT 8,
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','paused','churned','trial')),
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

-- Onboarding answers + brand voice. One row per client, JSON blob for the
-- long tail of questions so we don't migrate the schema for every new field.
CREATE TABLE IF NOT EXISTS client_config (
  client_id      TEXT PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  services       TEXT,          -- JSON array of strings
  hours          TEXT,          -- JSON object
  booking_method TEXT,
  booking_url    TEXT,
  brand_voice    TEXT,
  escalation     TEXT,          -- JSON: who to alert, when
  faqs           TEXT,          -- JSON array of {q,a}
  signature      TEXT,
  extra          TEXT,          -- JSON, anything else captured at onboarding
  updated_at     TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- Leads
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leads (
  id               TEXT PRIMARY KEY,
  client_id        TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name             TEXT,
  phone            TEXT,
  email            TEXT,
  source           TEXT NOT NULL DEFAULT 'manual',
  -- Lifecycle. 'new' -> contacted -> responded -> appointment -> estimate
  --            -> won | lost | nurture
  status           TEXT NOT NULL DEFAULT 'new'
                   CHECK (status IN ('new','contacted','responded','appointment',
                                     'estimate','won','lost','nurture','dnc')),
  classification   TEXT,        -- AI: SERVICE_REQUEST|ESTIMATE|URGENT|...
  classification_confidence REAL,
  classification_source TEXT,   -- 'mock' | 'anthropic' | 'manual' | 'rules'
  intent_note      TEXT,        -- what the lead said they wanted
  estimated_value  REAL NOT NULL DEFAULT 0,
  notes            TEXT,
  consent_sms      INTEGER NOT NULL DEFAULT 0,  -- 0/1, required before LIVE SMS
  consent_source   TEXT,
  opted_out        INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  last_contact_at  TEXT,        -- last OUTBOUND touch we made
  last_response_at TEXT,        -- last INBOUND message from the lead
  first_response_at TEXT,       -- first ever inbound; used for attribution
  next_followup_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_leads_client   ON leads(client_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_followup ON leads(next_followup_at);
CREATE INDEX IF NOT EXISTS idx_leads_created  ON leads(client_id, created_at);

-- ---------------------------------------------------------------------------
-- Estimates - the core wedge. An unsold estimate is the highest-value
-- recoverable asset a high-ticket trade has.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS estimates (
  id           TEXT PRIMARY KEY,
  client_id    TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  lead_id      TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  amount       REAL NOT NULL DEFAULT 0,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'open'
               CHECK (status IN ('open','won','lost','expired')),
  sent_at      TEXT NOT NULL,
  decided_at   TEXT,
  lost_reason  TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_estimates_client ON estimates(client_id, status);

CREATE TABLE IF NOT EXISTS appointments (
  id            TEXT PRIMARY KEY,
  client_id     TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  lead_id       TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  scheduled_at  TEXT NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'estimate_visit',
  status        TEXT NOT NULL DEFAULT 'scheduled'
                CHECK (status IN ('scheduled','confirmed','completed','no_show','cancelled')),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_appts_client ON appointments(client_id, scheduled_at);

-- Won work. `attributed` is set ONLY by the attribution rule in domain/roi.js.
CREATE TABLE IF NOT EXISTS jobs (
  id                 TEXT PRIMARY KEY,
  client_id          TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  lead_id            TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  estimate_id        TEXT REFERENCES estimates(id) ON DELETE SET NULL,
  amount             REAL NOT NULL DEFAULT 0,
  won_at             TEXT NOT NULL,
  attributed         INTEGER NOT NULL DEFAULT 0,   -- 0/1
  attribution_reason TEXT NOT NULL DEFAULT 'not_evaluated',
  created_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_client ON jobs(client_id, won_at);

-- ---------------------------------------------------------------------------
-- Follow-up sequences (configurable per client)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sequences (
  id          TEXT PRIMARY KEY,
  client_id   TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  trigger     TEXT NOT NULL CHECK (trigger IN
              ('missed_call','new_lead','estimate_sent','appointment',
               'reactivation','review_request')),
  enabled     INTEGER NOT NULL DEFAULT 1,
  stop_on_reply INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sequence_steps (
  id           TEXT PRIMARY KEY,
  sequence_id  TEXT NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  step_index   INTEGER NOT NULL,
  delay_hours  REAL NOT NULL,      -- offset from enrollment anchor
  channel      TEXT NOT NULL CHECK (channel IN ('sms','email')),
  template     TEXT NOT NULL,      -- {{first_name}}, {{business}}, {{amount}} ...
  subject      TEXT,               -- email only
  UNIQUE (sequence_id, step_index)
);

CREATE TABLE IF NOT EXISTS enrollments (
  id           TEXT PRIMARY KEY,
  client_id    TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  lead_id      TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  sequence_id  TEXT NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  estimate_id  TEXT REFERENCES estimates(id) ON DELETE CASCADE,
  appointment_id TEXT REFERENCES appointments(id) ON DELETE CASCADE,
  next_step    INTEGER NOT NULL DEFAULT 0,
  next_run_at  TEXT,
  anchor_at    TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active'
               CHECK (status IN ('active','completed','stopped_reply',
                                 'stopped_manual','stopped_optout','stopped_won')),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_enroll_due ON enrollments(status, next_run_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_enroll_unique
  ON enrollments(lead_id, sequence_id, COALESCE(estimate_id, ''), COALESCE(appointment_id, ''));

-- ---------------------------------------------------------------------------
-- Messages: the outbox. Nothing reaches a real person except through here.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id             TEXT PRIMARY KEY,
  client_id      TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  lead_id        TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  enrollment_id  TEXT REFERENCES enrollments(id) ON DELETE SET NULL,
  direction      TEXT NOT NULL CHECK (direction IN ('outbound','inbound')),
  channel        TEXT NOT NULL CHECK (channel IN ('sms','email','call')),
  to_addr        TEXT,
  from_addr      TEXT,
  subject        TEXT,
  body           TEXT NOT NULL,
  -- draft            : generated, not yet eligible
  -- pending_approval : ASSISTED mode, waiting on a human
  -- approved         : human said yes, will send on next tick
  -- sent             : provider accepted it
  -- simulated        : TEST mode - rendered and logged, never transmitted
  -- suppressed       : blocked by a guard (opt-out, quiet hours, no consent)
  -- rejected         : human declined
  -- failed           : provider error
  status         TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','pending_approval','approved','sent',
                                   'simulated','suppressed','rejected','failed')),
  mode_at_creation TEXT NOT NULL,
  provider       TEXT,
  provider_id    TEXT,
  error          TEXT,
  suppress_reason TEXT,
  scheduled_for  TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  sent_at        TEXT,
  approved_by    TEXT
);
CREATE INDEX IF NOT EXISTS idx_messages_client ON messages(client_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_messages_lead   ON messages(lead_id, created_at);

-- ---------------------------------------------------------------------------
-- Universal audit trail. Append-only. Every state change lands here.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id          TEXT PRIMARY KEY,
  client_id   TEXT,
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  type        TEXT NOT NULL,
  data        TEXT,             -- JSON
  actor       TEXT NOT NULL DEFAULT 'system',
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_entity ON events(entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_client ON events(client_id, created_at);

-- Engine + provider failures worth a human's attention.
CREATE TABLE IF NOT EXISTS system_log (
  id         TEXT PRIMARY KEY,
  level      TEXT NOT NULL CHECK (level IN ('info','warn','error')),
  scope      TEXT NOT NULL,
  message    TEXT NOT NULL,
  data       TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_syslog ON system_log(level, created_at);

-- ---------------------------------------------------------------------------
-- Our own sales pipeline (not a client's). Powers /sales.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prospects (
  id            TEXT PRIMARY KEY,
  business_name TEXT NOT NULL,
  industry      TEXT,
  city          TEXT,
  state         TEXT,
  website       TEXT,
  phone         TEXT,
  email         TEXT,
  owner_name    TEXT,
  review_count  INTEGER,
  rating        REAL,
  -- Signals we can actually observe from the outside, used for scoring.
  signals       TEXT,          -- JSON: {no_web_form, slow_response, ...}
  score         INTEGER NOT NULL DEFAULT 0,
  score_reason  TEXT,
  stage         TEXT NOT NULL DEFAULT 'new'
                CHECK (stage IN ('new','researched','contacted','replied',
                                 'meeting','audit_sent','proposal','won','lost','disqualified')),
  last_contact_at TEXT,
  next_followup_at TEXT,
  notes         TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_prospect_stage ON prospects(stage, score);

CREATE TABLE IF NOT EXISTS prospect_events (
  id          TEXT PRIMARY KEY,
  prospect_id TEXT NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  note        TEXT,
  created_at  TEXT NOT NULL
);

-- Key/value for anything global (schema version, engine state).
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
