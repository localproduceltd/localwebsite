-- Batch Upload: Belper Coffee Co., Daisy Hill Refill, Handmade Design
-- Run this entire script in Supabase SQL Editor (single execution)

-- ============================================================================
-- 1. BELPER COFFEE CO. (6 products)
-- ============================================================================
WITH belper_supplier AS (
  INSERT INTO suppliers (name, description, image, location, category, lat, lng, status, email)
  VALUES (
    'Belper Coffee Co.',
    'Belper Coffee Co. is a family-run speciality coffee roaster based in Belper, Derbyshire. Holly roasts small batches of carefully selected coffees from around the world — from bright East African single origins to rich South American blends — all with a focus on quality, flavour and freshness.',
    '/images/suppliers/belper-coffee-co.jpg',
    'Belper',
    'Coffee Roaster',
    53.021,
    -1.476,
    'launch_not_live',
    'hello@belper.coffee'
  )
  RETURNING id
)
INSERT INTO products (supplier_id, name, description, price, unit, image, category, in_stock, locality, lat, lng, variable_location, status, allergens, tags)
SELECT id, name, description, price, unit, '', category, true, locality, lat, lng, variable_location, 'approved', allergens, tags
FROM belper_supplier, (VALUES
  ('Espresso Blend', 'Belper Coffee Co.''s house espresso blend, roasted fresh in Belper. Made with coffees from South America, it''s smooth, balanced and works beautifully as an espresso or milk-based drink.', 7.95, '227g bag', 'Drinks'::text, 'Own Produce'::text, 53.021::float, -1.476::float, false, ARRAY[]::text[], ARRAY[]::text[]),
  ('Breakfast Blend', 'Belper Coffee Co.''s Great Taste award-winning breakfast blend. Bright, fruity and perfect for your morning brew — especially lovely as a latte.', 7.95, '227g bag', 'Drinks', 'Own Produce', 53.021, -1.476, false, ARRAY[]::text[], ARRAY[]::text[]),
  ('House Decaf', 'Three years in the making, Belper Coffee Co.''s own decaf. Smooth, full-bodied and roasted fresh in Belper — proof that great coffee doesn''t need caffeine.', 7.95, '227g bag', 'Drinks', 'Own Produce', 53.021, -1.476, false, ARRAY[]::text[], ARRAY[]::text[]),
  ('Tanzania AA', 'A strictly high-grown washed Tanzanian coffee, roasted by Holly in Belper. Bright acidity with a complex, fruity flavour profile.', 8.95, '227g bag', 'Drinks', 'Own Produce', 53.021, -1.476, false, ARRAY[]::text[], ARRAY[]::text[]),
  ('Rwanda Huye Mountain', 'From the high-altitude farms of Rwanda, this naturally processed coffee reveals indulgent notes of watermelon, strawberry and caramel. Roasted fresh in Belper.', 8.95, '227g bag', 'Drinks', 'Own Produce', 53.021, -1.476, false, ARRAY[]::text[], ARRAY[]::text[]),
  ('Colombia Supremo', 'A smooth, medium-bodied Colombian coffee with balanced acidity and rich nutty, chocolatey notes. Roasted in small batches by Belper Coffee Co.', 8.95, '227g bag', 'Drinks', 'Own Produce', 53.021, -1.476, false, ARRAY[]::text[], ARRAY[]::text[])
) AS p(name, description, price, unit, category, locality, lat, lng, variable_location, allergens, tags);

