-- Cross-show discount: buyers of one show get a fixed amount off tickets to another show.
alter table productions add column if not exists crossshow_enabled boolean not null default false;
alter table productions add column if not exists crossshow_amount numeric(10, 2) not null default 100 check (crossshow_amount > 0);
alter table productions add column if not exists crossshow_source_ids uuid[] not null default '{}';

alter table reservations drop constraint if exists reservations_discount_source_check;
alter table reservations add constraint reservations_discount_source_check
  check (discount_source is null or discount_source in ('promo', 'bundle', 'crossshow'));

-- One row per use: a confirmed booking (source) earns one use per paid ticket,
-- and a new booking (target) spends them. Deleting the target gives them back.
create table if not exists crossshow_uses (
  id uuid primary key default gen_random_uuid(),
  source_reservation_id uuid not null references reservations (id) on delete cascade,
  target_reservation_id uuid not null references reservations (id) on delete cascade,
  uses integer not null check (uses > 0),
  amount_each numeric(10, 2) not null,
  created_at timestamptz not null default now(),
  unique (target_reservation_id, source_reservation_id)
);
create index if not exists crossshow_uses_source_idx on crossshow_uses (source_reservation_id);

alter table crossshow_uses enable row level security;
grant all on crossshow_uses to service_role;

-- Uses a source booking still has: its paid tickets minus uses spent by bookings that are still live.
create or replace function crossshow_available(p_source uuid) returns integer
language sql stable as $$
  select coalesce((select sum(quantity) from reservation_items where reservation_id = p_source and unit_price > 0), 0)::int
       - coalesce((select sum(u.uses) from crossshow_uses u
                   join reservations t on t.id = u.target_reservation_id
                   where u.source_reservation_id = p_source
                     and t.payment_status in ('pending_review', 'confirmed')), 0)::int;
$$;

-- Spend uses atomically. Locking the source row stops two checkouts spending the same ticket.
create or replace function claim_crossshow_uses(p_source uuid, p_target uuid, p_uses int, p_amount numeric)
returns void language plpgsql as $$
begin
  perform 1 from reservations where id = p_source for update;
  if crossshow_available(p_source) < p_uses then
    raise exception 'crossshow_unavailable';
  end if;
  insert into crossshow_uses (source_reservation_id, target_reservation_id, uses, amount_each)
  values (p_source, p_target, p_uses, p_amount);
end;
$$;

grant execute on function crossshow_available(uuid) to service_role;
grant execute on function claim_crossshow_uses(uuid, uuid, int, numeric) to service_role;
