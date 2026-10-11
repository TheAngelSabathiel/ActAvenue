-- Per-production access for Managers and FOH (front of house).
-- Run once in the Supabase SQL Editor.

create table if not exists production_staff (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  production_id uuid not null references productions(id) on delete cascade,
  staff_role text not null check (staff_role in ('manager', 'foh')),
  created_at timestamptz not null default now(),
  unique (profile_id, production_id)
);

create index if not exists production_staff_profile_idx on production_staff (profile_id);
create index if not exists production_staff_production_idx on production_staff (production_id);

-- Read and written only by server routes using the service role.
alter table production_staff enable row level security;
