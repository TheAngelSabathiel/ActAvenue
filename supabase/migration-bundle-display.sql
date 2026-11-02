-- Group (bundle) discounts per production, and an optional displayed capacity per show.
alter table productions add column if not exists bundle_enabled boolean not null default false;
alter table productions add column if not exists bundle_tiers jsonb not null
  default '[{"min":3,"percent":5},{"min":5,"percent":8},{"min":10,"percent":12}]'::jsonb;

-- Seats shown to the public as the show's size (percent booked uses it). Empty means the real total.
alter table performances add column if not exists display_capacity integer check (display_capacity is null or display_capacity > 0);

-- Which kind of discount a booking got: 'promo' or 'bundle'.
alter table reservations add column if not exists discount_source text check (discount_source in ('promo', 'bundle'));
