-- Luke Evans Bakery Ltd
-- Run this in Supabase SQL Editor

-- Insert supplier
INSERT INTO suppliers (name, description, image, location, category, lat, lng, status, email)
VALUES (
  'Luke Evans Bakery',
  'Generations of local Derbyshire bakers, one shared passion ~ bringing freshly baked scrumptiousness to family tables since 1804.',
  '',
  'Greenhill Lane, Riddings, Derbyshire, DE55 4AS',
  'Bakery',
  53.0456,
  -1.3892,
  'launch_live',
  'h.yates@lukeevans.co.uk'
);

-- Get the supplier ID for products
DO $$
DECLARE
  supplier_uuid uuid;
BEGIN
  SELECT id INTO supplier_uuid FROM suppliers WHERE name = 'Luke Evans Bakery' LIMIT 1;

  -- Insert products (lat/lng = 53.0456, -1.3892 for Riddings, Derbyshire)
  INSERT INTO products (supplier_id, name, description, price, unit, category, locality, lat, lng, allergens, tags, in_stock, status) VALUES
  
  -- BREAD
  (supplier_uuid, 'White Baps', 'Our white baps are proof that simple things done properly never go out of style. Fluffy and golden, they''re crafted with the same slow, careful methods we''ve always used – a versatile everyday roll that feels right at home at breakfast, lunch or supper.', 1.42, 'pack of 4', 'Bread', 'Own Produce', 53.0456, -1.3892, ARRAY['gluten'], ARRAY[]::text[], true, 'approved'),
  
  (supplier_uuid, 'White Tennis Rolls', 'There''s a reason these soft, golden rolls have graced Derbyshire tea tables for generations. Our Tennis Rolls are baked slowly to achieve their tender crumb, made with simple ingredients and an instinctive feel for the dough passed down through our family since 1804. Spread with butter, topped with jam or filled with something savoury they taste like home.', 1.68, 'pack of 6', 'Bread', 'Own Produce', 53.0456, -1.3892, ARRAY['gluten'], ARRAY[]::text[], true, 'approved'),
  
  (supplier_uuid, 'Cheesy Farmhouse Ovals', 'A nostalgic favourite, our cheesy oval is a soft roll topped with cheese. It''s a simple bake that adds a little bit extra for dipping in soup or even warming up.', 1.79, 'pack of 2', 'Bread', 'Own Produce', 53.0456, -1.3892, ARRAY['gluten', 'milk'], ARRAY[]::text[], true, 'approved'),
  
  (supplier_uuid, 'Wholemeal Baps', 'Soft and slightly nutty, our wholemeal baps bring a touch of heritage and health to the table. Baked with the same care as all our bread, they''re a perfect match for savoury fillings or a pat of butter.', 1.73, 'pack of 4', 'Bread', 'Own Produce', 53.0456, -1.3892, ARRAY['gluten'], ARRAY[]::text[], true, 'approved'),
  
  (supplier_uuid, 'Wholemeal Tennis Rolls', 'Nutty, wholesome and full of flavour, our wholemeal tennis rolls are baked with stoneground flour for a soft yet substantial bite. They carry with them a sense of tradition and goodness – proof that simple food can be deeply satisfying.', 2.05, 'pack of 6', 'Bread', 'Own Produce', 53.0456, -1.3892, ARRAY['gluten'], ARRAY[]::text[], true, 'approved'),
  
  (supplier_uuid, 'Country Grain Rolls', 'Nutty, seedy and wholesome, these country grain baps are a baker''s nod to Derbyshire''s farming heritage. Best enjoyed with local cheese or a ploughman''s lunch.', 1.80, 'pack of 4', 'Bread', 'Own Produce', 53.0456, -1.3892, ARRAY['gluten', 'sesame'], ARRAY[]::text[], true, 'approved'),
  
  (supplier_uuid, 'Sliced White Bobby''s Foot', 'The distinctive shape and heritage of our Bobby''s Foot loaf, prepared in a convenient sliced version. Soft, light and full of the character that has made it a local favourite for generations, it''s ready for everything from quick breakfasts to packed lunches. Tradition meets practicality in every slice.', 1.84, '400g loaf', 'Bread', 'Own Produce', 53.0456, -1.3892, ARRAY['gluten'], ARRAY[]::text[], true, 'approved'),
  
  (supplier_uuid, 'Sliced Wholemeal Bobby''s Foot', 'The character of our traditional Bobby''s Foot loaf, reimagined in wholemeal and prepared in ready-sliced form. With its distinctive shape and wholesome, nutty flavour, it combines the history of Derbyshire baking with the ease of modern life. A local favourite, full of heritage and heart.', 2.10, '400g loaf', 'Bread', 'Own Produce', 53.0456, -1.3892, ARRAY['gluten'], ARRAY[]::text[], true, 'approved'),
  
  (supplier_uuid, 'Low GI Seeded Farmhouse Sliced', 'A hearty, rustic farmhouse loaf packed with wholesome wholegrains and crunchy seeds, offering a rich, nutty flavour and satisfying texture. Naturally low GI, it''s slow-releasing and nourishing—perfect for keeping you fuller for longer.', 2.84, '400g loaf', 'Bread', 'Own Produce', 53.0456, -1.3892, ARRAY['gluten', 'sesame'], ARRAY[]::text[], true, 'approved'),
  
  (supplier_uuid, 'Donker Rye (Uncut)', 'Deep in colour and rich in flavour, our Donker Malted Rye Bread is crafted with rye flour and malted grains for a robust, earthy character. Slowly baked to develop its distinctive taste and satisfying texture, it''s the kind of bread that pairs beautifully with strong cheeses, cured meats or simply a spread of butter.', 2.57, '400g loaf', 'Bread', 'Own Produce', 53.0456, -1.3892, ARRAY['gluten'], ARRAY[]::text[], true, 'approved'),
  
  (supplier_uuid, 'Donker Rye (Sliced)', 'Deep in colour and rich in flavour, our Donker Malted Rye is a loaf with real character. Slowly baked to bring out its malty, earthy notes, it''s robust, satisfying and perfectly balanced. Pre-sliced for ease, it''s the kind of bread that pairs beautifully with strong cheeses, smoked fish or a simple spread of butter.', 2.78, '400g loaf', 'Bread', 'Own Produce', 53.0456, -1.3892, ARRAY['gluten'], ARRAY[]::text[], true, 'approved'),
  
  (supplier_uuid, 'White Farmhouse Ovals', 'These oval rolls take their cue from the farmhouse loaves we''ve baked for generations. With their soft, tender crumb and light crust, they''re a versatile choice, perfect for soups, cheese boards and ploughman''s lunches.', 1.84, '', 'Bread', 'Own Produce', 53.0456, -1.3892, ARRAY['gluten'], ARRAY[]::text[], true, 'approved'),
  
  (supplier_uuid, 'White Sliced Farmhouse', '', 1.84, '400g loaf', 'Bread', 'Own Produce', 53.0456, -1.3892, ARRAY['gluten'], ARRAY[]::text[], true, 'approved'),

  -- PASTRIES & CAKES
  (supplier_uuid, 'Sausage Roll', 'Our Jumbo Sausage Roll is everything a savoury treat should be — hearty, generous and full of flavour. Golden layers of flaky pastry enclose seasoned sausage meat, baked with the same care and patience as all our craft. Whether eaten warm or cold, it''s a true Derbyshire staple — simple food, done properly.', 1.65, 'each', 'Pastries & Cakes', 'Own Produce', 53.0456, -1.3892, ARRAY['gluten', 'milk', 'eggs', 'sulphites'], ARRAY[]::text[], true, 'approved'),
  
  (supplier_uuid, 'Cheese Straws', 'Our Cheese Straws are baked to a golden crisp, twisting mature cheese into buttery pastry for a satisfying savoury snack. Perfect with a cup of tea or as a nibble on the go, they carry the same care and craft that has defined our baking for over two centuries. Simple ingredients, baked to perfection.', 2.70, 'pack of 2', 'Pastries & Cakes', 'Own Produce', 53.0456, -1.3892, ARRAY['gluten', 'milk', 'eggs'], ARRAY[]::text[], true, 'approved'),
  
  (supplier_uuid, 'Mini Victoria Sandwiches', 'A timeless classic in miniature form. Our mini Victoria sandwiches pair light sponge with sweet jam and soft cream, creating a little cake that carries all the charm of afternoon tea. Each twin pack brings you a taste of tradition in a perfectly sized portion.', 3.60, 'pack of 2', 'Pastries & Cakes', 'Own Produce', 53.0456, -1.3892, ARRAY['gluten', 'milk', 'eggs'], ARRAY[]::text[], true, 'approved'),
  
  (supplier_uuid, 'Mini Chocolate Sandwiches', 'Our mini chocolate sandwich cakes are made with moist chocolate sponge and layered with smooth chocolate cream. Baked with care and rich in flavour, they are a little indulgence that feels both familiar and special.', 3.60, 'pack of 2', 'Pastries & Cakes', 'Own Produce', 53.0456, -1.3892, ARRAY['gluten', 'milk', 'eggs', 'soya'], ARRAY[]::text[], true, 'approved'),
  
  (supplier_uuid, 'Chocolate Flapjack', 'Golden oats meet rich chocolate in our Small Chocolate Flapjack. Baked slowly to a chewy finish and topped with a layer of chocolate, it''s a sweet, satisfying treat that honours traditional baking methods.', 2.80, 'pack of 2', 'Pastries & Cakes', 'Own Produce', 53.0456, -1.3892, ARRAY['gluten', 'milk', 'soya'], ARRAY[]::text[], true, 'approved'),
  
  (supplier_uuid, 'Rocky Road', 'Our Rocky Road is a decadent mix of chocolate, marshmallows and biscuit pieces, baked to create a chewy, indulgent treat. Each slice is full of texture and flavour — perfect for sharing or enjoying as a little moment of indulgence.', 2.80, 'pack of 2', 'Pastries & Cakes', 'Own Produce', 53.0456, -1.3892, ARRAY['gluten', 'milk', 'soya'], ARRAY[]::text[], true, 'approved'),
  
  (supplier_uuid, 'Cornflake Slice', 'Crunchy cornflakes bound with golden syrup and chocolate make this slice a nostalgic favourite. Simple ingredients, baked carefully to create a satisfying combination of crisp and sweet in every bite.', 2.65, 'pack of 2', 'Pastries & Cakes', 'Own Produce', 53.0456, -1.3892, ARRAY['gluten', 'milk', 'soya'], ARRAY[]::text[], true, 'approved'),
  
  (supplier_uuid, 'Large Iced Bakewell', 'This Iced Bakewell begins with a crisp pastry base and a layer of jam, topped with soft frangipane sponge and finished with sweet icing. A simple yet indulgent treat that has stood the test of time.', 4.35, '6" each', 'Pastries & Cakes', 'Own Produce', 53.0456, -1.3892, ARRAY['gluten', 'milk', 'eggs', 'nuts'], ARRAY[]::text[], true, 'approved'),
  
  (supplier_uuid, 'Large Egg Custard', 'Our Large Egg Custard is a true bakery classic: smooth, creamy custard baked gently in crisp pastry and finished with a dusting of nutmeg. It''s a dessert rooted in tradition, offering simple comfort and timeless flavour in every slice.', 3.20, 'each', 'Pastries & Cakes', 'Own Produce', 53.0456, -1.3892, ARRAY['gluten', 'milk', 'eggs'], ARRAY[]::text[], true, 'approved'),

  -- OTHER
  (supplier_uuid, 'Derbyshire Oatcakes', 'A true taste of our county''s heritage. These soft, pancake-like oatcakes are made to a time-honoured recipe and loved for their versatility. Roll them with cheese and bacon, or enjoy simply with butter.', 2.52, 'pack of 4', 'Other', 'Own Produce', 53.0456, -1.3892, ARRAY['gluten', 'milk'], ARRAY[]::text[], true, 'approved');

END $$;

-- Verify
SELECT name, category, price, unit FROM products 
WHERE supplier_id = (SELECT id FROM suppliers WHERE name = 'Luke Evans Bakery')
ORDER BY category, name;
