-- Sales funnel counts: page visits, carts started, checkouts submitted.
-- Anonymous only: a random id per browser (visits) or per cart. No names, emails or IPs.
-- Safe to run more than once.

create table if not exists funnel_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  event text not null check (event in ('visit', 'production_view', 'cart_started', 'checkout_submitted')),
  production_id uuid references productions (id) on delete cascade,
  visitor_id text not null
);

create index if not exists funnel_events_lookup on funnel_events (production_id, event, created_at);
create index if not exists funnel_events_visits on funnel_events (event, created_at);

-- Only the server writes and reads this table.
alter table funnel_events enable row level security;

-- Unique visitors per step for one production. Home page visitors (not tied to a
-- production) come back under the 'visit' event.
create or replace function funnel_counts(p_production uuid, p_since timestamptz)
returns table (event text, visitors bigint)
language sql
stable
security definer
set search_path = public
as $$
  select e.event, count(distinct e.visitor_id)
  from funnel_events e
  where e.created_at >= p_since
    and (e.production_id = p_production or (e.production_id is null and e.event = 'visit'))
  group by e.event;
$$;

revoke all on function funnel_counts(uuid, timestamptz) from public;
grant execute on function funnel_counts(uuid, timestamptz) to service_role;
