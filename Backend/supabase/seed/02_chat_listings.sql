-- Development seed: the market listings the app ships with, sold by the demo accounts from
-- 01_feed_preview.sql, so a real account can message a seller. Slugs match the listing links in
-- the app. Never run this against production.

insert into public.listings (id, slug, seller_id, title, asking_php, status)
values
  ('00000000-0000-4000-9100-000000000001', 'polaroid-sun-600',
   '00000000-0000-4000-8000-000000000002', 'Vintage Polaroid Sun 600', 3200, 'active'),
  ('00000000-0000-4000-9100-000000000002', 'air-jordan-1-bred',
   '00000000-0000-4000-8000-000000000004', 'Air Jordan 1 High Bred', 8500, 'active'),
  ('00000000-0000-4000-9100-000000000003', 'retro-walkman',
   '00000000-0000-4000-8000-000000000003', 'Retro Walkman Player', 1900, 'active'),
  ('00000000-0000-4000-9100-000000000004', 'keychron-keyboard',
   '00000000-0000-4000-8000-000000000002', 'Mechanical Keychron Keyboard', 4500, 'active'),
  ('00000000-0000-4000-9100-000000000005', 'nike-teal-windbreaker',
   '00000000-0000-4000-8000-000000000001', 'Retro Nike Teal Windbreaker', 2600, 'active'),
  ('00000000-0000-4000-9100-000000000006', 'colour-block-windbreaker',
   '00000000-0000-4000-8000-000000000003', '90s Colour-Block Windbreaker', 1950, 'active'),
  ('00000000-0000-4000-9100-000000000007', 'black-puffer-jacket',
   '00000000-0000-4000-8000-000000000004', 'Black Quilted Puffer Jacket', 2900, 'active'),
  ('00000000-0000-4000-9100-000000000008', 'polaroid-film-bundle',
   '00000000-0000-4000-8000-000000000002', 'Polaroid Camera and Film Bundle', 3800, 'active')
on conflict (id) do nothing;
