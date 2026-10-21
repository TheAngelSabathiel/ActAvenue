-- Bio formatting on profiles + writers on plays.
-- Run once in the Supabase SQL Editor.

-- 1) Bio formatting (defaults match the current look)
alter table profiles add column if not exists bio_size  text not null default 'small'   check (bio_size  in ('small','medium','large'));
alter table profiles add column if not exists bio_align text not null default 'justify' check (bio_align in ('justify','left','center'));
alter table profiles add column if not exists bio_font  text not null default 'default' check (bio_font  in ('default','playfair','lora','courier','caveat'));
alter table profiles add column if not exists bio_color text not null default 'default' check (bio_color in ('default','charcoal','crimson','navy','forest','plum'));

-- 2) Writers on plays (optional, several allowed)
create table if not exists play_writers (
  play_id uuid not null references plays (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  primary key (play_id, profile_id)
);
create index if not exists play_writers_profile_idx on play_writers (profile_id);

alter table play_writers enable row level security;
drop policy if exists "public read play_writers" on play_writers;
drop policy if exists "staff manage play_writers" on play_writers;
create policy "public read play_writers" on play_writers for select using (true);
create policy "staff manage play_writers" on play_writers for all using (is_staff()) with check (is_staff());

-- New tables need explicit grants.
grant select on play_writers to anon, authenticated;
grant all on play_writers to service_role;

-- 3) Fill in writers from the writer credits you already entered by hand.
--    Your existing credits are not changed.
insert into play_writers (play_id, profile_id, sort_order)
select play_id, profile_id, (row_number() over (partition by play_id order by min(created_at))) * 10
from production_credits
where credit_type = 'writer' and play_id is not null
group by play_id, profile_id
on conflict do nothing;
