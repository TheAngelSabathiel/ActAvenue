-- Lets admins and organizers have a public Cast & Crew profile.
-- Run once in the Supabase SQL Editor on your existing project.

drop policy if exists "public read approved actor profiles" on profiles;

create policy "public read approved actor profiles"
  on profiles for select
  using (role in ('actor', 'admin', 'organizer') and is_public = true and is_approved = true);

-- Staff are already trusted: no separate approval needed.
update profiles set is_approved = true where role in ('admin', 'organizer');
