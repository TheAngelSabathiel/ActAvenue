-- A booking can spend uses from several source bookings (same buyer email, several codes).
alter table crossshow_uses drop constraint if exists crossshow_uses_target_reservation_id_key;
alter table crossshow_uses drop constraint if exists crossshow_uses_target_source_key;
alter table crossshow_uses add constraint crossshow_uses_target_source_key unique (target_reservation_id, source_reservation_id);
