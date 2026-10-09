-- Populate Cast & Crew.
-- BEFORE running: create each person in Supabase > Authentication > Users > Add user
-- (tick "Auto Confirm User"). Use their real email and a temporary password.
-- Then edit the two lists below and run this whole file in the SQL Editor.
-- Safe to run again. It updates existing rows and skips duplicate credits.

-- 1) Profiles: email, display name, bio
with people (email, display_name, bio) as (
  values
    ('actor1@example.com', 'Actor One',  'Short bio here.'),
    ('actor2@example.com', 'Actor Two',  'Short bio here.'),
    ('crew1@example.com',  'Crew One',   'Short bio here.')
)
update profiles p
set role         = 'actor',
    display_name = people.display_name,
    bio          = people.bio,
    is_public    = true,
    is_approved  = true
from people
join auth.users u on lower(u.email) = lower(people.email)
where p.id = u.id
  and p.role in ('actor', 'public');   -- never touches admin/organizer rows

-- 2) Production credits: email, production slug, role (use 'Director', 'Stage Manager', etc. for crew)
with credits (email, production_slug, role_played) as (
  values
    ('actor1@example.com', 'your-production-slug', 'Maria'),
    ('actor2@example.com', 'your-production-slug', 'Juan'),
    ('crew1@example.com',  'your-production-slug', 'Stage Manager')
)
insert into production_credits (profile_id, production_id, role_played)
select u.id, pr.id, credits.role_played
from credits
join auth.users u on lower(u.email) = lower(credits.email)
join productions pr on pr.slug = credits.production_slug
on conflict (profile_id, production_id, role_played) do nothing;

-- 3) Check
select p.display_name, p.is_public, p.is_approved, count(c.id) as credits
from profiles p
left join production_credits c on c.profile_id = p.id
where p.role = 'actor'
group by p.id order by p.display_name;
