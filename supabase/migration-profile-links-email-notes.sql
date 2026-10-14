-- Optional contact and social links on cast and crew profiles,
-- and an extra note per production for confirmation and transfer emails.
-- Run once in the Supabase SQL Editor.
alter table profiles add column if not exists contact_email text;
alter table profiles add column if not exists facebook_url text;
alter table profiles add column if not exists instagram_url text;
alter table profiles add column if not exists x_url text;
alter table profiles add column if not exists tiktok_url text;

alter table productions add column if not exists email_note text;
