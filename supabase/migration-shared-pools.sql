-- Shared seat pools: a tier can draw its seats from another tier on the same show.
-- Example: Regular 50 is the pool. Discounted draws from Regular, with an optional own cap.
-- Existing tiers are untouched (pool_tier_id stays empty), so nothing changes until you link one.

alter table ticket_tiers add column if not exists pool_tier_id uuid references ticket_tiers (id) on delete set null;
alter table ticket_tiers add column if not exists pool_capped boolean not null default false;
create index if not exists ticket_tiers_pool_idx on ticket_tiers (pool_tier_id);

do $$ begin
  alter table ticket_tiers add constraint ticket_tiers_pool_not_self check (pool_tier_id is null or pool_tier_id <> id);
exception when duplicate_object then null; end $$;

-- Holds now check the shared pool (and the tier's own cap, if it has one).
-- The pool's main tier is locked first, then the tier, so every hold in a pool
-- queues up in the same order and two buyers can never take the last seat together.
create or replace function hold_ticket_tier(p_tier_id uuid, p_quantity int)
returns ticket_tiers
language plpgsql
security definer
as $$
declare
  v_tier ticket_tiers;
  v_root ticket_tiers;
  v_root_id uuid;
  v_used int;
begin
  select coalesce(pool_tier_id, id) into v_root_id from ticket_tiers where id = p_tier_id;
  if not found then
    raise exception 'ticket_tier_not_found';
  end if;

  select * into v_root from ticket_tiers where id = v_root_id for update;
  if not found then
    raise exception 'ticket_tier_not_found';
  end if;
  select * into v_tier from ticket_tiers where id = p_tier_id for update;

  -- Linked to a different pool while we waited for the lock: ask the buyer to retry.
  if coalesce(v_tier.pool_tier_id, v_tier.id) <> v_root_id then
    raise exception 'insufficient_availability';
  end if;

  -- Own cap (only for a tier that draws from a pool and has a cap set).
  if v_tier.pool_tier_id is not null and v_tier.pool_capped
     and (v_tier.quantity_available - v_tier.quantity_held) < p_quantity then
    raise exception 'insufficient_availability';
  end if;

  -- Shared pool: the main tier's total minus everything held or sold across the pool.
  select coalesce(sum(quantity_held), 0) into v_used
  from ticket_tiers
  where id = v_root_id or pool_tier_id = v_root_id;
  if (v_root.quantity_available - v_used) < p_quantity then
    raise exception 'insufficient_availability';
  end if;

  update ticket_tiers
  set quantity_held = quantity_held + p_quantity
  where id = p_tier_id
  returning * into v_tier;
  return v_tier;
end;
$$;
