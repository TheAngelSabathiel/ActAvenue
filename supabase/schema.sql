-- Theater Ticketing MVP schema
-- Run this in the Supabase SQL editor, or via `supabase db push` if using the CLI.

create extension if not exists "pgcrypto";

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- PROFILES (seam for future actor/buyer accounts, Phase 2)
-- ============================================================
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'public' check (role in ('admin', 'organizer', 'actor', 'public')),
  display_name text,
  avatar_url text,
  -- Actor/production-member profile fields — populated when role = 'actor'.
  bio text,
  photo_url text,
  resume_url text,
  reel_url text,
  -- is_public: the actor's own intent to be listed publicly.
  -- is_approved: admin sign-off, required in addition to is_public before
  -- the profile actually appears anywhere public — see the moderation
  -- section near the end of this file. An actor can flip is_public on
  -- immediately; it just doesn't go live until approved.
  is_public boolean not null default false,
  is_approved boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- PRODUCTIONS
-- ============================================================
create table productions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  title text not null,
  slug text not null unique,
  description text,
  poster_url text,
  banner_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index productions_org_idx on productions (organization_id);
create index productions_slug_idx on productions (slug);

-- ============================================================
-- PERFORMANCES (one production, multiple show dates/times)
-- ============================================================
create table performances (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references productions (id) on delete cascade,
  label text not null,
  datetime timestamptz not null,
  venue text not null,
  capacity integer not null check (capacity >= 0),
  created_at timestamptz not null default now()
);

create index performances_production_idx on performances (production_id);

-- ============================================================
-- TICKET TIERS (VIP / Regular / Discounted, scoped per performance)
-- ============================================================
create table ticket_tiers (
  id uuid primary key default gen_random_uuid(),
  performance_id uuid not null references performances (id) on delete cascade,
  label text not null,
  price numeric(10, 2) not null check (price >= 0),
  quantity_available integer not null check (quantity_available >= 0),
  quantity_held integer not null default 0 check (quantity_held >= 0),
  is_discount_tier boolean not null default false,
  discount_valid_from timestamptz,
  discount_valid_until timestamptz,
  created_at timestamptz not null default now()
);

create index ticket_tiers_performance_idx on ticket_tiers (performance_id);

-- ============================================================
-- PROMO CODES
-- ============================================================
create table promo_codes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  code text not null,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric(10, 2) not null check (discount_value >= 0),
  applies_to_production_id uuid references productions (id) on delete cascade,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  max_uses integer,
  times_used integer not null default 0,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

