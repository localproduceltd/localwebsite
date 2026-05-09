-- Secret Garden Honey - Supplier and Products Upload
-- Run this entire script in Supabase SQL Editor (single execution)

WITH new_supplier AS (
  INSERT INTO suppliers (name, description, image, location, category, lat, lng, status, email, instagram)
  VALUES (
    'Secret Garden Honey',
    'Secret Garden Honey is a small, award-winning honey producer based in Belper, Derbyshire. Paul keeps apiaries dotted around local villages — Belper, Crich, Heage, Wirksworth and more — and bottles each batch as single-source honey straight from the hive. No additives, no heat treatment, just raw 100% natural honey.',
    '',
    'Belper',
    'Honey',
    53.018896,
    -1.468629,
    'launch_not_live',
    'secret.garden.belper@gmail.com',
    NULL
  )
  RETURNING id
)
INSERT INTO products (supplier_id, name, description, price, unit, image, category, in_stock, locality, lat, lng, variable_location, status, allergens, tags)
SELECT id, name, description, price, unit, '', category, true, locality, lat, lng, variable_location, 'approved', allergens, tags
FROM new_supplier, (VALUES
  ('Belper Summer - Runny Honey (8oz)', 'Single-source raw runny honey from Paul''s Belper apiaries, harvested in summer. Golden nectar collected by his bees from local shrubs, flowers and trees — no additives, no heat treatment, just pure honey.', 7.99, '227g jar', 'Preserves & Condiments'::text, 'Own Produce'::text, 53.018896::float, -1.468629::float, false, ARRAY[]::text[], ARRAY['vegetarian', 'gluten-free', 'dairy-free']),
  ('Belper Spring - Runny Honey (8oz)', 'Single-source raw runny honey from Paul''s Belper apiaries, harvested in spring. Lighter and more floral than the summer batch — straight from the hive to the jar with no additives or heat treatment.', 7.99, '227g jar', 'Preserves & Condiments', 'Own Produce', 53.018896, -1.468629, false, ARRAY[]::text[], ARRAY['vegetarian', 'gluten-free', 'dairy-free']),
  ('Wirksworth Spring - Runny Honey (8oz)', 'Single-source raw runny honey from a Wirksworth apiary, harvested in spring. 100% pure and natural — no additives, no heat treatment, no fine filtering.', 7.99, '227g jar', 'Preserves & Condiments', 'Own Produce', 53.08284, -1.564806, false, ARRAY[]::text[], ARRAY['vegetarian', 'gluten-free', 'dairy-free']),
  ('Heage Spring - Runny Honey (8oz)', 'Single-source raw runny honey from a Heage apiary, harvested in spring. Bottled straight from the hive with no additives or heat treatment.', 7.99, '227g jar', 'Preserves & Condiments', 'Own Produce', 53.052367, -1.463577, false, ARRAY[]::text[], ARRAY['vegetarian', 'gluten-free', 'dairy-free']),
  ('Crich Spring - Runny Honey (8oz)', 'Single-source raw runny honey from a Crich apiary, harvested in spring. 100% pure and natural — no additives, no chemicals, no heat treatment.', 7.99, '227g jar', 'Preserves & Condiments', 'Own Produce', 53.086262, -1.477086, false, ARRAY[]::text[], ARRAY['vegetarian', 'gluten-free', 'dairy-free'])
) AS p(name, description, price, unit, category, locality, lat, lng, variable_location, allergens, tags);
