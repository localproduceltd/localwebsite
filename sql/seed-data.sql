-- ============================================================
-- SEED DATA: Clear existing + insert realistic Derbyshire data
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Clear existing data (order matters for foreign keys)
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM products;
DELETE FROM delivery_days;
DELETE FROM supplier_users;
DELETE FROM suppliers;

-- 2. Insert Suppliers
INSERT INTO suppliers (id, name, description, image, location, category, lat, lng, active) VALUES
('11111111-0001-0001-0001-000000000001', 'Loaf Bakery', 'Artisan village bakery in Crich producing slow-fermented sourdough breads, pastries and seasonal baked goods using high-quality local ingredients.', '/images/suppliers/Loaf Bakery.png', 'Crich, Derbyshire', 'Bakery', 53.0826, -1.4894, true),
('11111111-0001-0001-0001-000000000002', 'Fresh Choice Ashbourne', 'Independent Ashbourne greengrocer supplying fresh seasonal fruit, vegetables, salad items and everyday produce to the local community.', '/images/suppliers/Fresh Choice.png', 'Ashbourne, Derbyshire', 'Greengrocer', 53.0174, -1.7323, true),
('11111111-0001-0001-0001-000000000003', 'Hulland Ward Farm Shop', 'Popular Derbyshire farm shop offering locally sourced meat, dairy, baked goods and seasonal produce from surrounding farms.', '/images/suppliers/The Farm Shop.png', 'Hulland Ward, Derbyshire', 'Farm Shop', 53.0418, -1.6485, true),
('11111111-0001-0001-0001-000000000004', 'Inn Farm Dairy', 'Family-run Derbyshire dairy in Western Underwood producing fresh pasteurised milk and cream from their own herd for local customers and farm shops.', '/images/suppliers/Inn Farm.png', 'Western Underwood, Derbyshire', 'Dairy', 52.9518, -1.6296, true),
('11111111-0001-0001-0001-000000000005', 'Cheddar Gorge, Ashbourne', 'Independent Ashbourne cheesemonger and deli specialising in British artisan cheeses, local dairy products and fine food accompaniments.', '/images/suppliers/Cheddar Gorge.png', 'Ashbourne, Derbyshire', 'Cheesemonger', 53.0165, -1.7320, true),
('11111111-0001-0001-0001-000000000006', 'The Zero Waste Shop Wirksworth', 'Sustainable refill shop in Wirksworth offering package-free pantry staples, eco household products and locally sourced ethical goods.', '/images/suppliers/Zero Waste.png', 'Wirksworth, Derbyshire', 'Zero Waste', 53.0821, -1.5687, true),
('11111111-0001-0001-0001-000000000007', 'Barry Fitch Butchers', 'Traditional Derbyshire butcher in Little Eaton supplying locally sourced meats, house-made sausages and prepared cuts to the surrounding community.', '/images/suppliers/Barry Fitch Butchers.png', 'Little Eaton, Derbyshire', 'Butcher', 52.9798, -1.4634, true),
('11111111-0001-0001-0001-000000000008', 'The Fish Man, Ashbourne', 'Local Ashbourne fishmonger supplying fresh sustainably sourced fish, seafood and smoked products delivered from UK coastal markets.', '/images/suppliers/The Fish Man.png', 'Ashbourne, Derbyshire', 'Fishmonger', 53.0168, -1.7317, true);

-- 3. Insert Products
-- Loaf Bakery (Own Produce — same coords as supplier)
INSERT INTO products (id, supplier_id, name, description, price, unit, image, category, in_stock, locality, lat, lng, status) VALUES
('22222222-0001-0001-0001-000000000001', '11111111-0001-0001-0001-000000000001', 'Sourdough Country Loaf', 'Slow-fermented sourdough with a golden crust and open crumb.', 3.80, 'per loaf', 'https://images.unsplash.com/photo-1585478259715-876acc5be8eb?w=800', 'Bread', true, 'Own Produce', 53.0826, -1.4894, 'approved'),
('22222222-0001-0001-0001-000000000002', '11111111-0001-0001-0001-000000000001', 'Seeded Multigrain Loaf', 'Hearty multigrain loaf packed with sunflower, linseed and sesame seeds.', 4.20, 'per loaf', 'https://images.unsplash.com/photo-1598373182133-52452f7691ef?w=800', 'Bread', true, 'Own Produce', 53.0826, -1.4894, 'approved'),
('22222222-0001-0001-0001-000000000003', '11111111-0001-0001-0001-000000000001', 'Cinnamon Buns', 'Soft, swirled cinnamon buns with a sticky glaze.', 3.20, 'each', 'https://images.unsplash.com/photo-1583338917451-face2751d8d5?w=800', 'Pastries', true, 'Own Produce', 53.0826, -1.4894, 'approved'),
('22222222-0001-0001-0001-000000000004', '11111111-0001-0001-0001-000000000001', 'Croissants (Butter)', 'Classic French-style butter croissants, flaky and golden. Made fresh each morning in our Hulland bakery using traditional lamination techniques and premium French butter. Each croissant is hand-rolled and left to prove overnight, creating those distinctive honeycomb layers that make every bite melt in your mouth.', 2.80, 'each', 'https://images.unsplash.com/photo-1530610476181-d83430b64dcd?w=800', 'Pastries', true, 'Own Produce', 53.0826, -1.4894, 'approved'),
('22222222-0001-0001-0001-000000000005', '11111111-0001-0001-0001-000000000001', 'Focaccia (Rosemary & Sea Salt)', 'Olive oil focaccia topped with fresh rosemary and flaky sea salt.', 4.50, 'per tray', 'https://images.unsplash.com/photo-1619535860434-ba1d8fa12536?w=800', 'Bread', true, 'Own Produce', 53.0826, -1.4894, 'approved'),

