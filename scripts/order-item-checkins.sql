-- Order Item Check-ins
-- Tracks per-order-item check-ins as the source of truth for "arrived" quantities
-- Run this in Supabase SQL Editor

-- Create the order_item_checkins table
CREATE TABLE IF NOT EXISTS order_item_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  checked_in_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id, supplier_id, product_name)
);

-- Add override column to delivery_stock_tracking for manual entries
ALTER TABLE delivery_stock_tracking 
ADD COLUMN IF NOT EXISTS quantity_arrived_override INTEGER DEFAULT NULL;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_order_item_checkins_order ON order_item_checkins(order_id);
CREATE INDEX IF NOT EXISTS idx_order_item_checkins_supplier ON order_item_checkins(supplier_id);
CREATE INDEX IF NOT EXISTS idx_order_item_checkins_product ON order_item_checkins(product_name);

-- Enable RLS
ALTER TABLE order_item_checkins ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (admin)
CREATE POLICY "Allow all for authenticated" ON order_item_checkins
  FOR ALL USING (true) WITH CHECK (true);

-- View to compute arrived quantities from check-ins
-- This joins orders to get delivery_day, then sums checked-in quantities
CREATE OR REPLACE VIEW computed_stock_arrivals AS
SELECT 
  o.delivery_day,
  c.supplier_id,
  c.product_name,
  SUM(c.quantity) as computed_arrived
FROM order_item_checkins c
JOIN orders o ON o.id = c.order_id
WHERE o.status != 'cancelled'
GROUP BY o.delivery_day, c.supplier_id, c.product_name;
