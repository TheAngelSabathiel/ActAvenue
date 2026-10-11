-- One checkout can now hold several shows. Each show stays its own
-- reservation (own QR, own check-in); order_code ties them together.
alter table reservations add column if not exists order_code text;
create index if not exists reservations_order_idx on reservations (order_code);
update reservations set order_code = reference_code where order_code is null;
