-- This Gardening Gal - Supplier and Products Upload
-- Run this entire script in Supabase SQL Editor (single execution)

WITH new_supplier AS (
  INSERT INTO suppliers (name, description, image, location, category, lat, lng, status, email, instagram)
  VALUES (
    'This Gardening Gal',
    'This Gardening Gal is a small flower farm and florist in Morley, Derbyshire, run by Beth Bielby. Beth grows seasonal British cut stems in peat-free, pesticide-free beds, selling them as mixed bunches, DIY buckets and bespoke arrangements for weddings, events and funerals. She''s also the Flowers from the Farm Regional Coordinator for the East Midlands.',
    '',
    'Morley, Derbyshire, DE7 6DJ',
    'Flowers',
    52.9795,
    -1.4259,
    'launch_not_live',
    'thisgardeninggal@gmail.com',
    NULL
  )
  RETURNING id
)
INSERT INTO products (supplier_id, name, description, price, unit, image, category, in_stock, locality, lat, lng, variable_location, status, allergens, tags)
SELECT id, name, description, price, unit, '', category, true, locality, lat, lng, variable_location, 'approved', allergens, tags
FROM new_supplier, (VALUES
  ('Seasonal Bouquet in a Milk Bottle', 'A handpicked seasonal bouquet of British-grown cut stems, arranged in a vintage glass milk bottle. Grown peat-free and pesticide-free at the farm in Morley, Derbyshire — the contents change with whatever''s looking best that week.', 15.0, 'each', 'Other', 'Own Produce', 52.9795, -1.4259, false, ARRAY[]::text[], ARRAY[]::text[])
) AS p(name, description, price, unit, category, locality, lat, lng, variable_location, allergens, tags);
