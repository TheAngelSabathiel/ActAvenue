-- One ID per discounted ticket: each cart line and booking line can hold several ID uploads.
-- Existing single IDs are copied into the new list, so nothing is lost.

alter table cart_items add column if not exists id_proof_paths text[] not null default '{}';
alter table reservation_items add column if not exists id_proof_paths text[] not null default '{}';

update cart_items set id_proof_paths = array[id_proof_path]
  where id_proof_path is not null and cardinality(id_proof_paths) = 0;
update reservation_items set id_proof_paths = array[id_proof_path]
  where id_proof_path is not null and cardinality(id_proof_paths) = 0;
