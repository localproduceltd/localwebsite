-- Alkmonton Dairy - Plastic Carton Products
-- Run this in Supabase SQL Editor

INSERT INTO products (supplier_id, name, description, price, unit, image, category, in_stock, locality, lat, lng, variable_location, status, allergens, tags)
SELECT 
  s.id,
  p.name,
  p.description,
  p.price,
  p.unit,
  p.image,
  p.category,
  true,
  p.locality,
  p.lat,
  p.lng,
  false,
  'approved',
  p.allergens,
  p.tags
FROM suppliers s
CROSS JOIN (VALUES
  ('Whole Milk (500ml Plastic Carton)', 'Fresh whole milk from Alkmonton''s own pedigree Ayrshire herd, bottled on the farm in a handy 500ml plastic carton.', 1.00, '500ml carton', '/images/Alkmonton Dairy Photos/Whole Milk (500ml Plastic Carton).webp', 'Dairy'::text, 'Own Produce'::text, 52.945::float, -1.72::float, ARRAY['milk'], ARRAY['vegetarian']),
  ('Whole Milk (1L Plastic Carton)', 'Fresh whole milk from Alkmonton''s own pedigree Ayrshire herd, bottled on the farm. Rich, full-fat and full of flavour.', 1.90, '1 litre carton', '/images/Alkmonton Dairy Photos/Whole Milk (1L Plastic Carton).webp', 'Dairy', 'Own Produce', 52.945, -1.72, ARRAY['milk'], ARRAY['vegetarian']),
  ('Whole Milk (2L Plastic Carton)', 'Fresh whole milk from Alkmonton''s own pedigree Ayrshire herd, bottled on the farm. Great value for families.', 3.00, '2 litre carton', '/images/Alkmonton Dairy Photos/Whole Milk (2L Plastic Carton).webp', 'Dairy', 'Own Produce', 52.945, -1.72, ARRAY['milk'], ARRAY['vegetarian']),
  ('Semi Skimmed Milk (1L Plastic Carton)', 'Semi skimmed milk from Alkmonton''s own Ayrshire herd — the everyday staple, fresh from the farm.', 1.90, '1 litre carton', '/images/Alkmonton Dairy Photos/Semi Skimmed Milk (1L Plastic Carton).webp', 'Dairy', 'Own Produce', 52.945, -1.72, ARRAY['milk'], ARRAY['vegetarian']),
  ('Semi Skimmed Milk (2L Plastic Carton)', 'Semi skimmed milk from Alkmonton''s own Ayrshire herd — the everyday staple, fresh from the farm and great value in a 2L carton.', 3.00, '2 litre carton', '/images/Alkmonton Dairy Photos/Semi Skimmed Milk (2L Plastic Carton).webp', 'Dairy', 'Own Produce', 52.945, -1.72, ARRAY['milk'], ARRAY['vegetarian']),
  ('Skimmed Milk (1L Plastic Carton)', 'Skimmed milk from Alkmonton''s own pedigree Ayrshire herd, bottled fresh on the farm.', 1.90, '1 litre carton', '/images/Alkmonton Dairy Photos/Skimmed Milk (1L Plastic Carton).webp', 'Dairy', 'Own Produce', 52.945, -1.72, ARRAY['milk'], ARRAY['vegetarian'])
) AS p(name, description, price, unit, image, category, locality, lat, lng, allergens, tags)
WHERE s.name = 'Alkmonton Dairy';
