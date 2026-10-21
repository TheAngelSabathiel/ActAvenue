-- Scanner role: door staff who can only scan tickets for one production.
-- Run once in the Supabase SQL Editor.
alter table production_staff drop constraint if exists production_staff_staff_role_check;
alter table production_staff add constraint production_staff_staff_role_check
  check (staff_role in ('manager', 'foh', 'scanner'));
