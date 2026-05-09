-- Delivery tracking for arrivals and refunds
-- Run this in Supabase SQL Editor

-- Track arrival quantities and issues at the stock level (per supplier per delivery day)
CREATE TABLE IF NOT EXISTS delivery_stock_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_day DATE NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  product_name TEXT NOT NULL,
  quantity_ordered INTEGER NOT NULL,
  quantity_arrived INTEGER,
  arrival_notes TEXT,
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(delivery_day, supplier_id, product_name)
);

-- Track refunds at the order item level
CREATE TABLE IF NOT EXISTS order_item_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  product_name TEXT NOT NULL,
  quantity_refunded INTEGER NOT NULL DEFAULT 0,
  refund_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  refund_reason TEXT,
  refunded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_delivery_stock_tracking_day ON delivery_stock_tracking(delivery_day);
CREATE INDEX IF NOT EXISTS idx_delivery_stock_tracking_supplier ON delivery_stock_tracking(supplier_id);
CREATE INDEX IF NOT EXISTS idx_order_item_refunds_order ON order_item_refunds(order_id);

-- Enable RLS
ALTER TABLE delivery_stock_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_refunds ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (admin)
CREATE POLICY "Allow all for authenticated" ON delivery_stock_tracking
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated" ON order_item_refunds
  FOR ALL USING (true) WITH CHECK (true);
