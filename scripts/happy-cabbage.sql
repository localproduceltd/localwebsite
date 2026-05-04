-- Happy Cabbage - Supplier and Products Upload
-- Run this entire script in Supabase SQL Editor (single execution)

WITH new_supplier AS (
  INSERT INTO suppliers (name, description, image, location, category, lat, lng, status, email, instagram)
  VALUES (
    'Happy Cabbage',
    'Happy Cabbage is run by Lynne and Matt from Pikehall, just outside Ashbourne. They have been selling fresh produce to the public for over 20 years, attending small venues, events and mini markets across the local area. Their day starts at 3am at the wholesale market and direct suppliers, hand-picking the freshest produce so customers get the best quality every day.',
    '',
    'Pikehall',
    'Greengrocer',
    53.115,
    -1.725,
    'launch_not_live',
    'hlynnebrindley@gmail.com',
    NULL
  )
  RETURNING id
)
INSERT INTO products (supplier_id, name, description, price, unit, image, category, in_stock, locality, lat, lng, variable_location, status, allergens, tags)
SELECT id, name, description, price, unit, '', category, true, locality, lat, lng, variable_location, 'approved', allergens, tags
FROM new_supplier, (VALUES
  ('Jacket Potatoes', 'Large jacket potatoes, UK grown. Perfect for baking.', 0.80, 'each', 'Vegetables'::text, 'UK'::text, NULL::float, NULL::float, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'gluten-free', 'dairy-free']),
  ('Sweet Potato', 'Sweet potatoes, internationally sourced.', 1.00, 'each', 'Vegetables', 'International', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'gluten-free', 'dairy-free']),
  ('Baby English New Washed Potatoes', 'Baby new potatoes, UK grown. Washed and ready to cook. 400g punnet.', 2.00, '400g punnet', 'Vegetables', 'UK', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'gluten-free', 'dairy-free']),
  ('English Carrots', 'English carrots from Strawson Ltd, Nottinghamshire. 500g for £1.', 1.00, '500g', 'Vegetables', 'Regional', 53.185004, -0.816952, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'gluten-free', 'dairy-free']),
  ('Cauliflower', 'Page Quality Brassica, UK grower.', 1.80, 'each', 'Vegetables', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'gluten-free', 'dairy-free']),
  ('Chestnut Mushrooms', 'Excellent quality brown cap chestnut mushrooms, Polish grown. 200g punnet.', 2.00, '200g punnet', 'Vegetables', 'International', 51.9194, 19.1451, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'gluten-free', 'dairy-free']),
  ('Portobello Large Flat Mushrooms', 'Large flat Portobello mushrooms, Polish grown.', 1.20, 'each', 'Vegetables', 'International', 51.9194, 19.1451, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'gluten-free', 'dairy-free']),
  ('Leeks', 'Large leeks, UK grown by Seddons in Holmewood, Lancashire.', 1.00, 'each', 'Vegetables', 'UK', 53.665326, -2.86187, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'gluten-free', 'dairy-free']),
  ('Courgette', 'Spanish-grown courgettes.', 0.70, 'each', 'Vegetables', 'International', 40.4637, -3.7492, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'gluten-free', 'dairy-free']),
  ('White & Red Cabbage', 'White and red cabbage, UK grown in Lincolnshire.', 1.00, 'each', 'Vegetables', 'UK', 53.231553, -0.545625, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'gluten-free', 'dairy-free']),
  ('White & Red Onion Mix', 'White and red onion mix, UK grown in Lincolnshire. 500g for £1.', 1.00, '500g', 'Vegetables', 'UK', 53.231553, -0.545625, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'gluten-free', 'dairy-free']),
  ('Mixed Peppers', 'Mixed colour peppers (choose your colour), Spanish grown.', 0.80, 'each', 'Vegetables', 'International', 40.4637, -3.7492, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'gluten-free', 'dairy-free']),
  ('Butternut Squash', 'Large butternut squash, grown in sunny Spain.', 1.80, 'each', 'Vegetables', 'International', 40.4637, -3.7492, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'gluten-free', 'dairy-free']),
  ('Cherry Tomatoes', 'Spanish vine organic cherry tomatoes. 500g punnet.', 2.50, '500g punnet', 'Vegetables', 'International', 40.4637, -3.7492, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'gluten-free', 'dairy-free', 'organic']),
  ('Rocket Salad', 'UK-grown rocket salad from LJ Betts in West Malling, Kent - growers since 1930. Lovely fresh leaves. 100g in a punnet.', 3.00, '100g punnet', 'Salad & Herbs', 'UK', 51.277597, 0.511131, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'gluten-free', 'dairy-free']),
  ('Little Gem Lettuce', 'UK-grown Little Gem lettuce from LJ Betts in West Malling, Kent - growers since 1930. Pack of 2 heads.', 1.50, 'pack of 2 heads', 'Salad & Herbs', 'UK', 51.277597, 0.511131, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'gluten-free', 'dairy-free']),
  ('Garlic', 'Garlic grown on the Isle of Wight.', 1.00, 'each', 'Vegetables', 'UK', 50.677917, -1.246315, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'gluten-free', 'dairy-free']),
  ('Avocado', 'Avocados grown in Southern California.', 1.30, 'each', 'Fruit', 'International', 34.0522, -118.2437, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'gluten-free', 'dairy-free']),
  ('Satsumas', 'Seedless satsumas grown in Spain.', 0.40, 'each', 'Fruit', 'International', 40.4637, -3.7492, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'gluten-free', 'dairy-free']),
  ('Plums', 'Ruby Crunch plums from South Africa - sweet, juicy and large.', 0.50, 'each', 'Fruit', 'International', -30.5595, 22.9375, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'gluten-free', 'dairy-free']),
  ('Bananas', 'Del Monte quality bananas from Costa Rica. 3 for £1.', 1.00, '3 for £1', 'Fruit', 'International', 9.7489, -84.083, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'gluten-free', 'dairy-free']),
  ('Apples (Mixed)', 'Apple mix grown in Kent, England. 4 for £2.', 2.00, 'mix of 4', 'Fruit', 'UK', 51.277597, 0.511131, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'gluten-free', 'dairy-free']),
  ('Ruby Grapefruit', 'Ruby grapefruit grown in Florida.', 1.00, 'each', 'Fruit', 'International', 27.9944, -81.7603, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'gluten-free', 'dairy-free']),
  ('Oranges', 'Medium oranges grown in Spain. 2 for £1.', 1.00, '2 for £1', 'Fruit', 'International', 40.4637, -3.7492, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'gluten-free', 'dairy-free']),
  ('Strawberries', 'Spanish-grown strawberries (English-grown coming soon).', 2.00, 'punnet', 'Fruit', 'International', 40.4637, -3.7492, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'gluten-free', 'dairy-free']),
  ('Raspberries', 'Moroccan-grown raspberries.', 2.50, 'punnet', 'Fruit', 'International', 31.7917, -7.0926, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'gluten-free', 'dairy-free']),
  ('Blueberries', 'Moroccan-grown blueberries.', 2.00, 'punnet', 'Fruit', 'International', 31.7917, -7.0926, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'gluten-free', 'dairy-free']),
  ('Free Range Large Eggs', 'Free range large eggs from Elliots of Yorkshire - trusted suppliers for 20 years.', 2.40, 'half dozen (6)', 'Eggs', 'Regional', 53.681225, -1.492599, false, ARRAY['eggs'], ARRAY['vegetarian', 'gluten-free', 'dairy-free'])
) AS p(name, description, price, unit, category, locality, lat, lng, variable_location, allergens, tags);
