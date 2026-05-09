-- GB Maycock and Sons - Full product refresh
-- This removes all existing products and adds the new product list

-- First, get the supplier ID and delete existing products
DELETE FROM products WHERE supplier_id = (SELECT id FROM suppliers WHERE name = 'GB Maycock and Sons');

-- Insert new products with allergens and tags
INSERT INTO products (supplier_id, name, description, price, unit, category, lat, lng, locality, status, allergens, tags)
SELECT id, name, description, price, unit, category, 53.022, -1.483, 'Local', 'approved', allergens, tags
FROM (SELECT id FROM suppliers WHERE name = 'GB Maycock and Sons') AS s,
(VALUES
  ('Streaky Bacon', 'Dry-cured streaky bacon, sold in packs of 8 slices. Perfect for a full English, BLTs, or wrapping around just about anything.', 13.20, 'per kg', 'Meat & Poultry'::text, ARRAY['sulphites']::text[], ARRAY[]::text[]),
  ('Plain Back Bacon', 'Classic back bacon, 6 slices per pack. Lean and meaty — proper butcher quality for your morning sarnie.', 13.20, 'per kg', 'Meat & Poultry', ARRAY['sulphites'], ARRAY[]::text[]),
  ('Smoked Bacon', 'Smoked back bacon, 6 slices per pack. A rich, smoky flavour that takes your fry-up to the next level.', 13.20, 'per kg', 'Meat & Poultry', ARRAY['sulphites'], ARRAY[]::text[]),
  ('Gammon Steaks', 'Thick-cut gammon steaks, great on the grill or pan-fried. Classic with a fried egg and a handful of chips.', 9.99, 'per kg', 'Meat & Poultry', ARRAY['sulphites'], ARRAY[]::text[]),
  ('Lincolnshire Sausages', 'Herby Lincolnshire-style sausages made in-store. Packed with sage and coarsely ground pork — a real breakfast classic.', 6.06, 'pack of 6', 'Meat & Poultry', ARRAY['gluten', 'sulphites'], ARRAY[]::text[]),
  ('Plain Pork Sausages', 'Traditional plain pork sausages made fresh in-store. Simple, meaty, and always delicious — brilliant on the BBQ or in a pan.', 4.68, 'pack of 6', 'Meat & Poultry', ARRAY['gluten', 'sulphites'], ARRAY[]::text[]),
  ('Tomato Sausages', 'Fresh pork sausages with a hint of tomato, made in-store. A flavourful twist on the classic banger — great for kids and grown-ups alike.', 4.68, 'pack of 6', 'Meat & Poultry', ARRAY['gluten', 'sulphites'], ARRAY[]::text[]),
  ('Beef Mince', 'Freshly prepared beef mince, sold in 1lb packs. Rich in flavour and great for everything from a proper cottage pie to a hearty bolognese.', 5.50, '1lb pack', 'Meat & Poultry', ARRAY[]::text[], ARRAY[]::text[]),
  ('Sausage Meat', 'Freshly prepared sausage meat in a 1lb pack — perfect for stuffing, sausage rolls, or making your own bangers from scratch.', 5.57, '1lb pack', 'Meat & Poultry', ARRAY['gluten', 'sulphites'], ARRAY[]::text[]),
  ('Minted Lamb Steaks', 'Locally sourced lamb steaks marinated with mint and seasoned in-house. Ready to cook straight from the pack — a Maycock''s favourite.', 8.59, 'per pack', 'Meat & Poultry', ARRAY[]::text[], ARRAY[]::text[]),
  ('Hog Roll', 'A freshly baked hog roll from Maycock''s own bakery — packed with seasoned pork and wrapped in golden pastry. A proper grab-and-go snack.', 1.50, 'each', 'Bread, Pastries & Cakes', ARRAY['gluten', 'eggs', 'milk'], ARRAY[]::text[]),
  ('Tongue', 'Traditional sliced tongue, sold in packs of 3. A classic deli meat with a rich, tender flavour — great in sandwiches or on a cold meat platter.', 4.49, '3 slices', 'Meat & Poultry', ARRAY['sulphites'], ARRAY[]::text[]),
  ('Corned Beef', 'Freshly sliced corned beef in packs of 4. Tender, lightly spiced, and great in a sandwich or alongside a proper salad.', 2.98, '4 slices', 'Meat & Poultry', ARRAY['sulphites'], ARRAY[]::text[]),
  ('Ham', 'Traditionally cured ham, hand-sliced in packs of 3. Delicious in a sandwich, with a ploughman''s, or straight off the board.', 4.08, '3 slices', 'Meat & Poultry', ARRAY['sulphites'], ARRAY[]::text[]),
  ('Cornish Pasty', 'A hearty Cornish-style pasty baked fresh in-store. Filled with seasoned beef and vegetables in a thick, golden shortcrust pastry casing.', 2.50, 'each', 'Bread, Pastries & Cakes', ARRAY['gluten', 'eggs', 'milk'], ARRAY[]::text[]),
  ('Sausage Roll', 'Freshly baked sausage roll made with Maycock''s own seasoned sausage meat wrapped in light, flaky pastry. A timeless classic.', 1.50, 'each', 'Bread, Pastries & Cakes', ARRAY['gluten', 'eggs', 'milk'], ARRAY[]::text[]),
  ('Steak Pie', 'A freshly baked individual steak pie with tender chunks of beef in rich gravy, encased in golden shortcrust pastry. Made in-house at Maycock''s bakery.', 3.00, 'each', 'Bread, Pastries & Cakes', ARRAY['gluten', 'eggs', 'milk'], ARRAY[]::text[]),
  ('Mince & Onion Pie', 'A classic individual mince and onion pie baked fresh in-house. Hearty, comforting, and just the thing on a cold day.', 3.00, 'each', 'Bread, Pastries & Cakes', ARRAY['gluten', 'eggs', 'milk'], ARRAY[]::text[]),
  ('Chicken Pie', 'A freshly baked individual chicken pie with tender chicken in a creamy sauce, topped with golden shortcrust pastry. Made fresh at Maycock''s bakery.', 3.00, 'each', 'Bread, Pastries & Cakes', ARRAY['gluten', 'eggs', 'milk'], ARRAY[]::text[]),
  ('Steak & Kidney Pie', 'A proper individual steak and kidney pie baked fresh in-store. Rich, deeply savoury filling in a crisp shortcrust pastry case — a British staple done right.', 3.00, 'each', 'Bread, Pastries & Cakes', ARRAY['gluten', 'eggs', 'milk'], ARRAY[]::text[]),
  ('Cheese and Onion Slice', 'A freshly baked cheese and onion slice with a generously filled, flaky pastry casing. Perfect for a lunchtime treat or a quick snack on the go.', 1.50, 'each', 'Bread, Pastries & Cakes', ARRAY['gluten', 'milk', 'eggs'], ARRAY['vegetarian']),
  ('Stilton Top Pork Pie (Large)', 'A generously sized pork pie topped with a layer of Stilton cheese, baked fresh in-house. Rich, indulgent, and absolutely brilliant on a cheeseboard or as a centrepiece.', 6.00, 'each', 'Bread, Pastries & Cakes', ARRAY['gluten', 'milk', 'eggs'], ARRAY[]::text[]),
  ('Stilton Top Pork Pie (Small)', 'An individual-sized pork pie topped with creamy Stilton, baked fresh at Maycock''s. A proper treat — great on its own or as part of a picnic spread.', 3.00, 'each', 'Bread, Pastries & Cakes', ARRAY['gluten', 'milk', 'eggs'], ARRAY[]::text[]),
  ('Pork Pie (Large)', 'A traditional large pork pie baked fresh in-house. Packed with seasoned pork in a rich, hand-raised hot water crust pastry. A Maycock''s classic.', 5.00, 'each', 'Bread, Pastries & Cakes', ARRAY['gluten', 'milk', 'eggs'], ARRAY[]::text[]),
  ('Pork Pie (Small)', 'An individual pork pie baked fresh at Maycock''s own bakery. Perfectly seasoned pork in a crisp hot water crust — ideal for lunchboxes or a quick snack.', 2.50, 'each', 'Bread, Pastries & Cakes', ARRAY['gluten', 'milk', 'eggs'], ARRAY[]::text[]),
  ('Scotch Eggs', 'Freshly made Scotch eggs with a seasoned sausage meat coating and a crispy golden breadcrumb shell. A classic British snack, done properly.', 2.00, 'each', 'Meat & Poultry', ARRAY['eggs', 'gluten'], ARRAY[]::text[])
) AS p(name, description, price, unit, category, allergens, tags);

-- Verify the products were added
SELECT name, category, price, unit, allergens, tags FROM products 
WHERE supplier_id = (SELECT id FROM suppliers WHERE name = 'GB Maycock and Sons')
ORDER BY category, name;
