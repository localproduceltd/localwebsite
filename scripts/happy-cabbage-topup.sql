-- Happy Cabbage Market Stall - New Products (May 2026)
-- Run this in Supabase SQL Editor

INSERT INTO products (supplier_id, name, description, price, unit, image, category, in_stock, locality, lat, lng, variable_location, status, allergens, tags)
SELECT 
  s.id,
  p.name,
  p.description,
  p.price,
  p.unit,
  '',
  p.category,
  true,
  p.locality,
  p.lat,
  p.lng,
  p.variable_location,
  'approved',
  p.allergens,
  p.tags
FROM suppliers s
CROSS JOIN (VALUES
  (
    'Florida Pineapple',
    'Large sweet, tender, juicy pineapple from Florida. Perfect for fresh eating or tropical recipes.',
    2.50,
    'each',
    'Fruit'::text,
    'International'::text,
    27.9944::float,  -- Florida lat
    -81.7603::float, -- Florida lng
    false,
    ARRAY[]::text[],
    ARRAY['vegan', 'vegetarian', 'gluten-free', 'dairy-free']::text[]
  ),
  (
    'Yellow Courgette',
    'Large yellow courgette from the Netherlands. Sweeter than green courgette with a mild, buttery flavour.',
    1.00,
    'each',
    'Vegetables'::text,
    'International'::text,
    52.1326::float,  -- Netherlands lat
    5.2913::float,   -- Netherlands lng
    false,
    ARRAY[]::text[],
    ARRAY['vegan', 'vegetarian', 'gluten-free', 'dairy-free']::text[]
  ),
  (
    'Fresh Young Coconut Drink',
    'Fresh green young coconut drink from Thailand. Natural hydration with electrolytes and a sweet, tropical taste. Ready to drink with straw.',
    4.20,
    'each',
    'Drinks'::text,
    'International'::text,
    15.8700::float,  -- Thailand lat
    100.9925::float, -- Thailand lng
    false,
    ARRAY['tree nuts']::text[],  -- Coconut is classified as tree nut for allergen purposes
    ARRAY['vegan', 'vegetarian', 'gluten-free', 'dairy-free', 'natural']::text[]
  )
) AS p(name, description, price, unit, category, locality, lat, lng, variable_location, allergens, tags)
WHERE s.name = 'Happy Cabbage Market Stall';

-- Verify the insert
SELECT name, price, unit, category, locality FROM products 
WHERE supplier_id = (SELECT id FROM suppliers WHERE name = 'Happy Cabbage Market Stall')
AND name IN ('Florida Pineapple', 'Yellow Courgette', 'Fresh Young Coconut Drink');