-- ============================================================================
-- 2. DAISY HILL REFILL (25 products)
-- ============================================================================
WITH daisy_supplier AS (
  INSERT INTO suppliers (name, description, image, location, category, lat, lng, status, email)
  VALUES (
    'Daisy Hill Refill',
    'Daisy Hill Refill is a local refill shop in Little Eaton, Derbyshire, offering a wide range of natural, refillable and low-waste products. From eco cleaning supplies and loose teas to their own-brand dog food and foraged ingredients, everything is chosen with sustainability and community in mind.',
    '/images/suppliers/daisy-hill-refill.jpg',
    'Little Eaton',
    'Refill Shop',
    52.993,
    -1.437,
    'launch_not_live',
    'daisyhill-refill@outlook.com'
  )
  RETURNING id
)
INSERT INTO products (supplier_id, name, description, price, unit, image, category, in_stock, locality, lat, lng, variable_location, status, allergens, tags)
SELECT id, name, description, price, unit, '', category, true, locality, lat, lng, variable_location, 'approved', allergens, tags
FROM daisy_supplier, (VALUES
  ('Daisy Hill Dog Food — Chicken (Loose)', 'Hypoallergenic dog food made with chicken, rice, oats and linseeds. Sold loose by the kg from Daisy Hill Refill.', 3.50, 'per kg', 'Other'::text, 'TBC'::text, NULL::float, NULL::float, true, ARRAY['gluten'], ARRAY[]::text[]),
  ('Daisy Hill Dog Food — Lamb (Loose)', 'Hypoallergenic dog food made with lamb, rice, oats and linseeds. Sold loose by the kg from Daisy Hill Refill.', 3.50, 'per kg', 'Other', 'TBC', NULL, NULL, true, ARRAY['gluten'], ARRAY[]::text[]),
  ('Daisy Hill Dog Food — Salmon (Loose)', 'Hypoallergenic dog food made with salmon, rice, oats and linseeds. Sold loose by the kg from Daisy Hill Refill.', 3.50, 'per kg', 'Other', 'TBC', NULL, NULL, true, ARRAY['gluten', 'fish'], ARRAY[]::text[]),
  ('Daisy Hill Dog Food — Pork (Loose)', 'Hypoallergenic dog food made with pork, rice, oats and linseeds. Sold loose by the kg from Daisy Hill Refill.', 3.50, 'per kg', 'Other', 'TBC', NULL, NULL, true, ARRAY['gluten'], ARRAY[]::text[]),
  ('Dog Kibble — Chicken & Oats (Loose)', 'Hypoallergenic loose kibble with chicken, rice, oats and linseeds. Sold by the kg from Daisy Hill''s refill shop.', 3.50, 'per kg', 'Other', 'TBC', NULL, NULL, true, ARRAY['gluten'], ARRAY[]::text[]),
  ('Dog Kibble — Fussy Friend Beef (Loose)', 'A tasty beef kibble with a molasses coating — popular with fussy dogs. Sold loose by the kg from Daisy Hill.', 2.40, 'per kg', 'Other', 'TBC', NULL, NULL, true, ARRAY['gluten'], ARRAY[]::text[]),
  ('Aethalis Extra Virgin Olive Oil', 'Regeneratively farmed, organically grown extra virgin olive oil from ancient olive groves in Greece. Hand picked to protect the natural environment. Sold on tap as part of a closed-loop refill system.', 2.25, 'per 100g', 'Pantry', 'International', NULL, NULL, true, ARRAY[]::text[], ARRAY['organic', 'vegan']),
  ('Miniml Laundry Refill Bundle — Fresh Linen', '5 litres each of Laundry Liquid and Fabric Conditioner, scented with fresh linen essential oils and made in Yorkshire. Return your empties as part of the closed-loop system.', 39.50, 'per bundle', 'Other', 'Regional', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan']),
  ('Miniml Laundry Refill Bundle — Jasmine & Vanilla', '5 litres each of Laundry Liquid and Fabric Conditioner, scented with jasmine and vanilla essential oils and made in Yorkshire. Return your empties to be washed and reused.', 39.50, 'per bundle', 'Other', 'Regional', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan']),
  ('Miniml Washing Up Liquid — Rhubarb', 'Natural washing up liquid, good for 50 washes, scented with rhubarb essential oil. Made with plant-based ingredients by Miniml.', 3.95, 'per item', 'Other', 'Regional', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan']),
  ('Miniml Anti-Bacterial Spray — Pink Grapefruit', 'Natural anti-bacterial spray scented with pink grapefruit essential oil. Plant-based and made by Miniml in Yorkshire.', 3.95, 'per item', 'Other', 'Regional', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan']),
  ('Ocean Saver Dishwasher Tablets — 100 pack', 'Plastic-free, eco-friendly dishwasher tablets. 100 per pack, effective and kind to the environment.', 24.99, '100 pack', 'Other', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan']),
  ('Miniml Rinse Aid', 'Natural rinse aid with plant-based ingredients by Miniml. 500ml.', 3.95, '500ml', 'Other', 'Regional', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan']),
  ('Daisy Hill Shrub Cordial — Strawberry', 'A unique shrub cordial made with foraged botanicals from Little Eaton and surplus strawberries, with apple cider vinegar for its health benefits. Made by Helen at Daisy Hill.', 7.80, 'per bottle', 'Drinks', 'Own Produce', 52.993, -1.437, false, ARRAY[]::text[], ARRAY['vegan']),
  ('Foraged Wild Garlic Sea Salt with Pink Peppercorns', 'Sea salt with wild garlic foraged from Little Eaton, made in collaboration with Rigby''s Seasonal Foods. Pimped with pink peppercorns — use straight from the grinder.', 8.95, 'per jar', 'Pantry', 'Own Produce', 52.993, -1.437, false, ARRAY[]::text[], ARRAY['vegan']),
  ('Daisy Hill Deluxe Granola — 500g', 'Daisy Hill''s own-recipe granola, packed with oats, wheat, fruits and seeds. Made in-house — hard to beat at breakfast time.', 4.50, '500g bag', 'Pantry', 'Own Produce', 52.993, -1.437, false, ARRAY['gluten', 'nuts'], ARRAY['vegetarian']),
  ('Daisy Hill Deluxe Granola — 1kg', 'Daisy Hill''s own-recipe granola, packed with oats, wheat, fruits and seeds. The larger bag for serious granola lovers.', 9.00, '1kg bag', 'Pantry', 'Own Produce', 52.993, -1.437, false, ARRAY['gluten', 'nuts'], ARRAY['vegetarian']),
  ('Daisy Hill Deluxe Muesli — 500g', 'Luxury muesli made in-house at Daisy Hill, with juicy raisins and plenty of the good stuff. 500g bag.', 3.00, '500g bag', 'Pantry', 'Own Produce', 52.993, -1.437, false, ARRAY['gluten', 'nuts'], ARRAY['vegetarian']),
  ('Daisy Hill Deluxe Muesli — 1kg', 'Luxury muesli made in-house at Daisy Hill, with juicy raisins and plenty of the good stuff. The larger 1kg bag.', 6.00, '1kg bag', 'Pantry', 'Own Produce', 52.993, -1.437, false, ARRAY['gluten', 'nuts'], ARRAY['vegetarian']),
  ('English Breakfast Tea — Loose Leaf', 'A classic English breakfast tea in loose leaf form — makes around 50 cups. One spoon per cup for a beautiful, full-flavoured brew.', 5.75, '100g', 'Drinks', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan']),
  ('Cha Cha Chai — Loose Leaf', 'A black tea with natural chai flavourings — the smell alone is amazing. Makes around 50 cups.', 6.95, '100g', 'Drinks', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan']),
  ('Merry Berry Fruit Tea — Loose Leaf', 'A feel-good red fruity tea with natural hibiscus. Caffeine free, makes around 50 cups.', 6.95, '100g', 'Drinks', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan']),
  ('Earl Grey Tea — Loose Leaf', 'A lovely Earl Grey blend — a Daisy Hill standard for a mid-morning moment of calm. Makes around 50 cups.', 6.95, '100g', 'Drinks', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan']),
  ('Derbyshire Roasted Coffee Beans — Loose', 'A smooth Brazilian coffee, roasted right here in Derbyshire. Sold loose from Daisy Hill.', 8.95, '300g', 'Drinks', 'Local', 52.993, -1.437, false, ARRAY[]::text[], ARRAY['vegan']),
  ('Truthpaste Peppermint Toothpaste', 'Plastic-free, British-made toothpaste from Truthpaste. A natural alternative to conventional toothpaste.', 12.00, 'per tube', 'Other', 'UK', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan'])
) AS p(name, description, price, unit, category, locality, lat, lng, variable_location, allergens, tags);

-- ============================================================================
-- 3. HANDMADE DESIGN (10 products)
-- ============================================================================
WITH handmade_supplier AS (
  INSERT INTO suppliers (name, description, image, location, category, lat, lng, status, email)
  VALUES (
    'Handmade Design',
    'Handmade Design is an independent gift shop in the heart of Ashbourne, curating beautiful artisan-made products from local and regional makers. From handcrafted soaps and natural skincare to chocolates, candles and gifts, everything is thoughtfully chosen to support small producers and bring something a little special to everyday life.',
    '/images/suppliers/handmade-design.jpg',
    'Ashbourne',
    'Gift Shop',
    53.017,
    -1.729,
    'launch_not_live',
    'hello@handmadedesignashbourne.co.uk'
  )
  RETURNING id
)
INSERT INTO products (supplier_id, name, description, price, unit, image, category, in_stock, locality, lat, lng, variable_location, status, allergens, tags)
SELECT id, name, description, price, unit, '', category, true, locality, lat, lng, variable_location, 'approved', allergens, tags
FROM handmade_supplier, (VALUES
  ('Pear & Elderflower Coconut Milk Soap', 'Handmade in Leek using plant-based ingredients and organic coconut milk, rich in Vitamin E. Vegan, palm oil free, never tested on animals. Wrapped in zero-waste paper. Min. 110g.', 8.00, 'per bar', 'Other'::text, 'Local'::text, 53.104::float, -2.022::float, false, ARRAY[]::text[], ARRAY['vegan']),
  ('Geranium & Lemon Goat Milk Soap', 'Handmade in Leek using local raw goat milk, naturally rich in vitamins and minerals. Palm oil free, gentle on skin, never tested on animals. Wrapped in zero-waste paper. Min. 110g.', 8.00, 'per bar', 'Other', 'Local', 53.104, -2.022, false, ARRAY['milk'], ARRAY[]::text[]),
  ('Geranium & Lemon Hand & Body Cream', 'Plant-based hand and body cream made in small batches in Leek, with Vitamin E, Sunflower Oil and organic Hemp Seed Oil. Vegan friendly, gently scented, in a recyclable aluminium tin.', 11.00, '100ml tin', 'Other', 'Local', 53.104, -2.022, false, ARRAY[]::text[], ARRAY['vegan']),
  ('Pear & Elderflower Hand & Body Cream', 'Plant-based hand and body cream made in small batches in Leek, with Vitamin E, Sunflower Oil and organic Hemp Seed Oil. Vegan friendly, gently scented, in a recyclable aluminium tin.', 11.00, '100ml tin', 'Other', 'Local', 53.104, -2.022, false, ARRAY[]::text[], ARRAY['vegan']),
  ('70% Dark Chocolate Bar', 'Rich 70% dark chocolate made bean-to-bar in Sheffield with Ghanaian cacao from the Asante Akim region. Deep, indulgent flavour with notes of walnut and smooth ganache. Free from palm oil and emulsifiers.', 9.00, '70g bar', 'Pantry', 'Regional', 53.388, -1.464, false, ARRAY['nuts'], ARRAY['vegan', 'dairy-free', 'gluten-free']),
  ('Handmade Coconut Soy Wax Melts', '10 handmade wax melts in fresh spring/summer fragrances, made in Giltbrook using natural coconut and soy wax. Biodegradable, sustainably sourced, completely plastic free.', 10.00, 'box of 10', 'Other', 'Regional', 52.975, -1.273, false, ARRAY[]::text[], ARRAY[]::text[]),
  ('Serenity Spa Pressed Flower Candle', 'A beautiful pressed flower candle made from 100% natural soy wax. Clean, long-lasting burn of approximately 25 hours, free from harmful toxins.', 15.50, 'per candle', 'Other', 'Regional', 53.258, -1.911, false, ARRAY[]::text[], ARRAY[]::text[]),
  ('The Orangery Pressed Flower Candle', 'A pressed flower candle made from 100% natural soy wax with an orangery-inspired scent. Clean burn of approximately 25 hours, free from harmful toxins.', 15.50, 'per candle', 'Other', 'Regional', 53.258, -1.911, false, ARRAY[]::text[], ARRAY[]::text[]),
  ('Handmade Soap Gift Set', 'A set of miniature handmade soaps crafted in Derbyshire using traditional methods and natural plant-based ingredients. No SLS, parabens or harsh chemicals. Beautifully packaged.', 12.50, 'per box', 'Other', 'Regional', 53.258, -1.911, false, ARRAY[]::text[], ARRAY[]::text[]),
  ('Dipped Crystallised Ginger', 'Succulent crystallised ginger with a warming kick, hand dipped in rich dark chocolate. Vegan, dairy free and gluten free. A perfectly balanced treat. 100g bag.', 9.00, '100g bag', 'Pantry', 'Regional', 52.842, -1.337, false, ARRAY[]::text[], ARRAY['vegan', 'dairy-free', 'gluten-free'])
) AS p(name, description, price, unit, category, locality, lat, lng, variable_location, allergens, tags);
