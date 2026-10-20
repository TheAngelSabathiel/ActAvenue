-- One QR per ticket type per show. Each QR scans as many times as the quantity ordered.
-- Run once in the Supabase SQL Editor.

alter table reservation_items add column if not exists ticket_code text;
alter table reservation_items add column if not exists qr_code_url text;
alter table reservation_items add column if not exists scans_used integer not null default 0;

create unique index if not exists reservation_items_ticket_code_idx
  on reservation_items (ticket_code) where ticket_code is not null;

-- Existing bookings: give each ticket line a code. Old QRs (reference code) keep working at the door.
with numbered as (
  select ri.id, r.reference_code,
         row_number() over (partition by ri.reservation_id order by ri.id) as n
  from reservation_items ri join reservations r on r.id = ri.reservation_id
)
update reservation_items ri set ticket_code = numbered.reference_code || '-' || numbered.n
from numbered where numbered.id = ri.id and ri.ticket_code is null;

-- Anyone already checked in counts as fully scanned.
update reservation_items ri set scans_used = ri.quantity
from reservations r where r.id = ri.reservation_id and r.checked_in = true;