-- ============================================================
-- CARTS + CART ITEMS (session-based, survives closed tabs)
-- ============================================================
create table carts (
  id uuid primary key default gen_random_uuid(),
  session_token text not null unique,
  email text,
  status text not null default 'active' check (status in ('active', 'converted', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

create table cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references carts (id) on delete cascade,
  performance_id uuid not null references performances (id) on delete cascade,
  ticket_tier_id uuid not null references ticket_tiers (id) on delete cascade,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create index cart_items_cart_idx on cart_items (cart_id);

-- ============================================================
-- RESERVATIONS + RESERVATION ITEMS
-- No hard deletes: every booking (public or admin) stays forever,
-- statuses model the lifecycle instead.
-- ============================================================
create table reservations (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references productions (id) on delete restrict,
  performance_id uuid not null references performances (id) on delete restrict,
  reference_code text not null unique,

  -- nullable fk for future buyer-account linking (Phase 2) -- see MVP doc
  -- on delete set null: deleting an account must never delete or block on
  -- historical reservations (no-hard-deletes philosophy applies here too)
  -- — it just unlinks them, same as if they'd been a guest all along.
  profile_id uuid references profiles (id) on delete set null,

  buyer_name text not null,
  buyer_email text, -- required for public checkout at the app layer, optional for admin_manual walk-ins
  buyer_phone text,

  promo_code_id uuid references promo_codes (id),
  subtotal numeric(10, 2) not null default 0,
  discount_amount numeric(10, 2) not null default 0,
  total numeric(10, 2) not null default 0,

  payment_status text not null default 'pending_review'
    check (payment_status in ('pending_review', 'confirmed', 'rejected', 'expired')),
  booking_source text not null default 'public' check (booking_source in ('public', 'admin_manual')),

  payment_proof_url text,
  qr_code_url text,

  booking_email_sent_at timestamptz,
  approval_email_sent_at timestamptz,
  rejection_email_sent_at timestamptz,
  reminder_email_sent_at timestamptz,

  rejection_reason text,
  reopened_at timestamptz,

  hold_expires_at timestamptz,
  checked_in boolean not null default false,
  checked_in_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reservations_production_idx on reservations (production_id);
create index reservations_performance_idx on reservations (performance_id);
create index reservations_status_idx on reservations (payment_status);
create index reservations_buyer_email_idx on reservations (buyer_email);
create index reservations_profile_idx on reservations (profile_id);
create index reservations_reference_idx on reservations (reference_code);

create table reservation_items (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations (id) on delete cascade,
  ticket_tier_id uuid not null references ticket_tiers (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10, 2) not null
);

create index reservation_items_reservation_idx on reservation_items (reservation_id);

-- ============================================================
-- ACTOR PHOTOS (setcard gallery)
-- profiles.photo_url stays as the single "headshot" shown in list views;
-- this table holds the rest of a setcard's gallery.
-- ============================================================
create table actor_photos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  photo_url text not null,
  caption text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index actor_photos_profile_idx on actor_photos (profile_id);

-- ============================================================
-- PRODUCTION CREDITS
-- Many-to-many: an actor's profile tagged to a production with a role,
-- e.g. "played Maria in Kwentuhog". Tagged by admin from the production
-- editor, shown on both the production's public page and the actor's
-- public profile.
-- ============================================================
create table plays (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references productions (id) on delete cascade,
  title text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index plays_production_idx on plays (production_id);

-- section: 'artistic' (writers, directors, actors, grouped by play) or
-- 'production' (production and crew, ordered by sort_order).
-- is_discredited hides a credit publicly without deleting it.
create table production_credits (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  production_id uuid not null references productions (id) on delete cascade,
  role_played text not null,
  section text not null default 'production' check (section in ('artistic', 'production')),
  credit_type text check (credit_type in ('writer', 'director', 'actor')),
  play_id uuid references plays (id) on delete set null,
  sort_order int not null default 0,
  is_discredited boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index production_credits_unique
  on production_credits (profile_id, production_id, section, coalesce(play_id, '00000000-0000-0000-0000-000000000000'::uuid), role_played);

create index production_credits_profile_idx on production_credits (profile_id);
create index production_credits_production_idx on production_credits (production_id);

-- ============================================================
-- updated_at trigger helper
-- ============================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger productions_set_updated_at
  before update on productions
  for each row execute function set_updated_at();

create trigger reservations_set_updated_at
  before update on reservations
  for each row execute function set_updated_at();

-- ============================================================
-- REFERENCE CODE GENERATOR (short, human-readable at the door)
-- ============================================================
create or replace function generate_reference_code()
returns text as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no O/0/I/1 ambiguity
  result text := '';
  i integer;
begin
  for i in 1..7 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return result;
end;
$$ language plpgsql;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table productions enable row level security;
alter table performances enable row level security;
alter table ticket_tiers enable row level security;
alter table promo_codes enable row level security;
alter table carts enable row level security;
alter table cart_items enable row level security;
alter table reservations enable row level security;
alter table reservation_items enable row level security;
alter table actor_photos enable row level security;
alter table production_credits enable row level security;
alter table plays enable row level security;

-- Helper: is the current user staff (admin/organizer)?
create or replace function is_staff()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('admin', 'organizer')
  );
$$ language sql stable security definer;

-- Public can read published productions / their performances / tiers.
create policy "public read published productions"
  on productions for select
  using (status = 'published' or is_staff());

create policy "staff write productions"
  on productions for all
  using (is_staff()) with check (is_staff());

create policy "public read performances of published productions"
  on performances for select
  using (
    is_staff() or exists (
      select 1 from productions
      where productions.id = performances.production_id
      and productions.status = 'published'
    )
  );

create policy "staff write performances"
  on performances for all
  using (is_staff()) with check (is_staff());

create policy "public read ticket tiers"
  on ticket_tiers for select
  using (
    is_staff() or exists (
      select 1 from performances
      join productions on productions.id = performances.production_id
      where performances.id = ticket_tiers.performance_id
      and productions.status = 'published'
    )
  );

create policy "staff write ticket tiers"
  on ticket_tiers for all
  using (is_staff()) with check (is_staff());

-- Promo codes: validated server-side only (service role), never exposed to anon directly.
create policy "staff manage promo codes"
  on promo_codes for all
  using (is_staff()) with check (is_staff());

-- Carts/cart items/reservations are written via server routes using the service role,
-- so anon RLS here just blocks direct client access to other people's data.
create policy "staff read all reservations"
  on reservations for select
  using (is_staff() or profile_id = auth.uid());

create policy "staff write reservations"
  on reservations for all
  using (is_staff()) with check (is_staff());

create policy "staff read reservation items"
  on reservation_items for select
  using (
    is_staff() or exists (
      select 1 from reservations
      where reservations.id = reservation_items.reservation_id
      and reservations.profile_id = auth.uid()
    )
  );

create policy "staff write reservation items"
  on reservation_items for all
  using (is_staff()) with check (is_staff());

create policy "staff manage organizations"
  on organizations for all
  using (is_staff()) with check (is_staff());

create policy "users read own profile"
  on profiles for select
  using (id = auth.uid() or is_staff());

create policy "public read approved actor profiles"
  on profiles for select
  using (role in ('actor', 'admin', 'organizer') and is_public = true and is_approved = true);

create policy "public read approved actor photos"
  on actor_photos for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = actor_photos.profile_id
      and profiles.is_public = true and profiles.is_approved = true
    )
  );

create policy "actors read own photos"
  on actor_photos for select
  using (profile_id = auth.uid() or is_staff());

-- Writes to actor_photos go through server routes using the service-role
-- key (verifying the caller owns the profile first) — same pattern as
-- carts/reservations. No anon/authenticated write policy needed here.

create policy "public read production credits"
  on production_credits for select
  using (not is_discredited or is_staff());

create policy "public read plays" on plays for select using (true);
create policy "staff manage plays" on plays for all using (is_staff()) with check (is_staff());

-- Writes go through admin-only server routes (service role), same pattern
-- as everything else tagged "staff write" in this file.

create policy "users update own profile"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- CRITICAL: RLS is row-level, not column-level — the policy above lets a
-- buyer UPDATE their own profiles row, but without this, they could still
-- set `role` to 'admin' on that same row via a direct API call (the anon
-- key ships in every frontend bundle, so this isn't just a UI restriction).
-- This revokes UPDATE on the role column specifically, at the grant level,
-- independent of RLS. Role changes only ever happen through server-side
-- routes using the service-role key, which enforce the allowed transitions
-- in application code (see /api/account/become-actor and SETUP.md for
-- promoting admins).
--
-- is_approved gets the same treatment: without it, an actor could self-
-- approve their own directory listing via a direct API call, which would
-- defeat the entire point of admin moderation — see the moderation section
-- near the end of this file.
revoke update (role, is_approved) on profiles from authenticated, anon;

-- carts / cart_items: no RLS-based public policy — all cart mutation goes through
-- server route handlers using the service role key, keyed by the session_token cookie.

-- ============================================================
-- REALTIME
-- The production landing page subscribes to ticket_tiers changes so
-- remaining-quantity counts update live as other buyers check out or
-- holds expire, without a page refresh.
-- ============================================================
alter publication supabase_realtime add table ticket_tiers;

-- ============================================================
-- BUYER ACCOUNTS
-- Any Supabase Auth signup (buyer self-signup, or an admin invited via the
-- dashboard) automatically gets a `profiles` row with role='public'. Admins
-- are then promoted with a manual `update profiles set role = 'admin' ...`
-- afterwards — see SETUP.md. `on conflict do nothing` makes this safe to
-- run even if a profile row was already created some other way.
-- ============================================================
create or replace function handle_new_user()
returns trigger as $$
declare
  v_role text;
begin
  -- 'actor' is the only role self-servable via signup metadata (checked
  -- explicitly here, not passed through) — admin/organizer must always be
  -- granted manually via SQL, never through anything a signup request
  -- controls. See SETUP.md.
  v_role := case
    when new.raw_user_meta_data->>'account_type' = 'actor' then 'actor'
    else 'public'
  end;

  insert into profiles (id, role, display_name)
  values (new.id, v_role, new.raw_user_meta_data->>'display_name')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- ATOMIC INVENTORY OPERATIONS
-- supabase-js's .update() can only set literal values, not SQL expressions
-- like `quantity_held = quantity_held + 1` — doing that arithmetic in
-- application code (read, then write) is a check-then-act race: two
-- concurrent requests can both read the same stale quantity_held and both
-- "succeed" in reserving the same last seat. These functions do the
-- read-check-write as a single atomic statement using `for update` row
-- locking, so concurrent calls for the same tier serialize correctly.
-- ============================================================

-- Atomically checks availability and increments quantity_held in one step.
-- Raises 'insufficient_availability' if there isn't enough left — callers
-- should catch that and treat it as a normal booking-conflict response,
-- not a server error.
create or replace function hold_ticket_tier(p_tier_id uuid, p_quantity int)
returns ticket_tiers
language plpgsql
security definer
as $$
declare
  v_tier ticket_tiers;
begin
  select * into v_tier from ticket_tiers where id = p_tier_id for update;
  if not found then
    raise exception 'ticket_tier_not_found';
  end if;
  if (v_tier.quantity_available - v_tier.quantity_held) < p_quantity then
    raise exception 'insufficient_availability';
  end if;
  update ticket_tiers
  set quantity_held = quantity_held + p_quantity
  where id = p_tier_id
  returning * into v_tier;
  return v_tier;
end;
$$;

-- Atomically releases a hold (floors at 0 so it's safe to call even if the
-- bookkeeping is slightly off from a prior bug or manual DB edit).
create or replace function release_ticket_tier_hold(p_tier_id uuid, p_quantity int)
returns ticket_tiers
language plpgsql
security definer
as $$
declare
  v_tier ticket_tiers;
begin
  update ticket_tiers
  set quantity_held = greatest(0, quantity_held - p_quantity)
  where id = p_tier_id
  returning * into v_tier;
  return v_tier;
end;
$$;

-- Atomically increments a promo code's usage count and enforces max_uses
-- at commit time (defense in depth beyond the application-level check done
-- earlier during pricing calculation, which has the same read-then-act
-- race as inventory holds if two people redeem the last use simultaneously).
create or replace function increment_promo_usage(p_promo_id uuid)
returns promo_codes
language plpgsql
security definer
as $$
declare
  v_promo promo_codes;
begin
  select * into v_promo from promo_codes where id = p_promo_id for update;
  if not found then
    raise exception 'promo_not_found';
  end if;
  if v_promo.max_uses is not null and v_promo.times_used >= v_promo.max_uses then
    raise exception 'promo_max_uses_reached';
  end if;
  update promo_codes
  set times_used = times_used + 1
  where id = p_promo_id
  returning * into v_promo;
  return v_promo;
end;
$$;

grant execute on function hold_ticket_tier(uuid, int) to service_role;
grant execute on function release_ticket_tier_hold(uuid, int) to service_role;
grant execute on function increment_promo_usage(uuid) to service_role;
