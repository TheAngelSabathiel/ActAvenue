-- Production page credits: Artistic Team (per play) + Production & Crew.
-- Run once in the Supabase SQL Editor on your existing project.

-- 1) Plays inside a production (e.g. the four stories)
create table if not exists plays (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references productions (id) on delete cascade,
  title text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists plays_production_idx on plays (production_id);
alter table plays enable row level security;

drop policy if exists "public read plays" on plays;
create policy "public read plays" on plays for select using (true);
drop policy if exists "staff manage plays" on plays;
create policy "staff manage plays" on plays for all using (is_staff()) with check (is_staff());

-- 2) New credit fields
alter table production_credits
  add column if not exists section text not null default 'production' check (section in ('artistic', 'production')),
  add column if not exists credit_type text check (credit_type in ('writer', 'director', 'actor')),
  add column if not exists play_id uuid references plays (id) on delete set null,
  add column if not exists sort_order int not null default 0,
  add column if not exists is_discredited boolean not null default false;

-- 3) A person can hold several credits, including the same title in two plays.
alter table production_credits
  drop constraint if exists production_credits_profile_id_production_id_role_played_key;
create unique index if not exists production_credits_unique
  on production_credits (profile_id, production_id, section, coalesce(play_id, '00000000-0000-0000-0000-000000000000'::uuid), role_played);

-- 4) Discredited credits are hidden from the public (staff still see them).
drop policy if exists "public read production credits" on production_credits;
create policy "public read production credits"
  on production_credits for select
  using (not is_discredited or is_staff());

-- 5) Tidy up credits that already exist
update production_credits set section = 'artistic', credit_type = 'actor'
where role_played = 'Actor' and credit_type is null;

update production_credits set sort_order = case
  when role_played ilike 'Project Head%'                then 10
  when role_played = 'Production Manager'               then 20
  when role_played = 'Assistant Production Manager'     then 30
  when role_played = 'Play Director'                    then 40
  when role_played = 'Dramaturg'                        then 50
  when role_played ilike 'Stage Manager%'               then 60
  when role_played ilike 'Marketing & Partnerships%'    then 70
  when role_played = 'Marketing Associate'              then 80
  when role_played = 'Lights Operator'                  then 90
  when role_played = 'Sounds Spinner'                   then 100
  when role_played = 'Front of House'                   then 110
  when role_played = 'Usher'                            then 120
  when role_played ilike 'Production Staff%'            then 130
  else 0 end
where section = 'production' and sort_order = 0;
