-- Scan log (staff check-in report) + mailing list.
-- Run once in the Supabase SQL Editor.

-- 1) Every admit at the door: who, when, how many.
create table if not exists scan_log (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid references reservations (id) on delete set null,
  performance_id uuid references performances (id) on delete set null,
  production_id uuid references productions (id) on delete set null,
  ticket_code text,
  admitted integer not null check (admitted > 0),
  source text not null default 'scan' check (source in ('scan', 'manual')),
  override boolean not null default false,
  scanned_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists scan_log_performance_idx on scan_log (performance_id, created_at);
create index if not exists scan_log_staff_idx on scan_log (scanned_by);

-- 2) People who opted in to hear about new shows.
create table if not exists subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  source text not null default 'footer' check (source in ('footer', 'checkout', 'manual')),
  token uuid not null default gen_random_uuid(),
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);
create unique index if not exists subscribers_email_idx on subscribers (lower(email));
create unique index if not exists subscribers_token_idx on subscribers (token);

-- 3) Record of announcements sent.
create table if not exists mailing_campaigns (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body text not null,
  sent_count integer not null default 0,
  sent_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Server-only tables: no public policies, service role access only.
alter table scan_log enable row level security;
alter table subscribers enable row level security;
alter table mailing_campaigns enable row level security;
grant all on scan_log, subscribers, mailing_campaigns to service_role;
