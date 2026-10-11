-- Adds Choreographer and Dancer to the artistic team.
-- Run after migration-credits-plays.sql.
alter table production_credits drop constraint if exists production_credits_credit_type_check;
alter table production_credits
  add constraint production_credits_credit_type_check
  check (credit_type in ('writer', 'director', 'actor', 'choreographer', 'dancer'));
