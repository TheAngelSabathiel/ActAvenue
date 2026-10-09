-- Act Avenue: create accounts for the cast and production team.
-- Run once in Supabase > SQL Editor. Safe to run again: existing emails are skipped.
-- Everyone gets the password "actavenue" and can change it in Settings after signing in.
-- Profiles go live on Cast & Crew immediately and are tagged to the production below.

-- 1) Production to tag. Change if your production slug is different.
create temp table _cfg (slug text);
insert into _cfg values ('kwentuhog-a-bedtime-story');

-- 2) Members: name, email, role
create temp table _members (ord serial, name text, email text, role_played text);
insert into _members (name, email, role_played) values
  ('Rhon Rodriguez',         'rhon.rodriguez@gmail.com',            'Project Head / Technical Head'),
  ('Alex Baylon',            'alexander.baylon25@gmail.com',        'Production Manager'),
  ('Daryl Canas',            'darylcanas@gmail.com',                'Assistant Production Manager'),
  ('Xander Go',              '1xandergo@gmail.com',                 'Play Director'),
  ('Edjie Maglano',          'je.apines@gmail.com',                 'Dramaturg'),
  ('Ian Reyes',              'adrianvalmoresreyes@gmail.com',       'Dramaturg'),
  ('Lyn Ercilla',            'yokaiyokai3173@gmail.com',            'Stage Manager - Production'),
  ('Don Joseph Budoso',      'donjosephbudoso@gmail.com',           'Stage Manager - Production'),
  ('Marion Brosoto',         'noiram.noreb@gmail.com',              'Stage Manager - Production'),
  ('Bemu Maglangit',         '02bem25@gmail.com',                   'Marketing & Partnerships Coordinator'),
  ('Sheena Anne Villanueva', 'sheenaannev@gmail.com',               'Marketing & Partnerships Coordinator'),
  ('Christian Villanueva',   'hanschristian416@gmail.com',          'Marketing Associate'),
  ('Luis Orbeso',            'joseluisorbeso@gmail.com',            'Lights Operator'),
  ('Meljohn Guimbaolibot',   'meljohnblue30@gmail.com',             'Sounds Spinner'),
  ('Mardi Gonzales',         'mardi.gonzalez7@gmail.com',           'Front of House'),
  ('Lorraine Teng',          'ltengcm@gmail.com',                   'Front of House'),
  ('Koi Alcantara',          'koikoitheperson@gmail.com',           'Usher'),
  ('Andrew Estacio',         'drew.312estacio@gmail.com',           'Usher'),
  ('Mark Pelicano',          'mrk.plcn@gmail.com',                  'Production Staff/Stage Hands'),
  ('Mark Pelicano',          'mrk.plcn@gmail.com',                  'Front of House'),
  ('Joshua Flores',          'wafloores06@gmail.com',               'Production Staff/Stage Hands'),
  ('Simon Peter Borja',      'borja.simonpeter@gmail.com',          'Actor'),
  ('Athena Angeles',         'chloe.andrei05@gmail.com',            'Actor'),
  ('Hyang Mi Nitro',         'slp.mxhyangminitro@gmail.com',        'Actor'),
  ('Say Escandor',           'essayescandor@gmail.com',             'Actor'),
  ('Janelle Villamor',       'janellesophiavillamor@gmail.com',     'Actor'),
  ('Kath Vallido',           'worksbykava@gmail.com',               'Actor'),
  ('Lucky Historia',         'luckychistoria@gmail.com',            'Actor'),
  ('Cloie Revilla',          'cloie.revilla@student.gmc.edu.ph',    'Actor'),
  ('Michelle Martinez',      'michellemrtnz916@gmail.com',          'Actor'),
  ('Angel-Ehdz Gutierrez',   'ehdzgutierrez@gmail.com',             'Actor'),
  ('Xyzie Ridon',            'xyzieridon@gmail.com',                'Actor'),
  ('Tiffany Ducusin',        'tiffanycpd14@gmail.com',              'Actor'),
  ('Rahf Vicente',           'rahfvicente@gmail.com',               'Actor'),
  ('Vernon Acla',            'vernonacla@yahoo.com',                'Actor'),
  ('Shane Dela Cruz',        'heyshernielyn@gmail.com',             'Actor');

-- 3) Create the accounts, profiles and credits
do $$
declare
  r record;
  v_id uuid;
  v_prod uuid;
  v_created int := 0;
begin
  select p.id into v_prod from productions p join _cfg c on c.slug = p.slug;
  if v_prod is null then
    raise exception 'Production not found. Fix the slug in step 1.';
  end if;

  for r in select distinct on (lower(email)) name, lower(trim(email)) as email from _members order by lower(email) loop
    select id into v_id from auth.users where lower(email) = r.email;

    if v_id is null then
      v_id := gen_random_uuid();

      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) values (
        '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', r.email,
        crypt('actavenue', gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('display_name', r.name, 'account_type', 'actor'),
        now(), now(),
        '', '', '', ''
      );

      insert into auth.identities (
        id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(), v_id::text, v_id,
        jsonb_build_object('sub', v_id::text, 'email', r.email, 'email_verified', true),
        'email', now(), now(), now()
      );

      v_created := v_created + 1;
    end if;

    -- Public, approved profile. Never downgrades an admin or organizer.
    update profiles
    set display_name = r.name,
        role         = case when role in ('admin', 'organizer') then role else 'actor' end,
        is_public    = true,
        is_approved  = true
    where id = v_id;

    insert into production_credits (profile_id, production_id, role_played, section, sort_order)
    select v_id, v_prod, m.role_played, 'production', m.ord * 10
    from _members m
    where lower(trim(m.email)) = r.email
    on conflict do nothing;
  end loop;

  raise notice 'Created % new accounts.', v_created;
end $$;

-- 4) Check
select p.display_name, u.email, p.role, p.is_public, p.is_approved,
       string_agg(c.role_played, ', ' order by c.role_played) as credits
from profiles p
join auth.users u on u.id = p.id
left join production_credits c on c.profile_id = p.id
where p.role in ('actor', 'admin', 'organizer')
group by p.id, p.display_name, u.email, p.role, p.is_public, p.is_approved
order by p.display_name;
