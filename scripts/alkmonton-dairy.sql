-- Alkmonton Dairy - Supplier and Products Upload (with images)
-- Run this entire script in Supabase SQL Editor (single execution)

WITH new_supplier AS (
  INSERT INTO suppliers (name, description, image, location, category, lat, lng, status, email)
  VALUES (
    'Alkmonton Dairy',
    'Alkmonton Dairy is a small family-run dairy farm nestled in the Derbyshire countryside near Ashbourne, milking a herd of pedigree Ayrshire cows. All of their milk comes straight from their own cows and is bottled fresh on the farm — delivered to doorsteps across the local area in returnable glass bottles. As well as their own milk and cream, they produce free range eggs, butter and more from the farm.',
    '/images/Alkmonton Dairy Photos/_Supplier Profile Photo (Herd).webp',
    'Alkmonton',
    'Dairy Farm',
    52.9397,
    -1.7202,
    'launch_not_live',
    'info@alkmontondairy.co.uk'
  )
  RETURNING id
)
INSERT INTO products (supplier_id, name, description, price, unit, image, category, in_stock, locality, lat, lng, variable_location, status, allergens, tags)
SELECT id, name, description, price, unit, image, category, true, locality, lat, lng, variable_location, 'approved', allergens, tags
FROM new_supplier, (VALUES
  ('Whole Milk (500ml Glass Bottle)', 'Fresh whole milk from Alkmonton''s own Ayrshire herd, bottled on the farm and delivered in returnable glass bottles. Rich, creamy and full of flavour.', 1.00, '500ml bottle', '/images/Alkmonton Dairy Photos/Whole Milk (500ml Glass Bottle).webp', 'Dairy'::text, 'Own Produce'::text, 52.9397::float, -1.7202::float, false, ARRAY['milk'], ARRAY['vegetarian']),
  ('Whole Milk (1L Glass Bottle)', 'Fresh whole milk from Alkmonton''s own Ayrshire herd, bottled on the farm. Delivered in returnable glass bottles — creamy, local and full of flavour.', 1.90, '1L bottle', '/images/Alkmonton Dairy Photos/Whole Milk (1L Glass Bottle).webp', 'Dairy', 'Own Produce', 52.9397, -1.7202, false, ARRAY['milk'], ARRAY['vegetarian']),
  ('Semi-Skimmed Milk (500ml Glass Bottle)', 'Semi-skimmed milk from Alkmonton''s own Ayrshire herd, bottled on the farm and delivered in returnable glass bottles. A lighter option with all the local freshness.', 1.00, '500ml bottle', '/images/Alkmonton Dairy Photos/Semi-Skimmed Milk (500ml Glass Bottle).webp', 'Dairy', 'Own Produce', 52.9397, -1.7202, false, ARRAY['milk'], ARRAY['vegetarian']),
  ('Semi-Skimmed Milk (1L Glass Bottle)', 'Semi-skimmed milk from Alkmonton''s own Ayrshire herd, bottled fresh on the farm and delivered in returnable glass bottles.', 1.90, '1L bottle', '/images/Alkmonton Dairy Photos/Semi-Skimmed Milk (1L Glass Bottle).webp', 'Dairy', 'Own Produce', 52.9397, -1.7202, false, ARRAY['milk'], ARRAY['vegetarian']),
  ('Skimmed Milk (500ml Glass Bottle)', 'Fresh skimmed milk from Alkmonton''s own Ayrshire herd, bottled on the farm and delivered in returnable glass bottles. All the local goodness, virtually fat free.', 1.00, '500ml bottle', '/images/Alkmonton Dairy Photos/Skimmed Milk (500ml Glass Bottle).webp', 'Dairy', 'Own Produce', 52.9397, -1.7202, false, ARRAY['milk'], ARRAY['vegetarian']),
  ('Skimmed Milk (1L Glass Bottle)', 'Fresh skimmed milk from Alkmonton''s own Ayrshire herd, bottled on the farm and delivered in returnable glass bottles. All the local goodness, virtually fat free.', 1.90, '1L bottle', '/images/Alkmonton Dairy Photos/Skimmed Milk (1L Glass Bottle).webp', 'Dairy', 'Own Produce', 52.9397, -1.7202, false, ARRAY['milk'], ARRAY['vegetarian']),
  ('Double Cream (290ml)', 'Luscious double cream made with milk from Alkmonton''s own herd. Fresh from the farm — perfect for puddings, coffee or anything that deserves a proper cream.', 2.60, '290ml', '/images/Alkmonton Dairy Photos/Double Cream (290ml).webp', 'Dairy', 'Own Produce', 52.9397, -1.7202, false, ARRAY['milk'], ARRAY['vegetarian']),
  ('Salted Butter (250g)', 'Farmhouse salted butter made from the milk of Alkmonton''s own Ayrshire cows. Proper butter — creamy, rich and delicious.', 4.25, '250g block', '/images/Alkmonton Dairy Photos/Salted Butter (250g).webp', 'Dairy', 'Own Produce', 52.9397, -1.7202, false, ARRAY['milk'], ARRAY['vegetarian']),
  ('Free Range Eggs (Box of 6)', 'Free range eggs from hens kept at Alkmonton Dairy farm. Laid fresh and packed with flavour — the kind of eggs that actually taste of something.', 2.75, 'box of 6', '/images/Alkmonton Dairy Photos/Free Range Eggs (Box of 6).webp', 'Eggs', 'Own Produce', 52.9397, -1.7202, false, ARRAY['eggs'], ARRAY['vegetarian']),
  ('Manor Farm Thick & Creamy Live Natural Yoghurt', 'Thick, creamy live natural yoghurt from Manor Farm. Rich, tangy and full of good live cultures — lovely with fruit, granola or just a drizzle of honey.', 0.00, '125g pot', '/images/Alkmonton Dairy Photos/Manor Farm Thick & Creamy Live Natural Yoghurt.webp', 'Dairy', 'Own Produce', 52.9397, -1.7202, false, ARRAY['milk'], ARRAY['vegetarian'])
) AS p(name, description, price, unit, image, category, locality, lat, lng, variable_location, allergens, tags);

-- NOTE: The yoghurt price is £0.00 in the spreadsheet - you may want to update this after import
