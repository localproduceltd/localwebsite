-- GB Maycock and Sons - Supplier and Products Upload
-- Run this entire script in Supabase SQL Editor (single execution)

WITH new_supplier AS (
  INSERT INTO suppliers (name, description, image, location, category, lat, lng, status, email, instagram)
  VALUES (
    'GB Maycock and Sons',
    'Traditional family butchers in Belper, Derbyshire. Farm-reared beef, locally sourced lamb and pork, plus homemade pies and BBQ favourites.',
    '',
    'Belper',
    'Butcher',
    53.022,
    -1.483,
    'launch_not_live',
    NULL,
    NULL
  )
  RETURNING id
)
INSERT INTO products (supplier_id, name, description, price, unit, image, category, in_stock, locality, lat, lng, variable_location, status, allergens, tags)
SELECT id, name, description, price, unit, '', category, true, locality, lat, lng, variable_location, 'approved', allergens, tags
FROM new_supplier, (VALUES
  ('Farm-Reared Beef Mince', 'Freshly prepared beef mince from Maycock''s own farm-reared cattle. Rich in flavour and great for everything from a proper cottage pie to a hearty bolognese.', 8.99, 'per kg', 'Meat & Poultry'::text, 'Own Produce'::text, 53.022::float, -1.483::float, false, ARRAY[]::text[], ARRAY[]::text[]),
  ('Sirloin Steak', 'Beautifully marbled sirloin from Maycock''s own farm-reared beef, butchered in-house. Great flavour and tenderness — perfect for the pan or the grill.', 7.20, 'each', 'Meat & Poultry', 'Own Produce', 53.022, -1.483, false, ARRAY[]::text[], ARRAY[]::text[]),
  ('Lamb Chops', 'Fresh lamb chops sourced from farms in and around the Belper area. Tender, flavourful, and great on the grill or slow-roasted in the oven.', 7.20, 'per kg', 'Meat & Poultry', 'Local', 53.022, -1.483, false, ARRAY[]::text[], ARRAY[]::text[]),
  ('Minted Lamb Steaks', 'A Maycock''s classic — locally sourced lamb steaks marinated with mint and seasoned in-house. Ready to cook and always popular.', 6.80, 'per kg', 'Meat & Poultry', 'Local', 53.022, -1.483, false, ARRAY[]::text[], ARRAY[]::text[]),
  ('Traditional Pork Sausages', 'Thick, meaty sausages made in-store using locally sourced Derbyshire pork. A proper banger — brilliant for the BBQ or a full English.', 5.99, 'pack of 6', 'Meat & Poultry', 'Local', 53.022, -1.483, false, ARRAY['gluten'], ARRAY[]::text[]),
  ('Pork Belly Slices', 'Succulent pork belly slices from local Derbyshire pork. Slow-roast them low and long, or fire them on the BBQ — one of the standout cuts from the shop.', 1.20, 'per kg', 'Meat & Poultry', 'Local', 53.022, -1.483, false, ARRAY[]::text[], ARRAY[]::text[]),
  ('Homemade Steak Pie', 'A proper homemade steak pie baked fresh at Maycock''s own bakery. Packed with tender farm beef in rich gravy under a golden shortcrust pastry lid.', 7.20, 'each', 'Meat & Poultry', 'Own Produce', 53.022, -1.483, false, ARRAY['gluten', 'eggs', 'milk'], ARRAY[]::text[]),
  ('BBQ Pork Ribs', 'Meaty pork ribs from Maycock''s popular BBQ range, marinated and ready to cook. A real crowd-pleaser for summer grilling.', 4.00, 'per rack', 'Meat & Poultry', 'Local', 53.022, -1.483, false, ARRAY[]::text[], ARRAY[]::text[])
) AS p(name, description, price, unit, category, locality, lat, lng, variable_location, allergens, tags);
