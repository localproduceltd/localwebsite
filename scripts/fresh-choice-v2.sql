-- Fresh Choice of Ashbourne - Supplier and Products Upload
-- Run this entire script in Supabase SQL Editor (single execution)
-- NOTE: Beetroot Bunch has £0.00 price - update after confirming correct price

WITH new_supplier AS (
  INSERT INTO suppliers (name, description, image, location, category, lat, lng, status, email, instagram)
  VALUES (
    'Fresh Choice',
    'Fresh Choice is a well-loved independent greengrocer on St John Street in Ashbourne, Derbyshire. They stock a wide range of fresh fruit, vegetables, salad and herbs, supplying the local community with quality seasonal produce.',
    '',
    'Ashbourne',
    'Greengrocer',
    53.0167,
    -1.7333,
    'launch_not_live',
    'freshchoiceashbourne@hotmail.com',
    'fresh_choice_ashbourne'
  )
  RETURNING id
)
INSERT INTO products (supplier_id, name, description, price, unit, image, category, in_stock, locality, lat, lng, variable_location, status, allergens, tags)
SELECT id, name, description, price, unit, '', category, true, locality, lat, lng, variable_location, 'approved', allergens, tags
FROM new_supplier, (VALUES
  ('Beetroot', 'Fresh, earthy beetroot - perfect for roasting, pickling or grating raw into salads.', 1.99, 'per 4', 'Vegetables'::text, 'TBC'::text, NULL::float, NULL::float, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Asparagus', 'Tender asparagus spears with a delicate, grassy flavour. Delicious griddled, roasted or steamed with butter.', 6.60, 'per bunch', 'Vegetables', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Beetroot Bunch', 'A bunch of fresh beetroot with leafy tops still attached. The leaves are edible too.', 0.00, 'per bunch', 'Vegetables', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Carrot Bunch', 'A bunch of fresh carrots with their leafy green tops. Sweet, crunchy and full of flavour.', 2.00, 'per bunch', 'Vegetables', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Flat Mushroom', 'Large, meaty flat mushrooms perfect for stuffing, grilling or frying. Sold loose by weight.', 0.55, 'per 100g', 'Vegetables', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Pin Cup Mushroom', 'Small, delicate cup mushrooms with a mild flavour. Great sliced into salads or cooked into sauces.', 0.40, 'per 100g', 'Vegetables', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Prepack Beetroot', 'Convenient prepacked beetroot, ready to use. Perfect for quick salads or roasting.', 1.20, 'per pack', 'Vegetables', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Garlic', 'A whole bulb of fresh garlic - an essential kitchen staple for adding depth and flavour.', 0.45, 'each', 'Vegetables', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Turmeric', 'Fresh turmeric root with a warm, earthy flavour and vibrant golden colour.', 1.40, 'per 100g', 'Vegetables', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Ginger', 'Fresh root ginger with a warm, spicy kick. Essential for stir-fries, curries and baking.', 0.80, 'per 100g', 'Vegetables', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Red Chilli', 'Fresh red chillies with a fiery kick. Add heat to curries, stir-fries and sauces.', 1.40, 'per 100g', 'Vegetables', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Green Chilli', 'Fresh green chillies with a sharp, vibrant heat. Perfect for Asian and Mexican dishes.', 1.40, 'per 100g', 'Vegetables', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Sugarsnap Peas', 'Sweet, crunchy sugarsnap peas - delicious raw as a snack or lightly stir-fried.', 1.70, 'per 100g', 'Vegetables', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Fine Beans', 'Slender, tender fine beans with a delicate flavour. Quick to cook.', 1.70, 'per 100g', 'Vegetables', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Babycorn', 'Tender baby sweetcorn with a mild, slightly sweet flavour. Great in stir-fries.', 2.20, 'per 100g', 'Vegetables', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Fennel', 'Fresh fennel bulbs with a subtle aniseed flavour. Delicious raw in salads or roasted.', 6.00, 'per kg', 'Vegetables', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Chicory', 'Crisp, slightly bitter chicory leaves. Lovely in salads, grilled or braised.', 6.00, 'per kg', 'Vegetables', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Peppers Red/Green/Yellow', 'Fresh bell peppers in red, green or yellow. Sweet, crunchy and versatile.', 7.00, 'per kg', 'Vegetables', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Vine Tomato', 'Ripe tomatoes still on the vine, bursting with flavour. Perfect for salads or sauces.', 4.80, 'per kg', 'Vegetables', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Rocket', 'Peppery rocket leaves with a bold, slightly nutty flavour. A classic salad leaf.', 2.20, 'per 100g', 'Salad & Herbs', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Celery', 'Fresh celery sticks with a crisp, refreshing crunch. Great for snacking or soups.', 1.35, 'per pack', 'Salad & Herbs', 'TBC', NULL, NULL, true, ARRAY['celery'], ARRAY['vegan', 'vegetarian']),
  ('Cucumber', 'A fresh, crunchy cucumber - cool and refreshing. Perfect sliced in salads.', 1.65, 'each', 'Salad & Herbs', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Spring Onion', 'A bunch of fresh spring onions with a mild, oniony bite.', 0.85, 'per pack', 'Salad & Herbs', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Peashoots', 'Delicate pea shoots with a fresh, sweet pea flavour. A lovely garnish.', 2.75, 'per pack', 'Salad & Herbs', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Mixed Leaf', 'A mix of fresh salad leaves for a quick, easy salad base. Washed and ready to eat.', 1.90, 'per pack', 'Salad & Herbs', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Cress', 'Classic cress with a peppery bite. A nostalgic favourite for egg sandwiches.', 0.35, 'per pack', 'Salad & Herbs', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Prepack Radish', 'Crunchy, peppery radishes in a convenient pack. Great sliced into salads.', 0.95, 'per pack', 'Salad & Herbs', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Cos Lettuce', 'Crisp cos lettuce with sturdy leaves - the classic choice for Caesar salads.', 2.20, 'per pack', 'Salad & Herbs', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Watercress', 'Peppery watercress with a fresh, slightly spicy flavour. Lovely in salads or soups.', 2.00, 'per pack', 'Salad & Herbs', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Little Gem Lettuce', 'Sweet, crunchy little gem lettuces - compact and perfect for salads.', 1.65, 'per pack', 'Salad & Herbs', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Iceberg Lettuce', 'A classic iceberg lettuce with crisp, watery leaves. Perfect in sandwiches.', 1.65, 'per pack', 'Salad & Herbs', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Spinach', 'Tender baby spinach leaves, ready to eat raw or wilt into curries and pasta.', 2.00, 'per pack', 'Salad & Herbs', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Cherry Vine Tomato', 'Sweet, bite-sized cherry tomatoes still on the vine. Burst with flavour.', 7.15, 'per kg', 'Vegetables', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Green Avocado', 'A firm, green-skinned avocado that will ripen at home in a couple of days.', 1.35, 'each', 'Fruit', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Ready to Eat Avocado', 'A perfectly ripe avocado, ready to eat today. Ideal for toast or guacamole.', 1.65, 'each', 'Fruit', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Conference Pear', 'Classic conference pears with a sweet, juicy flesh and light floral flavour.', 3.60, 'per kg', 'Fruit', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Red Grape', 'Sweet, juicy red grapes perfect for snacking or adding to cheese boards.', 7.20, 'per kg', 'Fruit', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Green Grape', 'Crisp, refreshing green grapes with a light, slightly tart flavour.', 7.20, 'per kg', 'Fruit', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Plum', 'Sweet, ripe plums with a deep flavour. Eat fresh or bake into a crumble.', 7.00, 'per kg', 'Fruit', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Pink Lady Apple', 'The iconic Pink Lady apple - a perfect balance of sweetness and tartness.', 4.00, 'per kg', 'Fruit', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Red Delicious Apple', 'Classic Red Delicious apples with a mild, sweet flavour and deep red skin.', 3.00, 'per kg', 'Fruit', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Royal Gala Apple', 'Sweet, crisp Royal Gala apples with a lovely honey-like flavour.', 3.00, 'per kg', 'Fruit', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Granny Smith Apple', 'Bright green Granny Smith apples with a sharp, refreshing tartness.', 3.00, 'per kg', 'Fruit', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Braeburn Apple', 'Braeburn apples with a well-balanced sweet-tart flavour and firm, juicy flesh.', 3.00, 'per kg', 'Fruit', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Bramley Apple', 'The classic British cooking apple. Fluffy and tart when cooked.', 4.50, 'per kg', 'Fruit', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Dates', 'Soft, naturally sweet dates sold loose by weight. Rich and caramel-like.', 1.40, 'per 100g', 'Fruit', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Dates 200g', 'A convenient 200g pack of soft, sweet dates. A natural energy snack.', 0.99, 'per 200g pack', 'Fruit', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Dates 500g', 'A generous 500g pack of rich, sweet dates. Perfect for stocking up.', 5.50, 'per 500g pack', 'Fruit', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Banana', 'Fresh bananas - sweet, filling and versatile. Perfect as a snack or in smoothies.', 1.99, 'per kg', 'Fruit', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Lemon', 'A bright, zingy lemon - an essential kitchen staple for cooking and baking.', 0.55, 'each', 'Fruit', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Lime', 'Fresh, juicy limes with an intense citrus flavour. Perfect for Thai cooking.', 0.40, 'each', 'Fruit', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Kiwi', 'Tangy, vibrant green kiwi fruit packed with vitamin C.', 0.55, 'each', 'Fruit', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Satsuma', 'Easy-peel satsumas with a sweet, refreshing flavour. The perfect no-mess snack.', 4.80, 'per kg', 'Fruit', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Large Orange', 'A large, juicy orange with a bright, sweet flavour. Great for fresh juice.', 0.75, 'each', 'Fruit', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Medium Orange', 'A sweet, juicy medium orange - a classic snack packed with vitamin C.', 0.45, 'each', 'Fruit', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Herbs - Basil', 'Fresh basil with a sweet, aromatic flavour. Essential for Italian cooking.', 2.20, 'per pack', 'Salad & Herbs', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Herbs - Rosemary', 'Fragrant rosemary sprigs with a woody, pine-like aroma. Perfect for roasts.', 2.20, 'per pack', 'Salad & Herbs', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Herbs - Sage', 'Earthy, aromatic sage leaves. A classic pairing with pork and butter sauces.', 2.20, 'per pack', 'Salad & Herbs', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Herbs - Tarragon', 'Delicate tarragon with a subtle anise flavour. Lovely in French cooking.', 2.20, 'per pack', 'Salad & Herbs', 'TBC', NULL, NULL, true, ARRAY[]::text[], ARRAY['vegan', 'vegetarian'])
) AS p(name, description, price, unit, category, locality, lat, lng, variable_location, allergens, tags);
