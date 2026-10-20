-- Promo codes count one use per discounted ticket. Store how many a booking used.
-- Run once in the Supabase SQL Editor.
alter table reservations add column if not exists promo_uses integer;

update reservations r set promo_uses = case
  when p.discount_type = 'fixed' and p.discount_value > 0
    then greatest(1, round(r.discount_amount / p.discount_value)::int)
  else greatest(1, coalesce((select sum(quantity) from reservation_items ri where ri.reservation_id = r.id), 1))
end
from promo_codes p
where p.id = r.promo_code_id and r.discount_amount > 0 and r.promo_uses is null;
