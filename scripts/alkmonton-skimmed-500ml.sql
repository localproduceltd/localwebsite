-- Alkmonton Dairy - Add Skimmed Milk 500ml
-- Run this in Supabase SQL Editor

INSERT INTO products (supplier_id, name, description, price, unit, image, category, in_stock, locality, lat, lng, variable_location, status, allergens, tags)
SELECT id, 'Skimmed Milk (500ml Plastic Carton)', 'Skimmed milk from Alkmonton''s own pedigree Ayrshire herd, bottled fresh on the farm in a handy 500ml plastic carton.', 1.10, '500ml carton', '', 'Dairy', true, 'Own Produce', 52.945, -1.72, false, 'approved', ARRAY['milk'], ARRAY['vegetarian']
FROM suppliers WHERE name = 'Alkmonton Dairy';
