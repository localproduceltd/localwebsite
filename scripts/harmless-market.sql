-- Harmless Market - Supplier and Products Upload
-- Run this entire script in Supabase SQL Editor (single execution)

WITH new_supplier AS (
  INSERT INTO suppliers (name, description, image, location, category, lat, lng, status, email, instagram, featured, on_holiday, holiday_until, holiday_message)
  VALUES (
    'Harmless Market',
    'Harmless Market is a carefully curated indie grocer in Burton-on-Trent stocking organic fruit & veg, pantry essentials and deli provisions. They favour sustainable and biodynamic production methods and champion small artisan brands over the household names.',
    '',
    'Burton-on-Trent',
    'Farm Shop',
    52.8019,
    -1.6367,
    'launch_not_live',
    'hello@feorm.co.uk',
    NULL,
    false,
    false,
    NULL,
    NULL
  )
  RETURNING id
)
INSERT INTO products (supplier_id, name, description, price, unit, image, category, in_stock, locality, lat, lng, variable_location, status, allergens, tags)
SELECT id, name, description, price, unit, '', category, true, locality, lat, lng, variable_location, 'approved', allergens, tags
FROM new_supplier, (VALUES
  ('Apple & Chilli Jelly', 'Bright, fruity and with a gentle heat — a brilliant cheeseboard companion alongside mellow brie or even heavy-hitting stilton. Made by Fizzel with Bramley apples, sugar, lemon juice and chilli flakes.', 5.25, '227g jar', 'Preserves & Condiments'::text, 'UK'::text, 50.7184::float, -3.5339::float, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'gluten-free', 'dairy-free']),
  ('Apricot, Orange & Rosemary Jam', 'Hand-made artisan jam combining sweet apricots with zesty orange and a hint of fragrant rosemary. Lovely on toast, on a cheeseboard, or as a glaze for meats.', 5.75, '227g jar', 'Preserves & Condiments', 'UK', 50.7184, -3.5339, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'gluten-free', 'dairy-free']),
  ('Apple Cider Vinegar', 'Raw, unfiltered, unpasteurised organic apple cider vinegar including ''The Mother''. Take with water or toss in to a salad.', 6.90, '750ml bottle', 'Pantry', 'UK', 51.0323, -0.9462, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'organic', 'gluten-free', 'dairy-free']),
  ('Basil & Mint Kombucha', 'Fresh, peaceful and unique — an aromatic pairing inspired by the virgin mojito. Instantly refreshing and a 1-star Great Taste Award winner.', 3.00, '250ml bottle', 'Drinks', 'International', 53.3498, -6.2603, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'dairy-free']),
  ('100% Pomegranate Juice', 'Cold-pressed, not from concentrate, no water or sugar added. 100% organic fruit, lightly pasteurised to keep its natural character.', 7.80, '750ml bottle', 'Drinks', 'International', 45.8150, 15.9819, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'organic', 'gluten-free', 'dairy-free']),
  ('Ancient Grain Fettuccine', 'Flat ribbon pasta made from modern, ancient and heritage wheats. Organically grown in the UK, stone milled, bronze die extruded and slow dried. Brilliant with mushroom or creamy sauces.', 4.25, '250g pack', 'Pantry', 'UK', 52.1925, -2.2200, false, ARRAY['gluten']::text[], ARRAY['vegan', 'vegetarian', 'organic', 'dairy-free']),
  ('100% Extra Virgin Olive Oil Crisps', 'A classic favourite — potato crisps fried in fruity extra virgin olive oil from a family mill in Andalusia, with a balanced richness.', 4.80, '125g bag', 'Pantry', 'International', 41.3851, 2.1734, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'gluten-free', 'dairy-free']),
  ('Avocado Oil Squeezy Bottle 750ml', 'Naturally refined avocado cooking oil with a neutral taste and a high 271°C smoke point. Perfect for high-heat searing, frying, roasting and emulsions.', 12.99, '750ml bottle', 'Pantry', 'UK', 51.5074, -0.1278, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'gluten-free', 'dairy-free']),
  ('Arrabbiata Pasta Sauce', 'Authentic Italian pasta sauce prepared in Sicily with 100% Italian ingredients, naturally sweet sun-ripened tomatoes, extra virgin olive oil and a kick of chilli. No sugar, starch or flavour enhancers.', 3.25, '340g jar', 'Preserves & Condiments', 'International', 43.0000, 11.0000, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'organic', 'gluten-free', 'dairy-free']),
  ('Artichoke & Garlic Sauce/Spread', 'A creamy artichoke and garlic blend from the hills of Piemonte, made by a small producer with fresh artichokes, olive oil, garlic and sea salt. Versatile naturally-vegan sauce-spread hybrid.', 5.50, '180g jar', 'Preserves & Condiments', 'International', 45.0000, 8.0000, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian', 'gluten-free', 'dairy-free'])
) AS p(name, description, price, unit, category, locality, lat, lng, variable_location, allergens, tags);
