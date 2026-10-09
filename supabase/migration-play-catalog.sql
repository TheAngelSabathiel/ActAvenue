-- Plays become a shared catalog; productions pick from it.
-- Run AFTER migration-credits-plays.sql. Safe to run once.

alter table plays add column if not exists description text;
alter table plays add column if not exists photo_url text;

create table if not exists production_plays (
  production_id uuid not null references productions (id) on delete cascade,
  play_id uuid not null references plays (id) on delete cascade,
  sort_order int not null default 0,
  primary key (production_id, play_id)
);
create index if not exists production_plays_play_idx on production_plays (play_id);

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_name = 'plays' and column_name = 'production_id') then
    -- carry the old per-production plays over as assignments
    insert into production_plays (production_id, play_id, sort_order)
    select production_id, id, sort_order from plays where production_id is not null
    on conflict do nothing;

    -- merge plays that share a title (case-insensitive) into one catalog entry
    create temp table _dup on commit drop as
      select id, first_value(id) over (
               partition by lower(trim(title)) order by created_at, id) as keep_id
      from plays;

    update production_credits c set play_id = d.keep_id
    from _dup d where c.play_id = d.id and d.id <> d.keep_id;

    insert into production_plays (production_id, play_id, sort_order)
    select pp.production_id, d.keep_id, pp.sort_order
    from production_plays pp join _dup d on d.id = pp.play_id
    where d.id <> d.keep_id
    on conflict do nothing;

    delete from plays where id in (select id from _dup where id <> keep_id);

    alter table plays drop column production_id;
  end if;
end $$;

create unique index if not exists plays_title_unique on plays (lower(trim(title)));

alter table production_plays enable row level security;
drop policy if exists "public read production_plays" on production_plays;
drop policy if exists "staff manage production_plays" on production_plays;
create policy "public read production_plays" on production_plays for select using (true);
create policy "staff manage production_plays" on production_plays for all using (is_staff()) with check (is_staff());
