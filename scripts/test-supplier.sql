-- Test Supplier - For Payment System Testing
-- Run this entire script in Supabase SQL Editor (single execution)

WITH new_supplier AS (
  INSERT INTO suppliers (name, description, image, location, category, lat, lng, status, email, instagram)
  VALUES (
    'Test Farm Shop',
    'A test supplier for development and payment testing purposes. This supplier sells a variety of local and regional produce.',
    '',
    'Ashbourne',
    'Farm Shop',
    53.0167,
    -1.7333,
    'launch_live',
    'test@localproduceltd.co.uk',
    NULL
  )
  RETURNING id
)
INSERT INTO products (supplier_id, name, description, price, unit, image, category, in_stock, locality, lat, lng, variable_location, status, allergens, tags)
SELECT id, name, description, price, unit, '', category, true, locality, lat, lng, variable_location, 'approved', allergens, tags
FROM new_supplier, (VALUES
  ('Test Local Eggs', 'Free range eggs from a local Derbyshire farm. Perfect for testing checkout with a local product.', 3.50, 'half dozen', 'Eggs'::text, 'Local'::text, 53.0167::float, -1.7333::float, false, ARRAY['eggs']::text[], ARRAY['vegetarian']::text[]),
  ('Test Sourdough Loaf', 'Artisan sourdough bread baked fresh. A regional product for testing.', 4.25, 'each', 'Bread', 'Regional', 52.9228, -1.4748, false, ARRAY['gluten'], ARRAY['vegan', 'vegetarian']),
  ('Test Organic Honey', 'Raw organic honey from UK beekeepers. Testing a UK-sourced product.', 8.99, '340g jar', 'Pantry', 'UK', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegetarian']),
  ('Test Olive Oil', 'Extra virgin olive oil from Spain. Testing an international product.', 12.50, '500ml bottle', 'Pantry', 'International', 40.4637, -3.7492, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Test Cheddar Cheese', 'Mature cheddar from the Peak District. A local dairy product with allergens.', 6.75, '250g block', 'Cheese', 'Local', 53.2, -1.8, false, ARRAY['milk'], ARRAY['vegetarian', 'gluten-free'])
) AS p(name, description, price, unit, category, locality, lat, lng, variable_location, allergens, tags);
