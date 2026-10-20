-- Ticket tier types, ID upload, promo tier restrictions, partners.
-- Run once in the Supabase SQL Editor.

-- 1. Ticket tier types
alter table ticket_tiers add column if not exists tier_type text not null default 'regular';
alter table ticket_tiers add column if not exists alias text;
alter table ticket_tiers add column if not exists description text;
alter table ticket_tiers add column if not exists require_id boolean not null default false;

do $$ begin
  alter table ticket_tiers add constraint ticket_tiers_type_check
    check (tier_type in ('regular', 'vip', 'discounted', 'special'));
exception when duplicate_object then null; end $$;

-- Map existing tiers by their old label
update ticket_tiers set tier_type = 'vip' where label ilike '%vip%';
update ticket_tiers set tier_type = 'discounted'
  where label ilike '%discount%' or label ilike '%student%' or label ilike '%pwd%' or label ilike '%senior%';
update ticket_tiers set tier_type = 'special'
  where label not ilike '%vip%' and label not ilike '%regular%' and label not ilike '%discount%'
    and label not ilike '%student%' and label not ilike '%pwd%' and label not ilike '%senior%'
    and label not ilike '%general%' and label not ilike '%standard%';

-- Keep old labels as pseudonyms where they differ from the type name
update ticket_tiers set alias = label
  where lower(label) <> tier_type;

-- 2. ID upload at add to cart
alter table cart_items add column if not exists id_proof_path text;
alter table reservation_items add column if not exists id_proof_path text;

insert into storage.buckets (id, name, public)
  values ('id-proofs', 'id-proofs', false)
  on conflict (id) do nothing;

-- 3. Promo codes limited to tier types (null = all)
alter table promo_codes add column if not exists applicable_tier_types text[];

-- 4. Partners
create table if not exists production_partners (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references productions (id) on delete cascade,
  category text not null check (category in ('sponsor', 'media', 'organization')),
  sponsor_level text check (sponsor_level in ('co_presenter', 'major', 'minor', 'special_thanks')),
  name text not null,
  url text,
  logo_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists production_partners_production_idx on production_partners (production_id);

alter table production_partners enable row level security;
drop policy if exists "Public can read partners of published productions" on production_partners;
create policy "Public can read partners of published productions"
  on production_partners for select
  using (exists (select 1 from productions p where p.id = production_partners.production_id and p.status in ('published', 'closed')));