-- Fresh Choice Ashbourne (Local produce)
('22222222-0001-0001-0001-000000000006', '11111111-0001-0001-0001-000000000002', 'Seasonal Vegetable Box (Small)', 'A curated selection of the best seasonal vegetables available this week.', 12.00, 'per box', 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800', 'Vegetables', true, 'Local', 53.0174, -1.7323, 'approved'),
('22222222-0001-0001-0001-000000000007', '11111111-0001-0001-0001-000000000002', 'British Potatoes (Maris Piper)', 'Versatile Maris Piper potatoes, great for roasting, mashing and chipping.', 1.80, 'per kg', 'https://images.unsplash.com/photo-1590165482129-1b8b27698780?w=800', 'Vegetables', true, 'Local', 53.0180, -1.7310, 'approved'),
('22222222-0001-0001-0001-000000000008', '11111111-0001-0001-0001-000000000002', 'Carrots', 'Fresh, sweet carrots from local Derbyshire farms.', 1.20, 'per kg', 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=800', 'Vegetables', true, 'Local', 53.0180, -1.7310, 'approved'),
('22222222-0001-0001-0001-000000000009', '11111111-0001-0001-0001-000000000002', 'Free-Range Eggs', 'Local free-range eggs from Derbyshire hens.', 3.20, 'per dozen', 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=800', 'Eggs', true, 'Local', 53.0200, -1.7280, 'approved'),
('22222222-0001-0001-0001-000000000010', '11111111-0001-0001-0001-000000000002', 'Mixed Salad Bag', 'A fresh mix of seasonal salad leaves, ready to serve.', 2.50, 'per bag', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800', 'Salad', true, 'Local', 53.0174, -1.7323, 'approved'),
('22222222-0001-0001-0001-000000000011', '11111111-0001-0001-0001-000000000002', 'Vine Tomatoes', 'Ripe vine tomatoes with rich flavour.', 2.80, 'per kg', 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800', 'Vegetables', true, 'Local', 53.0174, -1.7323, 'approved'),
('22222222-0001-0001-0001-000000000012', '11111111-0001-0001-0001-000000000002', 'Red Onions', 'Sweet red onions, ideal for salads and roasting.', 1.50, 'per kg', 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=800', 'Vegetables', true, 'Local', 53.0180, -1.7310, 'approved'),
('22222222-0001-0001-0001-000000000013', '11111111-0001-0001-0001-000000000002', 'Braeburn Apples', 'Crisp, sweet Braeburn apples from English orchards.', 2.40, 'per kg', 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=800', 'Fruit', true, 'Regional', 52.9500, -1.7000, 'approved'),
('22222222-0001-0001-0001-000000000014', '11111111-0001-0001-0001-000000000002', 'Broccoli', 'Fresh green broccoli heads.', 1.60, 'per head', 'https://images.unsplash.com/photo-1584270354949-c26b0d5b4a0c?w=800', 'Vegetables', true, 'Local', 53.0174, -1.7323, 'approved'),
('22222222-0001-0001-0001-000000000015', '11111111-0001-0001-0001-000000000002', 'Courgettes', 'Firm, glossy courgettes perfect for grilling or stir-frying.', 2.20, 'per kg', 'https://images.unsplash.com/photo-1563252722-6434563a985d?w=800', 'Vegetables', true, 'Local', 53.0174, -1.7323, 'approved'),

-- Hulland Ward Farm Shop (Own Produce + Local)
('22222222-0001-0001-0001-000000000016', '11111111-0001-0001-0001-000000000003', 'Local Free-Range Eggs', 'Farm-fresh free-range eggs from our own hens.', 3.50, 'per dozen', 'https://images.unsplash.com/photo-1569288052389-dac9b01c9c05?w=800', 'Eggs', true, 'Own Produce', 53.0418, -1.6485, 'approved'),
('22222222-0001-0001-0001-000000000017', '11111111-0001-0001-0001-000000000003', 'Derbyshire Sausages', 'Meaty pork sausages made with our traditional farm recipe.', 5.50, 'per pack (6)', 'https://images.unsplash.com/photo-1551028150-64b9f398f678?w=800', 'Meat', true, 'Own Produce', 53.0418, -1.6485, 'approved'),
('22222222-0001-0001-0001-000000000018', '11111111-0001-0001-0001-000000000003', 'Whole Milk (Local Dairy)', 'Fresh whole milk from a nearby Derbyshire dairy herd.', 1.70, 'per litre', 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=800', 'Dairy', true, 'Local', 52.9600, -1.6400, 'approved'),
('22222222-0001-0001-0001-000000000019', '11111111-0001-0001-0001-000000000003', 'Farmhouse Butter', 'Rich, creamy farmhouse butter churned locally.', 2.80, 'per 250g', 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=800', 'Dairy', true, 'Local', 52.9600, -1.6400, 'approved'),
('22222222-0001-0001-0001-000000000020', '11111111-0001-0001-0001-000000000003', 'Dry-Cured Back Bacon', 'Traditional dry-cured back bacon from Derbyshire pigs.', 4.80, 'per 250g', 'https://images.unsplash.com/photo-1528607929212-2636ec44253e?w=800', 'Meat', true, 'Own Produce', 53.0418, -1.6485, 'approved'),
('22222222-0001-0001-0001-000000000021', '11111111-0001-0001-0001-000000000003', 'Beef Mince (Local)', 'Lean beef mince from locally reared cattle.', 6.50, 'per 500g', 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=800', 'Meat', true, 'Local', 53.0500, -1.6300, 'approved'),
('22222222-0001-0001-0001-000000000022', '11111111-0001-0001-0001-000000000003', 'Seasonal Vegetable Box', 'A generous box of mixed seasonal vegetables from local farms.', 15.00, 'per box', 'https://images.unsplash.com/photo-1518843875459-f738682238a6?w=800', 'Vegetables', true, 'Local', 53.0418, -1.6485, 'approved'),
('22222222-0001-0001-0001-000000000023', '11111111-0001-0001-0001-000000000003', 'Local Honey', 'Pure raw honey from Derbyshire beekeepers.', 6.00, 'per jar (340g)', 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=800', 'Preserves', true, 'Local', 53.0300, -1.6500, 'approved'),
('22222222-0001-0001-0001-000000000024', '11111111-0001-0001-0001-000000000003', 'Cheese - Derbyshire Cheddar', 'Mature cheddar cheese made in the Derbyshire tradition.', 3.20, 'per 200g', 'https://images.unsplash.com/photo-1618164436241-4473940d1f5c?w=800', 'Dairy', true, 'Regional', 53.0000, -1.6000, 'approved'),
('22222222-0001-0001-0001-000000000025', '11111111-0001-0001-0001-000000000003', 'Homemade Pork Pies', 'Hand-raised pork pies with hot water crust pastry.', 3.80, 'each', 'https://images.unsplash.com/photo-1614173188975-6d8e263eed97?w=800', 'Meat', true, 'Own Produce', 53.0418, -1.6485, 'approved'),

-- Inn Farm Dairy (Own Produce)
('22222222-0001-0001-0001-000000000026', '11111111-0001-0001-0001-000000000004', 'Whole Milk', 'Fresh pasteurised whole milk from our own herd.', 1.60, 'per litre', 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=800', 'Dairy', true, 'Own Produce', 52.9518, -1.6296, 'approved'),
('22222222-0001-0001-0001-000000000027', '11111111-0001-0001-0001-000000000004', 'Semi-Skimmed Milk', 'Lighter pasteurised milk from our Derbyshire herd.', 1.60, 'per litre', 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=800', 'Dairy', true, 'Own Produce', 52.9518, -1.6296, 'approved'),
('22222222-0001-0001-0001-000000000028', '11111111-0001-0001-0001-000000000004', 'Double Cream', 'Rich double cream, perfect for pouring or whipping.', 2.40, 'per 300ml', 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=800', 'Dairy', true, 'Own Produce', 52.9518, -1.6296, 'approved'),
('22222222-0001-0001-0001-000000000029', '11111111-0001-0001-0001-000000000004', 'Natural Yoghurt', 'Creamy natural yoghurt made with our own milk.', 2.80, 'per 500g', 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800', 'Dairy', true, 'Own Produce', 52.9518, -1.6296, 'approved'),
('22222222-0001-0001-0001-000000000030', '11111111-0001-0001-0001-000000000004', 'Salted Farmhouse Butter', 'Hand-churned salted butter from our own cream.', 3.20, 'per 250g', 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=800', 'Dairy', true, 'Own Produce', 52.9518, -1.6296, 'approved'),

-- Cheddar Gorge, Ashbourne (Regional + UK sourced cheeses)
('22222222-0001-0001-0001-000000000031', '11111111-0001-0001-0001-000000000005', 'Mature Cheddar', 'Sharp, full-flavoured mature cheddar from a traditional creamery.', 3.60, 'per 200g', 'https://images.unsplash.com/photo-1618164436241-4473940d1f5c?w=800', 'Cheese', true, 'Regional', 53.0000, -1.5500, 'approved'),
('22222222-0001-0001-0001-000000000032', '11111111-0001-0001-0001-000000000005', 'Stilton', 'Creamy blue Stilton in the Colston Bassett tradition.', 4.20, 'per 200g', 'https://images.unsplash.com/photo-1452195100486-9cc805987862?w=800', 'Cheese', true, 'Regional', 52.8500, -1.0300, 'approved'),
('22222222-0001-0001-0001-000000000033', '11111111-0001-0001-0001-000000000005', 'Red Leicester', 'Mellow, nutty Red Leicester with a russet hue.', 3.40, 'per 200g', 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=800', 'Cheese', true, 'Regional', 52.6300, -1.1300, 'approved'),
('22222222-0001-0001-0001-000000000034', '11111111-0001-0001-0001-000000000005', 'Goats Cheese Log', 'Soft, tangy goats cheese log with a bright, fresh flavour.', 3.80, 'per 150g', 'https://images.unsplash.com/photo-1559561853-08451507cbe7?w=800', 'Cheese', true, 'UK', 51.5000, -1.0000, 'approved'),
('22222222-0001-0001-0001-000000000035', '11111111-0001-0001-0001-000000000005', 'Camembert-Style Soft Cheese', 'Luxurious British soft cheese with a bloomy rind.', 4.50, 'per 250g', 'https://images.unsplash.com/photo-1634487359989-3e90c9432133?w=800', 'Cheese', true, 'UK', 51.2000, -0.8000, 'approved'),
('22222222-0001-0001-0001-000000000036', '11111111-0001-0001-0001-000000000005', 'Cheese Selection Box', 'A curated selection of four British artisan cheeses.', 14.00, 'per box', 'https://images.unsplash.com/photo-1505575967455-40e256f73376?w=800', 'Cheese', true, 'UK', 53.0165, -1.7320, 'approved'),
('22222222-0001-0001-0001-000000000037', '11111111-0001-0001-0001-000000000005', 'Chutney (Caramelised Onion)', 'Sweet, sticky caramelised onion chutney — perfect with cheese.', 3.80, 'per jar', 'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=800', 'Accompaniments', true, 'Local', 53.0165, -1.7320, 'approved'),
('22222222-0001-0001-0001-000000000038', '11111111-0001-0001-0001-000000000005', 'Artisan Crackers', 'Crisp, savoury crackers handmade for the cheese board.', 2.80, 'per box', 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=800', 'Accompaniments', true, 'UK', 53.0165, -1.7320, 'approved'),
('22222222-0001-0001-0001-000000000039', '11111111-0001-0001-0001-000000000005', 'Local Butter', 'Creamy salted butter from a Derbyshire dairy.', 3.20, 'per 250g', 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=800', 'Dairy', true, 'Local', 52.9518, -1.6296, 'approved'),
('22222222-0001-0001-0001-000000000040', '11111111-0001-0001-0001-000000000005', 'Continental Cheese Board Mix', 'A premium selection of European cheeses for entertaining.', 18.00, 'per pack', 'https://images.unsplash.com/photo-1532635241-17e820acc59f?w=800', 'Cheese', true, 'International', 48.8566, 2.3522, 'approved'),

-- The Zero Waste Shop Wirksworth (mixed localities)
('22222222-0001-0001-0001-000000000041', '11111111-0001-0001-0001-000000000006', 'Organic Porridge Oats', 'Organic rolled oats, perfect for a warming breakfast.', 1.80, 'per 500g', 'https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=800', 'Pantry', true, 'UK', 52.4000, -1.5000, 'approved'),
('22222222-0001-0001-0001-000000000042', '11111111-0001-0001-0001-000000000006', 'Dried Pasta (Refill)', 'Italian-style dried pasta, sold loose by weight.', 2.20, 'per 500g', 'https://images.unsplash.com/photo-1551462147-37885acc36f1?w=800', 'Pantry', true, 'International', 41.9028, 12.4964, 'approved'),
('22222222-0001-0001-0001-000000000043', '11111111-0001-0001-0001-000000000006', 'Basmati Rice', 'Fragrant basmati rice, sold loose by the kilo.', 2.50, 'per kg', 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800', 'Pantry', true, 'International', 28.6139, 77.2090, 'approved'),
('22222222-0001-0001-0001-000000000044', '11111111-0001-0001-0001-000000000006', 'Refill Washing-Up Liquid', 'Eco-friendly washing-up liquid, bring your own bottle.', 3.00, 'per 500ml', 'https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?w=800', 'Household', true, 'UK', 53.0821, -1.5687, 'approved'),
('22222222-0001-0001-0001-000000000045', '11111111-0001-0001-0001-000000000006', 'Olive Oil (Refill)', 'Extra virgin olive oil, refill your own bottle.', 5.50, 'per 500ml', 'https://images.unsplash.com/photo-1612456225676-a71e8e7c858c?w=800', 'Pantry', true, 'International', 37.9838, 23.7275, 'approved'),
('22222222-0001-0001-0001-000000000046', '11111111-0001-0001-0001-000000000006', 'Loose Coffee Beans', 'Ethically sourced single-origin coffee beans.', 4.80, 'per 250g', 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=800', 'Drinks', true, 'International', -1.2921, 36.8219, 'approved'),
('22222222-0001-0001-0001-000000000047', '11111111-0001-0001-0001-000000000006', 'Herbal Loose-Leaf Tea', 'A calming blend of chamomile, peppermint and lemon balm.', 3.20, 'per 100g', 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=800', 'Drinks', true, 'UK', 51.1789, 1.0833, 'approved'),
('22222222-0001-0001-0001-000000000048', '11111111-0001-0001-0001-000000000006', 'Dark Chocolate (Ethical)', 'Rich 70% dark chocolate from a fair-trade cooperative.', 3.50, 'per bar', 'https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=800', 'Snacks', true, 'International', 7.5400, -5.5471, 'approved'),
('22222222-0001-0001-0001-000000000049', '11111111-0001-0001-0001-000000000006', 'Shampoo Refill', 'Natural shampoo refill, gentle and sulphate-free.', 4.50, 'per 500ml', 'https://images.unsplash.com/photo-1631729371254-42c2892f0e6e?w=800', 'Personal Care', true, 'UK', 53.0821, -1.5687, 'approved'),
('22222222-0001-0001-0001-000000000050', '11111111-0001-0001-0001-000000000006', 'Local Honey', 'Raw wildflower honey from Derbyshire bees.', 6.50, 'per jar (340g)', 'https://images.unsplash.com/photo-1471943311424-646960669fbc?w=800', 'Preserves', true, 'Local', 53.0800, -1.5700, 'approved'),

-- Barry Fitch Butchers (Own Produce + Local)
('22222222-0001-0001-0001-000000000051', '11111111-0001-0001-0001-000000000007', 'Derbyshire Beef Mince', 'Premium lean beef mince from locally reared cattle.', 6.80, 'per 500g', 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=800', 'Meat', true, 'Local', 52.9798, -1.4634, 'approved'),
('22222222-0001-0001-0001-000000000052', '11111111-0001-0001-0001-000000000007', 'Pork Sausages (Traditional)', 'House-recipe pork sausages with herbs and seasoning.', 5.80, 'per pack (6)', 'https://images.unsplash.com/photo-1517093728432-a0440f8d45af?w=800', 'Meat', true, 'Own Produce', 52.9798, -1.4634, 'approved'),
('22222222-0001-0001-0001-000000000053', '11111111-0001-0001-0001-000000000007', 'Chicken Breasts', 'Free-range chicken breasts from Derbyshire farms.', 6.50, 'per 500g', 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=800', 'Meat', true, 'Local', 52.9900, -1.4500, 'approved'),
('22222222-0001-0001-0001-000000000054', '11111111-0001-0001-0001-000000000007', 'Dry-Cured Back Bacon', 'Traditional dry-cured back bacon, sliced to order.', 4.90, 'per 250g', 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800', 'Meat', true, 'Own Produce', 52.9798, -1.4634, 'approved'),
('22222222-0001-0001-0001-000000000055', '11111111-0001-0001-0001-000000000007', 'Sirloin Steak', 'Prime 8oz sirloin steak, aged for flavour.', 8.50, 'per 8oz steak', 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800', 'Meat', true, 'Local', 52.9798, -1.4634, 'approved'),
('22222222-0001-0001-0001-000000000056', '11111111-0001-0001-0001-000000000007', 'Whole Roasting Chicken', 'Free-range whole chicken, oven-ready.', 9.50, 'each (1.6-1.8kg)', 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=800', 'Meat', true, 'Local', 52.9900, -1.4500, 'approved'),
('22222222-0001-0001-0001-000000000057', '11111111-0001-0001-0001-000000000007', 'Diced Beef (Braising)', 'Tender diced beef, ideal for stews and casseroles.', 7.20, 'per 500g', 'https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=800', 'Meat', true, 'Local', 52.9798, -1.4634, 'approved'),
('22222222-0001-0001-0001-000000000058', '11111111-0001-0001-0001-000000000007', 'Pork Chops', 'Thick-cut pork chops from outdoor-reared pigs.', 6.00, 'per 500g', 'https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=800', 'Meat', true, 'Local', 52.9798, -1.4634, 'approved'),
('22222222-0001-0001-0001-000000000059', '11111111-0001-0001-0001-000000000007', 'Homemade Steak Pies', 'Chunky steak pie with a buttery shortcrust top.', 4.20, 'each', 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800', 'Meat', true, 'Own Produce', 52.9798, -1.4634, 'approved'),
('22222222-0001-0001-0001-000000000060', '11111111-0001-0001-0001-000000000007', 'Lamb Shoulder', 'Slow-roast lamb shoulder from local flocks.', 12.00, 'per kg', 'https://images.unsplash.com/photo-1608877907149-a206d75ba011?w=800', 'Meat', true, 'Local', 53.0000, -1.5000, 'approved'),

-- The Fish Man, Ashbourne (UK coastal sourced)
('22222222-0001-0001-0001-000000000061', '11111111-0001-0001-0001-000000000008', 'Fresh Salmon Fillets', 'Sustainably sourced Scottish salmon fillets.', 7.50, 'per 2 fillets', 'https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6?w=800', 'Fish', true, 'UK', 57.4800, -5.7100, 'approved'),
('22222222-0001-0001-0001-000000000062', '11111111-0001-0001-0001-000000000008', 'Cod Loin', 'Thick-cut cod loin, firm and flaky.', 6.80, 'per 500g', 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800', 'Fish', true, 'UK', 54.2800, 0.4000, 'approved'),
('22222222-0001-0001-0001-000000000063', '11111111-0001-0001-0001-000000000008', 'Haddock Fillets', 'Fresh haddock fillets from North Sea day boats.', 5.80, 'per 500g', 'https://images.unsplash.com/photo-1510130387422-82bed34b37e9?w=800', 'Fish', true, 'UK', 54.2800, 0.4000, 'approved'),
('22222222-0001-0001-0001-000000000064', '11111111-0001-0001-0001-000000000008', 'Sea Bass (Whole)', 'Whole sea bass, gutted and scaled, ready to cook.', 5.50, 'each', 'https://images.unsplash.com/photo-1534604973900-c43ab4c2e0ab?w=800', 'Fish', true, 'UK', 50.3700, -4.1400, 'approved'),
('22222222-0001-0001-0001-000000000065', '11111111-0001-0001-0001-000000000008', 'Smoked Mackerel Fillets', 'Oak-smoked mackerel fillets, ready to eat.', 4.20, 'per pack', 'https://images.unsplash.com/photo-1574781330855-d0db8cc6a79c?w=800', 'Fish', true, 'UK', 50.7200, -1.8800, 'approved'),
('22222222-0001-0001-0001-000000000066', '11111111-0001-0001-0001-000000000008', 'King Prawns', 'Plump, juicy king prawns, peeled and deveined.', 6.00, 'per 300g', 'https://images.unsplash.com/photo-1510130113356-d30539a3e944?w=800', 'Seafood', true, 'UK', 50.3700, -4.1400, 'approved'),
('22222222-0001-0001-0001-000000000067', '11111111-0001-0001-0001-000000000008', 'Fresh Tuna Steaks', 'Sashimi-grade tuna steaks, perfect for searing.', 7.20, 'per 2 steaks', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800', 'Fish', true, 'UK', 50.3700, -4.1400, 'approved'),
('22222222-0001-0001-0001-000000000068', '11111111-0001-0001-0001-000000000008', 'Dressed Crab', 'Hand-picked dressed crab from the Devon coast.', 6.50, 'each', 'https://images.unsplash.com/photo-1550747528-cdb45925b3f7?w=800', 'Seafood', true, 'UK', 50.3700, -4.1400, 'approved'),
('22222222-0001-0001-0001-000000000069', '11111111-0001-0001-0001-000000000008', 'Fish Pie Mix', 'A mix of salmon, cod and smoked haddock pieces.', 5.50, 'per 500g', 'https://images.unsplash.com/photo-1580476262798-bddd9f4b7369?w=800', 'Fish', true, 'UK', 54.2800, 0.4000, 'approved'),
('22222222-0001-0001-0001-000000000070', '11111111-0001-0001-0001-000000000008', 'Scallops', 'Hand-dived Scottish scallops, sweet and tender.', 8.00, 'per 250g', 'https://images.unsplash.com/photo-1590759668628-05b0fc34bb70?w=800', 'Seafood', true, 'UK', 57.4800, -5.7100, 'approved');

-- 4. Insert Delivery Days (3 past, 3 future relative to ~24 Feb 2026)
INSERT INTO delivery_days (id, delivery_date, cutoff_date) VALUES
('33333333-0001-0001-0001-000000000001', '2026-02-10', '2026-02-08'),
('33333333-0001-0001-0001-000000000002', '2026-02-14', '2026-02-12'),
('33333333-0001-0001-0001-000000000003', '2026-02-21', '2026-02-19'),
('33333333-0001-0001-0001-000000000004', '2026-02-28', '2026-02-26'),
('33333333-0001-0001-0001-000000000005', '2026-03-07', '2026-03-05'),
('33333333-0001-0001-0001-000000000006', '2026-03-14', '2026-03-12');

-- 5. Insert Orders
-- Past orders (delivered/confirmed)
-- Order 1: Feb 10 delivery — delivered
INSERT INTO orders (id, user_id, total, status, delivery_day, created_at) VALUES
('44444444-0001-0001-0001-000000000001', 'user_demo_customer_001', 32.30, 'delivered', '2026-02-10', '2026-02-07 10:00:00');
INSERT INTO order_items (order_id, product_id, product_name, quantity, price, supplier_id, supplier_status) VALUES
('44444444-0001-0001-0001-000000000001', '22222222-0001-0001-0001-000000000001', 'Sourdough Country Loaf', 2, 3.80, '11111111-0001-0001-0001-000000000001', 'delivered'),
('44444444-0001-0001-0001-000000000001', '22222222-0001-0001-0001-000000000004', 'Croissants (Butter)', 3, 2.80, '11111111-0001-0001-0001-000000000001', 'delivered'),
('44444444-0001-0001-0001-000000000001', '22222222-0001-0001-0001-000000000026', 'Whole Milk', 2, 1.60, '11111111-0001-0001-0001-000000000004', 'delivered'),
('44444444-0001-0001-0001-000000000001', '22222222-0001-0001-0001-000000000009', 'Free-Range Eggs', 1, 3.20, '11111111-0001-0001-0001-000000000002', 'delivered'),
('44444444-0001-0001-0001-000000000001', '22222222-0001-0001-0001-000000000051', 'Derbyshire Beef Mince', 1, 6.80, '11111111-0001-0001-0001-000000000007', 'delivered'),
('44444444-0001-0001-0001-000000000001', '22222222-0001-0001-0001-000000000052', 'Pork Sausages (Traditional)', 1, 5.80, '11111111-0001-0001-0001-000000000007', 'delivered');

-- Order 2: Feb 10 delivery — delivered
INSERT INTO orders (id, user_id, total, status, delivery_day, created_at) VALUES
('44444444-0001-0001-0001-000000000002', 'user_demo_customer_002', 43.70, 'delivered', '2026-02-10', '2026-02-07 14:30:00');
INSERT INTO order_items (order_id, product_id, product_name, quantity, price, supplier_id, supplier_status) VALUES
('44444444-0001-0001-0001-000000000002', '22222222-0001-0001-0001-000000000006', 'Seasonal Vegetable Box (Small)', 1, 12.00, '11111111-0001-0001-0001-000000000002', 'delivered'),
('44444444-0001-0001-0001-000000000002', '22222222-0001-0001-0001-000000000061', 'Fresh Salmon Fillets', 1, 7.50, '11111111-0001-0001-0001-000000000008', 'delivered'),
('44444444-0001-0001-0001-000000000002', '22222222-0001-0001-0001-000000000031', 'Mature Cheddar', 2, 3.60, '11111111-0001-0001-0001-000000000005', 'delivered'),
('44444444-0001-0001-0001-000000000002', '22222222-0001-0001-0001-000000000037', 'Chutney (Caramelised Onion)', 1, 3.80, '11111111-0001-0001-0001-000000000005', 'delivered'),
('44444444-0001-0001-0001-000000000002', '22222222-0001-0001-0001-000000000041', 'Organic Porridge Oats', 2, 1.80, '11111111-0001-0001-0001-000000000006', 'delivered'),
('44444444-0001-0001-0001-000000000002', '22222222-0001-0001-0001-000000000046', 'Loose Coffee Beans', 1, 4.80, '11111111-0001-0001-0001-000000000006', 'delivered'),
('44444444-0001-0001-0001-000000000002', '22222222-0001-0001-0001-000000000001', 'Sourdough Country Loaf', 1, 3.80, '11111111-0001-0001-0001-000000000001', 'delivered');

-- Order 3: Feb 14 delivery — delivered
INSERT INTO orders (id, user_id, total, status, delivery_day, created_at) VALUES
('44444444-0001-0001-0001-000000000003', 'user_demo_customer_003', 52.80, 'delivered', '2026-02-14', '2026-02-11 09:15:00');
INSERT INTO order_items (order_id, product_id, product_name, quantity, price, supplier_id, supplier_status) VALUES
('44444444-0001-0001-0001-000000000003', '22222222-0001-0001-0001-000000000055', 'Sirloin Steak', 2, 8.50, '11111111-0001-0001-0001-000000000007', 'delivered'),
('44444444-0001-0001-0001-000000000003', '22222222-0001-0001-0001-000000000007', 'British Potatoes (Maris Piper)', 2, 1.80, '11111111-0001-0001-0001-000000000002', 'delivered'),
('44444444-0001-0001-0001-000000000003', '22222222-0001-0001-0001-000000000008', 'Carrots', 1, 1.20, '11111111-0001-0001-0001-000000000002', 'delivered'),
('44444444-0001-0001-0001-000000000003', '22222222-0001-0001-0001-000000000028', 'Double Cream', 2, 2.40, '11111111-0001-0001-0001-000000000004', 'delivered'),
('44444444-0001-0001-0001-000000000003', '22222222-0001-0001-0001-000000000036', 'Cheese Selection Box', 1, 14.00, '11111111-0001-0001-0001-000000000005', 'delivered'),
('44444444-0001-0001-0001-000000000003', '22222222-0001-0001-0001-000000000005', 'Focaccia (Rosemary & Sea Salt)', 1, 4.50, '11111111-0001-0001-0001-000000000001', 'delivered');

-- Order 4: Feb 14 delivery — confirmed
INSERT INTO orders (id, user_id, total, status, delivery_day, created_at) VALUES
('44444444-0001-0001-0001-000000000004', 'user_demo_customer_001', 29.60, 'confirmed', '2026-02-14', '2026-02-11 16:00:00');
INSERT INTO order_items (order_id, product_id, product_name, quantity, price, supplier_id, supplier_status) VALUES
('44444444-0001-0001-0001-000000000004', '22222222-0001-0001-0001-000000000062', 'Cod Loin', 1, 6.80, '11111111-0001-0001-0001-000000000008', 'dropped_at_depot'),
('44444444-0001-0001-0001-000000000004', '22222222-0001-0001-0001-000000000066', 'King Prawns', 1, 6.00, '11111111-0001-0001-0001-000000000008', 'dropped_at_depot'),
('44444444-0001-0001-0001-000000000004', '22222222-0001-0001-0001-000000000010', 'Mixed Salad Bag', 2, 2.50, '11111111-0001-0001-0001-000000000002', 'prepping'),
('44444444-0001-0001-0001-000000000004', '22222222-0001-0001-0001-000000000011', 'Vine Tomatoes', 1, 2.80, '11111111-0001-0001-0001-000000000002', 'prepping'),
('44444444-0001-0001-0001-000000000004', '22222222-0001-0001-0001-000000000003', 'Cinnamon Buns', 2, 3.20, '11111111-0001-0001-0001-000000000001', 'prepping'),
('44444444-0001-0001-0001-000000000004', '22222222-0001-0001-0001-000000000048', 'Dark Chocolate (Ethical)', 1, 3.50, '11111111-0001-0001-0001-000000000006', 'order_placed');

-- Order 5: Feb 21 delivery — confirmed
INSERT INTO orders (id, user_id, total, status, delivery_day, created_at) VALUES
('44444444-0001-0001-0001-000000000005', 'user_demo_customer_002', 38.90, 'confirmed', '2026-02-21', '2026-02-18 11:00:00');
INSERT INTO order_items (order_id, product_id, product_name, quantity, price, supplier_id, supplier_status) VALUES
('44444444-0001-0001-0001-000000000005', '22222222-0001-0001-0001-000000000017', 'Derbyshire Sausages', 2, 5.50, '11111111-0001-0001-0001-000000000003', 'prepping'),
('44444444-0001-0001-0001-000000000005', '22222222-0001-0001-0001-000000000020', 'Dry-Cured Back Bacon', 1, 4.80, '11111111-0001-0001-0001-000000000003', 'prepping'),
('44444444-0001-0001-0001-000000000005', '22222222-0001-0001-0001-000000000016', 'Local Free-Range Eggs', 2, 3.50, '11111111-0001-0001-0001-000000000003', 'prepping'),
('44444444-0001-0001-0001-000000000005', '22222222-0001-0001-0001-000000000002', 'Seeded Multigrain Loaf', 1, 4.20, '11111111-0001-0001-0001-000000000001', 'order_placed'),
('44444444-0001-0001-0001-000000000005', '22222222-0001-0001-0001-000000000029', 'Natural Yoghurt', 1, 2.80, '11111111-0001-0001-0001-000000000004', 'order_placed'),
('44444444-0001-0001-0001-000000000005', '22222222-0001-0001-0001-000000000030', 'Salted Farmhouse Butter', 1, 3.20, '11111111-0001-0001-0001-000000000004', 'order_placed');

-- Order 6: Feb 21 delivery — pending
INSERT INTO orders (id, user_id, total, status, delivery_day, created_at) VALUES
('44444444-0001-0001-0001-000000000006', 'user_demo_customer_003', 45.50, 'pending', '2026-02-21', '2026-02-19 08:45:00');
INSERT INTO order_items (order_id, product_id, product_name, quantity, price, supplier_id, supplier_status) VALUES
('44444444-0001-0001-0001-000000000006', '22222222-0001-0001-0001-000000000056', 'Whole Roasting Chicken', 1, 9.50, '11111111-0001-0001-0001-000000000007', 'order_placed'),
('44444444-0001-0001-0001-000000000006', '22222222-0001-0001-0001-000000000057', 'Diced Beef (Braising)', 1, 7.20, '11111111-0001-0001-0001-000000000007', 'order_placed'),
('44444444-0001-0001-0001-000000000006', '22222222-0001-0001-0001-000000000022', 'Seasonal Vegetable Box', 1, 15.00, '11111111-0001-0001-0001-000000000003', 'order_placed'),
('44444444-0001-0001-0001-000000000006', '22222222-0001-0001-0001-000000000026', 'Whole Milk', 2, 1.60, '11111111-0001-0001-0001-000000000004', 'order_placed'),
('44444444-0001-0001-0001-000000000006', '22222222-0001-0001-0001-000000000032', 'Stilton', 1, 4.20, '11111111-0001-0001-0001-000000000005', 'order_placed'),
('44444444-0001-0001-0001-000000000006', '22222222-0001-0001-0001-000000000038', 'Artisan Crackers', 1, 2.80, '11111111-0001-0001-0001-000000000005', 'order_placed'),
('44444444-0001-0001-0001-000000000006', '22222222-0001-0001-0001-000000000001', 'Sourdough Country Loaf', 1, 3.80, '11111111-0001-0001-0001-000000000001', 'order_placed');

-- Future orders
-- Order 7: Feb 28 delivery — pending
INSERT INTO orders (id, user_id, total, status, delivery_day, created_at) VALUES
('44444444-0001-0001-0001-000000000007', 'user_demo_customer_001', 51.20, 'pending', '2026-02-28', '2026-02-23 10:30:00');
INSERT INTO order_items (order_id, product_id, product_name, quantity, price, supplier_id, supplier_status) VALUES
('44444444-0001-0001-0001-000000000007', '22222222-0001-0001-0001-000000000061', 'Fresh Salmon Fillets', 2, 7.50, '11111111-0001-0001-0001-000000000008', 'order_placed'),
('44444444-0001-0001-0001-000000000007', '22222222-0001-0001-0001-000000000070', 'Scallops', 1, 8.00, '11111111-0001-0001-0001-000000000008', 'order_placed'),
('44444444-0001-0001-0001-000000000007', '22222222-0001-0001-0001-000000000005', 'Focaccia (Rosemary & Sea Salt)', 2, 4.50, '11111111-0001-0001-0001-000000000001', 'order_placed'),
('44444444-0001-0001-0001-000000000007', '22222222-0001-0001-0001-000000000031', 'Mature Cheddar', 1, 3.60, '11111111-0001-0001-0001-000000000005', 'order_placed'),
('44444444-0001-0001-0001-000000000007', '22222222-0001-0001-0001-000000000040', 'Continental Cheese Board Mix', 1, 18.00, '11111111-0001-0001-0001-000000000005', 'order_placed');

-- Order 8: Feb 28 delivery — pending
INSERT INTO orders (id, user_id, total, status, delivery_day, created_at) VALUES
('44444444-0001-0001-0001-000000000008', 'user_demo_customer_002', 36.40, 'pending', '2026-02-28', '2026-02-23 15:00:00');
INSERT INTO order_items (order_id, product_id, product_name, quantity, price, supplier_id, supplier_status) VALUES
('44444444-0001-0001-0001-000000000008', '22222222-0001-0001-0001-000000000053', 'Chicken Breasts', 2, 6.50, '11111111-0001-0001-0001-000000000007', 'order_placed'),
('44444444-0001-0001-0001-000000000008', '22222222-0001-0001-0001-000000000054', 'Dry-Cured Back Bacon', 1, 4.90, '11111111-0001-0001-0001-000000000007', 'order_placed'),
('44444444-0001-0001-0001-000000000008', '22222222-0001-0001-0001-000000000008', 'Carrots', 2, 1.20, '11111111-0001-0001-0001-000000000002', 'order_placed'),
('44444444-0001-0001-0001-000000000008', '22222222-0001-0001-0001-000000000014', 'Broccoli', 2, 1.60, '11111111-0001-0001-0001-000000000002', 'order_placed'),
('44444444-0001-0001-0001-000000000008', '22222222-0001-0001-0001-000000000026', 'Whole Milk', 2, 1.60, '11111111-0001-0001-0001-000000000004', 'order_placed'),
('44444444-0001-0001-0001-000000000008', '22222222-0001-0001-0001-000000000042', 'Dried Pasta (Refill)', 1, 2.20, '11111111-0001-0001-0001-000000000006', 'order_placed'),
('44444444-0001-0001-0001-000000000008', '22222222-0001-0001-0001-000000000045', 'Olive Oil (Refill)', 1, 5.50, '11111111-0001-0001-0001-000000000006', 'order_placed');

-- Order 9: Mar 7 delivery — pending
INSERT INTO orders (id, user_id, total, status, delivery_day, created_at) VALUES
('44444444-0001-0001-0001-000000000009', 'user_demo_customer_003', 42.10, 'pending', '2026-03-07', '2026-02-24 09:00:00');
INSERT INTO order_items (order_id, product_id, product_name, quantity, price, supplier_id, supplier_status) VALUES
('44444444-0001-0001-0001-000000000009', '22222222-0001-0001-0001-000000000001', 'Sourdough Country Loaf', 2, 3.80, '11111111-0001-0001-0001-000000000001', 'order_placed'),
('44444444-0001-0001-0001-000000000009', '22222222-0001-0001-0001-000000000003', 'Cinnamon Buns', 4, 3.20, '11111111-0001-0001-0001-000000000001', 'order_placed'),
('44444444-0001-0001-0001-000000000009', '22222222-0001-0001-0001-000000000063', 'Haddock Fillets', 1, 5.80, '11111111-0001-0001-0001-000000000008', 'order_placed'),
('44444444-0001-0001-0001-000000000009', '22222222-0001-0001-0001-000000000069', 'Fish Pie Mix', 1, 5.50, '11111111-0001-0001-0001-000000000008', 'order_placed'),
('44444444-0001-0001-0001-000000000009', '22222222-0001-0001-0001-000000000006', 'Seasonal Vegetable Box (Small)', 1, 12.00, '11111111-0001-0001-0001-000000000002', 'order_placed');

-- Order 10: Mar 7 delivery — pending
INSERT INTO orders (id, user_id, total, status, delivery_day, created_at) VALUES
('44444444-0001-0001-0001-000000000010', 'user_demo_customer_001', 33.80, 'pending', '2026-03-07', '2026-02-24 12:00:00');
INSERT INTO order_items (order_id, product_id, product_name, quantity, price, supplier_id, supplier_status) VALUES
('44444444-0001-0001-0001-000000000010', '22222222-0001-0001-0001-000000000017', 'Derbyshire Sausages', 1, 5.50, '11111111-0001-0001-0001-000000000003', 'order_placed'),
('44444444-0001-0001-0001-000000000010', '22222222-0001-0001-0001-000000000025', 'Homemade Pork Pies', 2, 3.80, '11111111-0001-0001-0001-000000000003', 'order_placed'),
('44444444-0001-0001-0001-000000000010', '22222222-0001-0001-0001-000000000023', 'Local Honey', 1, 6.00, '11111111-0001-0001-0001-000000000003', 'order_placed'),
('44444444-0001-0001-0001-000000000010', '22222222-0001-0001-0001-000000000027', 'Semi-Skimmed Milk', 2, 1.60, '11111111-0001-0001-0001-000000000004', 'order_placed'),
('44444444-0001-0001-0001-000000000010', '22222222-0001-0001-0001-000000000050', 'Local Honey', 1, 6.50, '11111111-0001-0001-0001-000000000006', 'order_placed');

-- Order 11: Mar 14 delivery — pending
INSERT INTO orders (id, user_id, total, status, delivery_day, created_at) VALUES
('44444444-0001-0001-0001-000000000011', 'user_demo_customer_002', 58.40, 'pending', '2026-03-14', '2026-02-24 14:30:00');
INSERT INTO order_items (order_id, product_id, product_name, quantity, price, supplier_id, supplier_status) VALUES
('44444444-0001-0001-0001-000000000011', '22222222-0001-0001-0001-000000000060', 'Lamb Shoulder', 1, 12.00, '11111111-0001-0001-0001-000000000007', 'order_placed'),
('44444444-0001-0001-0001-000000000011', '22222222-0001-0001-0001-000000000058', 'Pork Chops', 1, 6.00, '11111111-0001-0001-0001-000000000007', 'order_placed'),
('44444444-0001-0001-0001-000000000011', '22222222-0001-0001-0001-000000000007', 'British Potatoes (Maris Piper)', 3, 1.80, '11111111-0001-0001-0001-000000000002', 'order_placed'),
('44444444-0001-0001-0001-000000000011', '22222222-0001-0001-0001-000000000012', 'Red Onions', 2, 1.50, '11111111-0001-0001-0001-000000000002', 'order_placed'),
('44444444-0001-0001-0001-000000000011', '22222222-0001-0001-0001-000000000015', 'Courgettes', 1, 2.20, '11111111-0001-0001-0001-000000000002', 'order_placed'),
('44444444-0001-0001-0001-000000000011', '22222222-0001-0001-0001-000000000035', 'Camembert-Style Soft Cheese', 1, 4.50, '11111111-0001-0001-0001-000000000005', 'order_placed'),
('44444444-0001-0001-0001-000000000011', '22222222-0001-0001-0001-000000000034', 'Goats Cheese Log', 1, 3.80, '11111111-0001-0001-0001-000000000005', 'order_placed'),
('44444444-0001-0001-0001-000000000011', '22222222-0001-0001-0001-000000000002', 'Seeded Multigrain Loaf', 2, 4.20, '11111111-0001-0001-0001-000000000001', 'order_placed'),
('44444444-0001-0001-0001-000000000011', '22222222-0001-0001-0001-000000000064', 'Sea Bass (Whole)', 2, 5.50, '11111111-0001-0001-0001-000000000008', 'order_placed');

-- Order 12: Mar 14 delivery — pending
INSERT INTO orders (id, user_id, total, status, delivery_day, created_at) VALUES
('44444444-0001-0001-0001-000000000012', 'user_demo_customer_003', 27.30, 'pending', '2026-03-14', '2026-02-24 16:00:00');
INSERT INTO order_items (order_id, product_id, product_name, quantity, price, supplier_id, supplier_status) VALUES
('44444444-0001-0001-0001-000000000012', '22222222-0001-0001-0001-000000000043', 'Basmati Rice', 1, 2.50, '11111111-0001-0001-0001-000000000006', 'order_placed'),
('44444444-0001-0001-0001-000000000012', '22222222-0001-0001-0001-000000000046', 'Loose Coffee Beans', 2, 4.80, '11111111-0001-0001-0001-000000000006', 'order_placed'),
('44444444-0001-0001-0001-000000000012', '22222222-0001-0001-0001-000000000047', 'Herbal Loose-Leaf Tea', 1, 3.20, '11111111-0001-0001-0001-000000000006', 'order_placed'),
('44444444-0001-0001-0001-000000000012', '22222222-0001-0001-0001-000000000065', 'Smoked Mackerel Fillets', 2, 4.20, '11111111-0001-0001-0001-000000000008', 'order_placed'),
('44444444-0001-0001-0001-000000000012', '22222222-0001-0001-0001-000000000013', 'Braeburn Apples', 1, 2.40, '11111111-0001-0001-0001-000000000002', 'order_placed'),
('44444444-0001-0001-0001-000000000012', '22222222-0001-0001-0001-000000000029', 'Natural Yoghurt', 1, 2.80, '11111111-0001-0001-0001-000000000004', 'order_placed');
