-- Peak District Candle Company - Supplier and Products Upload
-- Run this entire script in Supabase SQL Editor (single execution)

WITH new_supplier AS (
  INSERT INTO suppliers (name, description, image, location, category, lat, lng, status, email, instagram)
  VALUES (
    'Peak District Candle Company',
    'Peak District Candle Company is a small-batch, hand-poured candle maker based in Doveridge, Derbyshire. Founded by Anna Jespersen, every candle is crafted using soy wax and premium fragrance oils, with a Summer Collection inspired by the flavours and warmth of an Italian holiday.',
    '',
    'Doveridge',
    'Candle Maker',
    52.907073,
    -1.829979,
    'launch_not_live',
    NULL,
    NULL
  )
  RETURNING id
)
INSERT INTO products (supplier_id, name, description, price, unit, image, category, in_stock, locality, lat, lng, variable_location, status, allergens, tags)
SELECT id, name, description, price, unit, '', category, true, locality, lat, lng, variable_location, 'approved', allergens, tags
FROM new_supplier, (VALUES
  ('Amalfi Sands Candle', 'Escape to the sun-soaked shores of southern Italy with Amalfi Sands, a luminous scented candle inspired by the Amalfi Coast. Opens with zesty bergamot and bright orange, mellowed by fresh coconut and buttery vanilla.', 12.50, 'each', 'Other'::text, 'Own Produce'::text, 52.907073::float, -1.829979::float, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Aperol Spritz Candle', 'Capture the spirit of golden hour with this sparkling candle, a tribute to the iconic Italian aperitivo. Opens with juicy orange, unfolds into sun-soaked grapes, and finishes with a soft whisper of blooming florals.', 12.50, 'each', 'Other', 'Own Produce', 52.907073, -1.829979, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Limoncello Candle', 'Zingy, sweet, and irresistibly refreshing - sunshine in a jar. Inspired by the iconic Italian liqueur, this scent opens with bright lemon and crisp green leaf, softened by sweet sugar and warm musk.', 12.50, 'each', 'Other', 'Own Produce', 52.907073, -1.829979, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Tiramisu Candle', 'Indulge your senses with the rich, decadent aroma of this Tiramisu scented candle, a warm and comforting tribute to the classic Italian dessert. Notes of espresso, mascarpone, and vanilla make this a cosy favourite.', 12.50, 'each', 'Other', 'Own Produce', 52.907073, -1.829979, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Tomato Vine Candle', 'Bring the garden indoors with this fresh, green fragrance that captures the essence of sun-warmed tomatoes on the vine. A unique and uplifting summer scent.', 12.50, 'each', 'Other', 'Own Produce', 52.907073, -1.829979, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Herb Italia Candle', 'Transport yourself to the sun-drenched hillsides of the Italian countryside with Herb Italia, a sophisticated scented candle blending fresh herbs and warm Mediterranean notes.', 12.50, 'each', 'Other', 'Own Produce', 52.907073, -1.829979, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Mediterranean Fig Candle', 'Unwind into the calm of a sunlit coastline with this Mediterranean Fig candle. Inspired by fig trees basking in the sea breeze, it evokes effortless elegance and serene escapism.', 12.50, 'each', 'Other', 'Own Produce', 52.907073, -1.829979, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Pistachio Gelato Candle', 'Indulge in the essence of an Italian summer with this Pistachio Gelato candle. Sweet, nutty, and creamy - like a scoop of gelato on a warm afternoon.', 12.50, 'each', 'Other', 'Own Produce', 52.907073, -1.829979, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Large Citronella Soy Candle', 'Keep the bugs at bay this summer with this zesty Citronella soy candle. Citronella, lemongrass, and sweet vanilla combine for a crisp, fresh fragrance perfect for alfresco dining. Double-wick in a large frosted blue jar.', 24.00, 'each', 'Other', 'Own Produce', 52.907073, -1.829979, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Lemongrass & Lime Large Candle', 'Bring the essence of summer into your garden with this vibrant, uplifting large candle. Opens with a lively burst of citrus and lime, blended with fresh lemongrass for a clean, energising scent.', 20.00, 'each', 'Other', 'Own Produce', 52.907073, -1.829979, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Passion Fruit & Prosecco Candle', 'Indulge in the playful, sparkling charm of this Passionfruit & Prosecco candle. Opens with an effervescent burst of passion fruit, juicy mango, and sweet melon, lifted by crisp bubbly prosecco notes.', 20.00, 'each', 'Other', 'Own Produce', 52.907073, -1.829979, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Amalfi Sands Wax Melt Snap Bar', 'Soak up the scent of a sunlit Italian getaway with this Amalfi Sands soy wax melt snap bar. The same coastal blend of bergamot, orange, coconut, and vanilla as the candle - perfect for wax burners.', 3.50, 'each', 'Other', 'Own Produce', 52.907073, -1.829979, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Limoncello Wax Melt Snap Bar', 'Bring a burst of Italian sunshine into your home with this Limoncello soy wax melt snap bar. Zesty lemon, crisp green leaf, and sweet sugar - perfect for wax burners.', 3.50, 'each', 'Other', 'Own Produce', 52.907073, -1.829979, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Mediterranean Fig Wax Melt Snap Bar', 'Unwind with this Mediterranean Fig soy wax melt snap bar, inspired by fig trees basking in a sea breeze. Effortlessly elegant and perfect for wax burners.', 3.50, 'each', 'Other', 'Own Produce', 52.907073, -1.829979, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Amalfi Sands Room Spray', 'Instantly transform any room with this Amalfi Sands room spray. The same golden coastal fragrance of bergamot, orange, coconut, and vanilla - just a spritz away from a Mediterranean escape.', 12.50, 'each', 'Other', 'Own Produce', 52.907073, -1.829979, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian']),
  ('Mediterranean Fig Room Spray', 'Unwind into the calm of a sunlit coastline with this Mediterranean Fig room spray. Inspired by fig trees in the sea breeze, it brings serene, effortless elegance to any space.', 12.50, 'each', 'Other', 'Own Produce', 52.907073, -1.829979, false, ARRAY[]::text[], ARRAY['vegan', 'vegetarian'])
) AS p(name, description, price, unit, category, locality, lat, lng, variable_location, allergens, tags);
