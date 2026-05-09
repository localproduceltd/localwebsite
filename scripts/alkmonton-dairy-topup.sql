-- Alkmonton Dairy - Additional Products Upload
-- Run this in Supabase SQL Editor

INSERT INTO products (supplier_id, name, description, price, unit, image, category, in_stock, locality, lat, lng, variable_location, status, allergens, tags)
SELECT id, name, description, price, unit, '', category, true, locality, lat, lng, variable_location, 'approved', allergens, tags
FROM (SELECT id FROM suppliers WHERE name = 'Alkmonton Dairy') AS s,
(VALUES
  ('Double Cream (500ml)', 'Rich double cream from Alkmonton''s own pedigree Ayrshire herd. Perfect for puddings, sauces or pouring over a crumble.', 3.45, '500ml', 'Dairy'::text, 'Own Produce'::text, 52.945::float, -1.72::float, false, ARRAY['milk']::text[], ARRAY['vegetarian']::text[]),
  ('Semi Skimmed Milk (500ml Plastic Carton)', 'Semi skimmed milk from Alkmonton''s own Ayrshire herd, bottled fresh on the farm in a handy 500ml plastic carton.', 1.10, '500ml carton', 'Dairy', 'Own Produce', 52.945, -1.72, false, ARRAY['milk'], ARRAY['vegetarian']),
  ('Skimmed Milk (2L Plastic Carton)', 'Skimmed milk from Alkmonton''s own pedigree Ayrshire herd, bottled fresh on the farm. Great value in a 2L carton.', 3.05, '2 litre carton', 'Dairy', 'Own Produce', 52.945, -1.72, false, ARRAY['milk'], ARRAY['vegetarian']),
  ('Skimmed Milk (500ml Plastic Carton)', 'Skimmed milk from Alkmonton''s own pedigree Ayrshire herd, bottled fresh on the farm in a handy 500ml plastic carton.', 1.10, '500ml carton', 'Dairy', 'Own Produce', 52.945, -1.72, false, ARRAY['milk'], ARRAY['vegetarian']),
  ('Manor Farm Thick & Creamy Live Yoghurt — Lemon Curd (125g)', 'Thick and creamy live yoghurt from Manor Farm with a lemon curd swirl. Stocked by Alkmonton Dairy.', 0.85, '125g pot', 'Dairy', 'Regional', NULL, NULL, true, ARRAY['milk'], ARRAY['vegetarian']),
  ('Manor Farm Thick & Creamy Live Yoghurt — Orange & Passionfruit (125g)', 'Thick and creamy live yoghurt from Manor Farm with orange and passionfruit. Stocked by Alkmonton Dairy.', 0.85, '125g pot', 'Dairy', 'Regional', NULL, NULL, true, ARRAY['milk'], ARRAY['vegetarian']),
  ('Manor Farm Thick & Creamy Live Yoghurt — Strawberry (125g)', 'Thick and creamy live yoghurt from Manor Farm with a strawberry layer. Stocked by Alkmonton Dairy.', 0.85, '125g pot', 'Dairy', 'Regional', NULL, NULL, true, ARRAY['milk'], ARRAY['vegetarian']),
  ('Manor Farm Thick & Creamy Live Yoghurt — Black Cherry (125g)', 'Thick and creamy live yoghurt from Manor Farm with a black cherry layer. Stocked by Alkmonton Dairy.', 0.85, '125g pot', 'Dairy', 'Regional', NULL, NULL, true, ARRAY['milk'], ARRAY['vegetarian'])
) AS p(name, description, price, unit, category, locality, lat, lng, variable_location, allergens, tags);
