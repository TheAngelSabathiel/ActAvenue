-- Lets the admin choose which productions come first in the landing page carousel.
-- Run once in the Supabase SQL Editor.
alter table productions add column if not exists carousel_order int not null default 0;
