-- Anthony Andrews Butchers - Supplier and Products Upload
-- Run this entire script in Supabase SQL Editor (single execution)

WITH new_supplier AS (
  INSERT INTO suppliers (name, description, image, location, category, lat, lng, status, email)
  VALUES (
    'Anthony Andrews Butchers',
    'Anthony Andrews Butchers is a traditional family butcher based in the village of Duffield, Derbyshire. Known for their quality Derbyshire dry-aged beef and homemade sausages using free-range pork, they have been supplying the local community with premium, locally sourced meat for years.',
    '/images/suppliers/anthony-andrews.jpg',
    'Duffield',
    'Butcher',
    52.9878,
    -1.4867,
    'launch_not_live',
    NULL
  )
  RETURNING id
)
INSERT INTO products (supplier_id, name, description, price, unit, image, category, in_stock, locality, lat, lng, variable_location, status, allergens, tags)
SELECT id, name, description, price, unit, image, category, in_stock, locality, lat, lng, variable_location, status, allergens, tags
FROM new_supplier, (VALUES
  ('Pork Sausages (Thin)', 'Homemade thin pork sausages made with free-range pork. A traditional butcher''s recipe, great for breakfast or a classic sausage sandwich.', 3.95, 'pack of 6', '', 'Meat & Poultry', true, 'Local'::text, NULL::float, NULL::float, true, 'approved'::text, ARRAY['gluten', 'mustard'], ARRAY[]::text[]),
  ('Pork and Tomato Sausages (Thin)', 'Thin pork sausages with a hint of tomato, made in-house using free-range pork. A lighter, flavourful twist on a classic.', 3.95, 'pack of 6', '', 'Meat & Poultry', true, 'Local', NULL, NULL, true, 'approved', ARRAY['gluten', 'mustard'], ARRAY[]::text[]),
  ('Cumberland Pork Sausages (Thick)', 'Thick Cumberland-style pork sausages, packed with herbs and spices. Made with free-range pork by Anthony Andrews'' in-house team.', 5.50, 'pack of 6', '', 'Meat & Poultry', true, 'Local', NULL, NULL, true, 'approved', ARRAY['gluten', 'mustard'], ARRAY[]::text[]),
  ('Cracked Black Pepper Sausages (Thick)', 'Thick free-range pork sausages with a bold cracked black pepper seasoning. Made in the traditional butcher style for a real depth of flavour.', 5.50, 'pack of 6', '', 'Meat & Poultry', true, 'Local', NULL, NULL, true, 'approved', ARRAY['gluten', 'mustard'], ARRAY[]::text[]),
  ('Dry Cured Plain Back Bacon', 'Traditionally dry cured plain back bacon from Anthony Andrews. Minimal water content means it cooks beautifully and tastes exactly as bacon should.', 4.75, 'pack of 6 rashers', '', 'Meat & Poultry', true, 'Local', NULL, NULL, true, 'approved', ARRAY['sulphites'], ARRAY[]::text[]),
  ('Dry Cured Oak Smoked Back Bacon', 'Dry cured back bacon with a gentle oak smoke finish. Rich, deep flavour that elevates any bacon sandwich or cooked breakfast.', 4.85, 'pack of 6 rashers', '', 'Meat & Poultry', true, 'Local', NULL, NULL, true, 'approved', ARRAY['sulphites'], ARRAY[]::text[]),
  ('Chicken Fillets (Grade A, Barn Reared)', 'Grade A barn-reared chicken fillets, sourced and prepared by Anthony Andrews. Tender, well-trimmed, and ready to cook.', 6.95, 'pack of 2', '', 'Meat & Poultry', true, 'Local', NULL, NULL, true, 'approved', ARRAY[]::text[], ARRAY[]::text[]),
  ('Minced Beef', 'Derbyshire dry-aged minced beef, freshly prepared in store. Full of flavour and perfect for burgers, bolognese, or meatballs.', 7.75, '500g', '', 'Meat & Poultry', true, 'Local', NULL, NULL, true, 'approved', ARRAY[]::text[], ARRAY[]::text[]),
  ('Stewing Beef', 'Derbyshire dry-aged stewing beef, hand-cut for slow cooking. Deeply flavourful and ideal for casseroles, stews, and pies.', 8.75, '500g', '', 'Meat & Poultry', true, 'Local', NULL, NULL, true, 'approved', ARRAY[]::text[], ARRAY[]::text[])
) AS p(name, description, price, unit, image, category, in_stock, locality, lat, lng, variable_location, status, allergens, tags);
