-- One-line logline per play, edited by admin, shown on the play page and used when sharing.
alter table plays add column if not exists logline text;
