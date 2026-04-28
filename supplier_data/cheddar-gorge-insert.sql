-- Cheddar Gorge Cheese Company
-- Run this in Supabase SQL Editor

-- INSERT SUPPLIER
INSERT INTO suppliers (name, description, image, location, category, lat, lng, status, email)
VALUES (
  'The Cheddar Gorge',
  'Independent Deli and Artisan Cheesemonger based in Ashbourne, Derbyshire. Specialists in artisan and regional British cheeses, fine crackers, chutneys and deli goods.',
  '',
  '9 Dig Street, Ashbourne, DE6 1GF',
  'Cheese & Deli',
  53.0167,
  -1.7333,
  'launch_live',
  'hello@thecheddargorge.co.uk'
);

-- Get the supplier ID for products
DO $$
DECLARE
  supplier_uuid uuid;
BEGIN
  SELECT id INTO supplier_uuid FROM suppliers WHERE name = 'The Cheddar Gorge' LIMIT 1;

  -- Insert products
  INSERT INTO products (supplier_id, name, description, price, unit, category, locality, lat, lng, allergens, tags, in_stock, status) VALUES
  
  -- CHEESE (Local)
  -- ST13 8EN (Staffordshire Creamery area)
  (supplier_uuid, 'Dovedale Blue', 'Dovedale Blue is a creamy, blue veined white cheese made using traditional and unvarying cheese making methods. The temperature and climate of the area as well as knowledge and skills of cheese-makers ensures the authenticity of this regional, artisan recipe which was retrieved from local archives. Dovedale Blue has achieved PDO status, meaning it can only be produced using milk from the designated areas of Derbyshire, Nottinghamshire and Staffordshire.', 6.30, '200g', 'Cheese', 'Local', 53.0986, -1.9542, ARRAY['milk'], ARRAY['vegetarian', 'gluten-free'], true, 'approved'),
  
  (supplier_uuid, 'Buxton Blue', 'A fantastic blue cheese with a powerful tangy kick. Staffordshire Creamery use annatto to give this cheese its gorgeous rustic glow.', 6.60, '200g', 'Cheese', 'Local', 53.0986, -1.9542, ARRAY['milk'], ARRAY['vegetarian', 'gluten-free'], true, 'approved'),
  
  -- SK17 0AT (Hartington Creamery)
  (supplier_uuid, 'Devonshire Gold', 'A local Peak District cheese exclusively made by Hartington Creamery for The Duke of Devonshire & Chatsworth House. This soft blue brine ripened naturally rinded cheese has an orange colour due to the addition of natural vegetable colouring called annatto.', 6.60, '200g', 'Cheese', 'Local', 53.1294, -1.8083, ARRAY['milk'], ARRAY['vegetarian', 'gluten-free'], true, 'approved'),
  
  (supplier_uuid, 'Hartington Stilton', 'Our local farmhouse stilton, revived by Robert Gosling, it is a creamy, but sharp, yet almost bitter blue cheese.', 5.75, '200g', 'Cheese', 'Local', 53.1294, -1.8083, ARRAY['milk'], ARRAY['vegetarian', 'gluten-free'], true, 'approved'),
  
  (supplier_uuid, 'Peakland White', 'A crumbly, salty cheese made by our friends in Hartington. Described as having similarities to Cheshire, White Stilton, and Feta. Matured for only two weeks, it tastes young, fresh and clean.', 6.20, '200g', 'Cheese', 'Local', 53.1294, -1.8083, ARRAY['milk'], ARRAY['vegetarian', 'gluten-free'], true, 'approved'),
  
  -- ST13 8EN (Staffordshire Creamery area)
  (supplier_uuid, 'Ashbourne Sage Derby', 'A local take on the traditional sage derby.', 7.25, '200g', 'Cheese', 'Local', 53.0986, -1.9542, ARRAY['milk'], ARRAY['vegetarian', 'gluten-free'], true, 'approved'),
  
  (supplier_uuid, 'Derbyshire Dales Chevre Vache', 'A hard pressed blend of cow and goats milk. Firm yet with a creamy texture, depending on the age of the cheese it can be mature and tangy or young and fresh.', 12.40, '200g', 'Cheese', 'Local', 53.0986, -1.9542, ARRAY['milk'], ARRAY['vegetarian', 'gluten-free'], true, 'approved'),

  -- CHEESE (Regional)
  -- NG12 3FN (Colston Bassett)
  (supplier_uuid, 'Colston Bassett Stilton', 'The king of stilton, still handmade, producing an intensely rich and creamy cheese. Colston Bassett''s Stilton is a rich cream colour with even blue veining throughout. The texture is smooth and creamy with a mellow flavour that balances sweet and savoury notes.', 8.80, '200g', 'Cheese', 'Regional', 52.8833, -1.0167, ARRAY['milk'], ARRAY['vegetarian', 'gluten-free'], true, 'approved'),

  -- CHEESE (UK National)
  -- LL21 9RY (Snowdonia, Wales)
  (supplier_uuid, 'Snowdonia Black Bomber', 'An award-winning Extra Mature Cheddar, loved for its immense depth of flavour and smooth creamy texture. The multi-award winning Black Bomber is a modern classic — a delicious rich flavour with a smooth creaminess, lasting long on the palate but remaining demandingly moreish.', 6.60, '200g', 'Cheese', 'UK', 52.9833, -3.4333, ARRAY['milk'], ARRAY['vegetarian', 'gluten-free'], true, 'approved'),
  
  -- IP22 2NS (Suffolk)
  (supplier_uuid, 'Baron Bigod', 'Perhaps the best cheese currently produced in the UK. This award winning farmhouse brie has found favour in both living rooms and Michelin starred restaurants. The strength of flavour depends on the ripeness of the cheese but even when young there is a strong flavour of mushrooms, salt and a hint of truffle.', 9.90, '200g', 'Cheese', 'UK', 52.3667, 1.0167, ARRAY['milk'], ARRAY['vegetarian', 'gluten-free'], true, 'approved'),
  
  -- TR13 0RH (Cornwall)
  (supplier_uuid, 'Cornish Yarg', 'A traditional nettle-wrapped Yarg, with a semi-hard texture. Creamy under its natural rind and slightly crumbly in the core. The hand-picked nettle leaves are carefully brushed onto the cheese in a traditional pattern of concentric circles, attracting naturally occurring moulds which give Yarg its lacy good looks.', 8.15, '200g', 'Cheese', 'UK', 50.1000, -5.2667, ARRAY['milk'], ARRAY['vegetarian', 'gluten-free'], true, 'approved'),
  
  -- PA75 6QD (Isle of Mull, Scotland)
  (supplier_uuid, 'Isle of Mull Cheddar', 'A hard cheddar with a fruity yet sharp flavour. Naturally produced using unpasteurised milk at Sgriob-Ruadh Farm Dairy, Tobermory in the Scottish Inner Hebrides. Cloth-wrapped and matured in the cellar for six months, it has a powerful, complex, lingering flavour.', 8.80, '200g', 'Cheese', 'UK', 56.6167, -6.0667, ARRAY['milk'], ARRAY['vegetarian', 'gluten-free'], true, 'approved'),
  
  -- DL8 4BS (Wensleydale, Yorkshire)
  (supplier_uuid, 'Wensleydale and Cranberry', 'Traditional Wensleydale is a mild crumbly cheese with a yogurty aftertaste. With plenty of cranberries mixed in during the production process, this cheese takes on a very sweet taste.', 5.75, '200g', 'Cheese', 'UK', 54.3000, -1.9333, ARRAY['milk'], ARRAY['vegetarian', 'gluten-free'], true, 'approved'),
  
  -- BD23 6EN (Yorkshire)
  (supplier_uuid, 'Rindless Goat Log', 'A semi-soft, slightly crumbly, creamy classic goats cheese, perfect for salads. A cylindrical log of soft pasteurised goats cheese with a distinctive flavour.', 5.50, '200g', 'Cheese', 'UK', 54.0667, -2.0167, ARRAY['milk'], ARRAY['vegetarian', 'gluten-free'], true, 'approved'),

  -- CHEESE (International - Germany, no UK postcode)
  (supplier_uuid, 'Montagnolo', 'A deliciously soft, creamy blue cheese, a cross between a Brie and a Roquefort. Montagnolo Affine is a blue, triple crème soft cheese made in the Allgäu region of Germany. Surface ripened with a natural grey crust and marbled with blue veins, ageing at a low temperature allows it to develop its aromatic and spicy flavour.', 6.20, '200g', 'Cheese', 'International', NULL, NULL, ARRAY['milk'], ARRAY['vegetarian', 'gluten-free'], true, 'approved'),

  -- PANTRY (Local - DE6 1DP Ashbourne area)
  (supplier_uuid, 'Miller''s Crackers - Three Fruit', 'Made with stone ground wholemeal flour, apples, sultanas and dates. Fruity and crunchy — a perfect partner for soft and blue cheeses.', 5.05, 'Box', 'Pantry', 'Local', 53.0167, -1.7333, ARRAY['gluten'], ARRAY['vegetarian', 'vegan'], true, 'approved'),
  
  (supplier_uuid, 'Miller''s Crackers - Three Nut', 'Made with stone ground wholemeal flour, walnuts, almonds and hazelnuts. Warm and mellow.', 5.05, 'Box', 'Pantry', 'Local', 53.0167, -1.7333, ARRAY['gluten', 'nuts'], ARRAY['vegetarian'], true, 'approved'),
  
  (supplier_uuid, 'Miller''s Crackers - Buttermilk', 'Tangy and creamy wafers. Hexagonal wafers made with buttermilk and butter churned in England.', 4.40, 'Box', 'Pantry', 'Local', 53.0167, -1.7333, ARRAY['gluten', 'milk'], ARRAY['vegetarian'], true, 'approved'),
  
  (supplier_uuid, 'Miller''s Crackers - Earth', 'Beetroot, Potato and Spinach Crackers for cheese, pâtés and dips. Crunchy and tasty with a touch of natural sweetness from the beetroot.', 4.40, 'Box', 'Pantry', 'Local', 53.0167, -1.7333, ARRAY['gluten'], ARRAY['vegetarian', 'vegan'], true, 'approved'),
  
  (supplier_uuid, 'Miller''s Crackers - Charcoal', 'Dark and crisp wafers. Hexagonal wafers made with stone-ground flour, grown and milled in England.', 4.65, 'Box', 'Pantry', 'Local', 53.0167, -1.7333, ARRAY['gluten'], ARRAY['vegetarian', 'vegan'], true, 'approved'),
  
  (supplier_uuid, 'Fine Cheese Co. Sourdough - Cornmeal', 'Deeply flavourful, with natural sour notes. Perfect with hard cheeses such as Comté.', 4.35, 'Box', 'Pantry', 'Local', 53.0167, -1.7333, ARRAY['gluten'], ARRAY['vegetarian', 'vegan'], true, 'approved'),
  
  (supplier_uuid, 'Fine Cheese Co. Sourdough - Rye', 'Deeply flavourful, with natural sour notes. Perfect with blue cheeses such as Colston Bassett Stilton.', 4.35, 'Box', 'Pantry', 'Local', 53.0167, -1.7333, ARRAY['gluten'], ARRAY['vegetarian', 'vegan'], true, 'approved'),
  
  (supplier_uuid, 'Fine Cheese Co. Sourdough - Spelt', 'Deeply flavourful, with natural sour notes. Perfect with soft cheeses such as Baron Bigod.', 4.35, 'Box', 'Pantry', 'Local', 53.0167, -1.7333, ARRAY['gluten'], ARRAY['vegetarian', 'vegan'], true, 'approved'),

  -- PANTRY (Refill items - variable location)
  (supplier_uuid, 'Refill - Porridge Oats', 'Loose porridge oats, sold by weight from our refill station.', 0.30, '100g', 'Pantry', 'UK', NULL, NULL, ARRAY['gluten'], ARRAY['vegetarian', 'vegan'], true, 'approved'),
  
  (supplier_uuid, 'Refill - Wild Rice', 'Loose wild rice, sold by weight from our refill station.', 0.55, '100g', 'Pantry', 'UK', NULL, NULL, ARRAY[]::text[], ARRAY['vegetarian', 'vegan', 'gluten-free'], true, 'approved'),
  
  (supplier_uuid, 'Refill - Quinoa', 'Loose quinoa, sold by weight from our refill station.', 0.60, '100g', 'Pantry', 'UK', NULL, NULL, ARRAY[]::text[], ARRAY['vegetarian', 'vegan', 'gluten-free'], true, 'approved'),
  
  (supplier_uuid, 'Refill - Red Split Lentils', 'Loose red split lentils, sold by weight from our refill station.', 0.40, '100g', 'Pantry', 'UK', NULL, NULL, ARRAY[]::text[], ARRAY['vegetarian', 'vegan', 'gluten-free'], true, 'approved'),
  
  (supplier_uuid, 'Refill - Green Lentils', 'Loose green lentils, sold by weight from our refill station.', 0.55, '100g', 'Pantry', 'UK', NULL, NULL, ARRAY[]::text[], ARRAY['vegetarian', 'vegan', 'gluten-free'], true, 'approved'),
  
  (supplier_uuid, 'Refill - Muesli', 'Loose muesli, sold by weight from our refill station.', 0.45, '100g', 'Pantry', 'UK', NULL, NULL, ARRAY['gluten'], ARRAY['vegetarian', 'vegan'], true, 'approved'),

  -- PRESERVES & CONDIMENTS (UK National)
  -- SN16 0RP (Tracklements, Wiltshire)
  (supplier_uuid, 'Tracklements Fig Relish', 'Made by soaking plump figs in spiced vinegar before gently cooking them with rich, dark sugar. The result is at once tangy and sweet — superb with soft cheeses and wonderful in a cheese toastie.', 4.95, 'Jar', 'Preserves & Condiments', 'UK', 51.5833, -2.0833, ARRAY['sulphites'], ARRAY['vegetarian', 'vegan'], true, 'approved'),
  
  (supplier_uuid, 'Tracklements Chilli Jam', 'A multi award-winner, this addictive sticky-sweet chilli jam smoulders with a gentle heat from fistfuls of fresh red chillies. Incredibly versatile with fish, meats, sandwiches and creamy cheeses.', 4.85, 'Jar', 'Preserves & Condiments', 'UK', 51.5833, -2.0833, ARRAY['sulphites'], ARRAY['vegetarian', 'vegan'], true, 'approved'),
  
  (supplier_uuid, 'Tracklements Caramelised Onion Marmalade', 'The UK''s first onion marmalade, made with a splash of red currant juice for a pleasing tang. Excellent with pâtés, terrines and cheeses, and incomparable when melted over sausages.', 5.55, 'Jar', 'Preserves & Condiments', 'UK', 51.5833, -2.0833, ARRAY['sulphites'], ARRAY['vegetarian', 'vegan'], true, 'approved'),
  
  (supplier_uuid, 'Tracklements British Piccalilli', 'The traditional British condiment for Cheddar, cold meats and especially crusty pork pies. This version packs a punch of sharpness and crunch, just as it should.', 4.85, 'Jar', 'Preserves & Condiments', 'UK', 51.5833, -2.0833, ARRAY['gluten', 'mustard', 'sulphites'], ARRAY['vegetarian', 'vegan'], true, 'approved'),
  
  -- CW10 9JS (Mrs Darlington's, Cheshire)
  (supplier_uuid, 'Mrs Darlington''s Beetroot Chutney', 'So versatile — fab in sandwiches, with cheese or shepherd''s pie.', 4.95, 'Jar', 'Preserves & Condiments', 'UK', 53.1833, -2.4333, ARRAY['sulphites'], ARRAY['vegetarian', 'vegan'], true, 'approved'),
  
  (supplier_uuid, 'Mrs Darlington''s Lemon Curd', 'A classic lemon curd packed full of zingy flavour. Add a generous helping to toast, or use in baking for tarts and cakes.', 5.55, 'Jar', 'Preserves & Condiments', 'UK', 53.1833, -2.4333, ARRAY['eggs', 'milk'], ARRAY['vegetarian'], true, 'approved'),

  -- HAMPERS & GIFTS (sold from shop, use shop location)
  (supplier_uuid, 'The Cheese Night in for Two', 'A perfectly selected spread of cheeses and chutney for two. Contains 180g Dovedale Blue, 180g Cricket St Thomas Brie, 200g Black Bomber, one jar of Tracklements Caramelised Onion Marmalade and one packet of Peter''s Yard Original Sourdough Crispbread.', 26.40, 'Hamper', 'Other', 'UK', 53.0167, -1.7333, ARRAY['milk', 'gluten'], ARRAY['vegetarian'], true, 'approved'),
  
  (supplier_uuid, 'Best of British Cheese Box', 'Celebrating some of our favourite British cheese makers from across the country. Contains 150g Cornish Yarg, 150g Colston Bassett Stilton, 150g Rutland Red, 150g Isle of Mull, 150g Baron Bigod, 200g Black Bomber, one jar of Tracklements British Piccalilli, one packet of Miller''s Three Fruit crackers and one packet of Miller''s Plum & Date Toast.', 47.30, 'Hamper', 'Other', 'UK', 53.0167, -1.7333, ARRAY['milk', 'gluten', 'sulphites'], ARRAY['vegetarian'], true, 'approved');

END $$;

-- Verify
SELECT name, category, price, unit, locality FROM products 
WHERE supplier_id = (SELECT id FROM suppliers WHERE name = 'The Cheddar Gorge')
ORDER BY category, name;
