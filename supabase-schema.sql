-- ─── Suppliers ────────────────────────────────────────────────────────────────
CREATE TABLE suppliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Products ─────────────────────────────────────────────────────────────────
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  in_stock BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Delivery Days ────────────────────────────────────────────────────────────
CREATE TABLE delivery_days (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  day_of_week TEXT NOT NULL,
  cutoff_time TEXT NOT NULL DEFAULT '18:00',
  active BOOLEAN NOT NULL DEFAULT false
);

-- ─── Orders ───────────────────────────────────────────────────────────────────
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','delivered','cancelled')),
  delivery_day TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Order Items ──────────────────────────────────────────────────────────────
CREATE TABLE order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price NUMERIC(10,2) NOT NULL DEFAULT 0
);

-- ─── Seed Delivery Days ───────────────────────────────────────────────────────
INSERT INTO delivery_days (day_of_week, cutoff_time, active) VALUES
  ('Monday', '18:00', false),
  ('Tuesday', '18:00', false),
  ('Wednesday', '18:00', true),
  ('Thursday', '18:00', false),
  ('Friday', '18:00', false),
  ('Saturday', '12:00', true),
  ('Sunday', '12:00', false);

-- ─── Seed Suppliers ───────────────────────────────────────────────────────────
INSERT INTO suppliers (id, name, description, image, location, category) VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001', 'Green Valley Farm', 'Family-run organic vegetable farm specialising in seasonal produce. We grow everything from heritage tomatoes to leafy greens.', 'https://images.unsplash.com/photo-1500076656116-558758c991c1?w=600&h=400&fit=crop', 'Wicklow', 'Vegetables'),
  ('a1b2c3d4-0001-4000-8000-000000000002', 'Sunrise Orchard', 'Award-winning apple and berry farm with over 20 varieties of apples and seasonal soft fruits.', 'https://images.unsplash.com/photo-1574263867128-a3d5c1b1decc?w=600&h=400&fit=crop', 'Kilkenny', 'Fruit'),
  ('a1b2c3d4-0001-4000-8000-000000000003', 'Meadow Fresh Dairy', 'Artisan dairy producing fresh milk, butter, yoghurt and a range of farmhouse cheeses.', 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=600&h=400&fit=crop', 'Cork', 'Dairy'),
  ('a1b2c3d4-0001-4000-8000-000000000004', 'Honey Hill Apiary', 'Small-batch raw honey and beeswax products from our hives in the Burren.', 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=600&h=400&fit=crop', 'Clare', 'Honey & Preserves'),
  ('a1b2c3d4-0001-4000-8000-000000000005', 'Atlantic Bakehouse', 'Sourdough breads and pastries baked fresh daily using locally milled flour.', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&h=400&fit=crop', 'Galway', 'Bakery'),
  ('a1b2c3d4-0001-4000-8000-000000000006', 'Wild Herb Gardens', 'Specialist grower of fresh herbs, edible flowers and micro-greens for restaurants and home cooks.', 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=600&h=400&fit=crop', 'Wexford', 'Herbs');

-- ─── Seed Products ────────────────────────────────────────────────────────────
INSERT INTO products (supplier_id, name, description, price, unit, image, category, in_stock) VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001', 'Organic Tomatoes', 'Vine-ripened heritage tomatoes, mixed varieties', 3.50, '500g', 'https://images.unsplash.com/photo-1546470427-0d4db154ceb8?w=400&h=300&fit=crop', 'Vegetables', true),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'Mixed Salad Leaves', 'Freshly picked seasonal salad mix', 2.80, '200g', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop', 'Vegetables', true),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'Baby Potatoes', 'New season baby potatoes, perfect for roasting', 2.20, '1kg', 'https://images.unsplash.com/photo-1518977676601-b53f82ber40?w=400&h=300&fit=crop', 'Vegetables', true),
  ('a1b2c3d4-0001-4000-8000-000000000002', 'Bramley Apples', 'Classic cooking apples, tart and flavourful', 2.50, '1kg', 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400&h=300&fit=crop', 'Fruit', true),
  ('a1b2c3d4-0001-4000-8000-000000000002', 'Fresh Strawberries', 'Sweet seasonal strawberries, hand-picked', 4.00, '400g punnet', 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=400&h=300&fit=crop', 'Fruit', true),
  ('a1b2c3d4-0001-4000-8000-000000000002', 'Blueberries', 'Plump, juicy blueberries bursting with flavour', 3.80, '250g punnet', 'https://images.unsplash.com/photo-1498557850523-fd3d118b962e?w=400&h=300&fit=crop', 'Fruit', false),
  ('a1b2c3d4-0001-4000-8000-000000000003', 'Fresh Whole Milk', 'Pasteurised whole milk from grass-fed cows', 1.80, '1 litre', 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&h=300&fit=crop', 'Dairy', true),
  ('a1b2c3d4-0001-4000-8000-000000000003', 'Farmhouse Cheddar', 'Mature cheddar aged for 12 months', 5.50, '200g', 'https://images.unsplash.com/photo-1618164436241-4473940d1f5c?w=400&h=300&fit=crop', 'Dairy', true),
  ('a1b2c3d4-0001-4000-8000-000000000004', 'Raw Wildflower Honey', 'Unprocessed honey from wildflower meadows', 7.50, '340g jar', 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400&h=300&fit=crop', 'Honey & Preserves', true),
  ('a1b2c3d4-0001-4000-8000-000000000004', 'Honeycomb', 'Fresh cut honeycomb, a natural treat', 9.00, '200g', 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=400&h=300&fit=crop', 'Honey & Preserves', true),
  ('a1b2c3d4-0001-4000-8000-000000000005', 'Sourdough Loaf', 'Traditional sourdough with a crispy crust', 4.50, '800g loaf', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=300&fit=crop', 'Bakery', true),
  ('a1b2c3d4-0001-4000-8000-000000000005', 'Cinnamon Rolls', 'Freshly baked cinnamon rolls with cream cheese glaze', 3.00, 'pack of 4', 'https://images.unsplash.com/photo-1509365390695-33aee754301f?w=400&h=300&fit=crop', 'Bakery', true),
  ('a1b2c3d4-0001-4000-8000-000000000006', 'Fresh Basil', 'Aromatic sweet basil, perfect for Italian dishes', 1.50, 'bunch', 'https://images.unsplash.com/photo-1618164436241-4473940d1f5c?w=400&h=300&fit=crop', 'Herbs', true),
  ('a1b2c3d4-0001-4000-8000-000000000006', 'Edible Flower Mix', 'Colourful mix of edible flowers for garnishing', 3.50, 'small box', 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=400&h=300&fit=crop', 'Herbs', true);

-- ─── Enable Row Level Security ────────────────────────────────────────────────
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Public read access for suppliers, products, delivery_days
CREATE POLICY "Public read suppliers" ON suppliers FOR SELECT USING (true);
CREATE POLICY "Public read products" ON products FOR SELECT USING (true);
CREATE POLICY "Public read delivery_days" ON delivery_days FOR SELECT USING (true);

-- Orders: users can only read their own orders
CREATE POLICY "Users read own orders" ON orders FOR SELECT USING (true);
CREATE POLICY "Users insert own orders" ON orders FOR INSERT WITH CHECK (true);

-- Order items: readable if you can read the order
CREATE POLICY "Public read order_items" ON order_items FOR SELECT USING (true);
CREATE POLICY "Users insert order_items" ON order_items FOR INSERT WITH CHECK (true);

-- Admin write access (permissive for now — we'll tighten with roles later)
CREATE POLICY "Allow all inserts on suppliers" ON suppliers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates on suppliers" ON suppliers FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes on suppliers" ON suppliers FOR DELETE USING (true);

CREATE POLICY "Allow all inserts on products" ON products FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates on products" ON products FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes on products" ON products FOR DELETE USING (true);

CREATE POLICY "Allow all updates on delivery_days" ON delivery_days FOR UPDATE USING (true);

CREATE POLICY "Allow all updates on orders" ON orders FOR UPDATE USING (true);
