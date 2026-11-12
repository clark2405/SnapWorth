-- Development seed: the four demo accounts, the two feed posts the app ships with, and their
-- discussions. Seed accounts have no password and cannot sign in; they exist so the feed has
-- authors. Never run this against production.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000001',
   'authenticated', 'authenticated', 'retro_curator@seed.snapworth.test', '', now(),
   '{"provider":"email","providers":["email"]}', '{"handle":"retro_curator"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000002',
   'authenticated', 'authenticated', 'mariacruz@seed.snapworth.test', '', now(),
   '{"provider":"email","providers":["email"]}', '{"handle":"mariacruz"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000003',
   'authenticated', 'authenticated', 'sugbo_hype@seed.snapworth.test', '', now(),
   '{"provider":"email","providers":["email"]}', '{"handle":"sugbo_hype"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000004',
   'authenticated', 'authenticated', 'justin_v@seed.snapworth.test', '', now(),
   '{"provider":"email","providers":["email"]}', '{"handle":"justin_v"}', now(), now())
on conflict (id) do nothing;

update public.profiles
   set display_name = 'Rico Santos',
       bio = 'Thrifting 90s sportswear and film cameras around Cebu. Everything I sell is tested.',
       location = 'Lahug, Cebu City'
 where id = '00000000-0000-4000-8000-000000000001';

update public.profiles
   set display_name = 'Maria Cruz',
       bio = 'Film cameras and 90s electronics. Everything is tested before it is listed.',
       location = 'Cebu City'
 where id = '00000000-0000-4000-8000-000000000002';

update public.profiles
   set display_name = 'Sugbo Hype',
       bio = 'Vintage streetwear, cassette audio and rare finds around Mandaue.',
       location = 'Mandaue'
 where id = '00000000-0000-4000-8000-000000000003';

update public.profiles
   set display_name = 'Justin V.',
       bio = 'Sneaker collector and outerwear enthusiast. Original boxes included.',
       location = 'Lapu-Lapu'
 where id = '00000000-0000-4000-8000-000000000004';

insert into public.feed_posts (
  id,
  slug,
  owner_id,
  title,
  category,
  body,
  estimate_php,
  too_high_count,
  just_right_count,
  too_low_count,
  moderation_status,
  created_at
)
values
  (
    '00000000-0000-4000-9000-000000000001',
    'retro-windbreaker',
    '00000000-0000-4000-8000-000000000001',
    'Retro 90s Nike Teal Windbreaker',
    'fashion',
    'Just picked up this retro 90s Nike teal windbreaker. AI valued it at ₱2,450. Is this fair? Community let me know!',
    2450,
    12,
    38,
    4,
    'approved',
    now() - interval '2 minutes'
  ),
  (
    '00000000-0000-4000-9000-000000000002',
    'polaroid-sun-600',
    '00000000-0000-4000-8000-000000000002',
    'Vintage Polaroid Sun 600',
    'collectibles',
    'Is a vintage polaroid camera worth ₱3,500? Help me out please!',
    3500,
    35,
    12,
    2,
    'approved',
    now() - interval '1 hour'
  ),
  (
    '00000000-0000-4000-9000-000000000003',
    'retro-walkman-post',
    '00000000-0000-4000-8000-000000000004',
    'Silver Cassette Walkman Player',
    'electronics',
    'Found my dad’s old Walkman. AI says ₱1,900. Would you pay that?',
    1900,
    6,
    41,
    9,
    'approved',
    now() - interval '3 days'
  ),
  (
    '00000000-0000-4000-9000-000000000004',
    'keychron-post',
    '00000000-0000-4000-8000-000000000003',
    'Mechanical Keychron Keyboard',
    'electronics',
    'Listing my Keychron at ₱4,500. Too much for a used board?',
    3900,
    28,
    14,
    3,
    'approved',
    now() - interval '5 days'
  )
on conflict (id) do update
  set title = excluded.title,
      category = excluded.category,
      too_high_count = excluded.too_high_count,
      just_right_count = excluded.just_right_count,
      too_low_count = excluded.too_low_count;

insert into public.comments (id, post_id, parent_id, author_id, body, moderation_status, created_at)
values
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-9000-000000000001', null,
   '00000000-0000-4000-8000-000000000004',
   'Check the inner tag. If it says "Made in Korea" it could be worth more.',
   'approved', now() - interval '2 minutes'),
  ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-9000-000000000001', null,
   '00000000-0000-4000-8000-000000000003',
   'Teal colourways go fast. ₱2,450 is fair, maybe even a little low.',
   'approved', now() - interval '1 minute'),
  ('00000000-0000-4000-a000-000000000003', '00000000-0000-4000-9000-000000000002', null,
   '00000000-0000-4000-8000-000000000004',
   'Sun 600s usually go for ₱2,500 to ₱3,000 here. ₱3,500 feels high unless it comes with film.',
   'approved', now() - interval '48 minutes'),
  ('00000000-0000-4000-a000-000000000004', '00000000-0000-4000-9000-000000000002', null,
   '00000000-0000-4000-8000-000000000003',
   'Test the flash first. A working one is worth the extra.',
   'approved', now() - interval '30 minutes'),
  ('00000000-0000-4000-a000-000000000005', '00000000-0000-4000-9000-000000000002', null,
   '00000000-0000-4000-8000-000000000001',
   'Agree with the others. I would list it around ₱2,900.',
   'approved', now() - interval '12 minutes'),
  ('00000000-0000-4000-a000-000000000006', '00000000-0000-4000-9000-000000000002',
   '00000000-0000-4000-a000-000000000003', '00000000-0000-4000-8000-000000000002',
   'Good to know, thanks. It does come with one sealed pack of film.',
   'approved', now() - interval '40 minutes')
on conflict (id) do nothing;
