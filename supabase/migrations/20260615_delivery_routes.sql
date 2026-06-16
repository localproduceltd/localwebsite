-- Delivery routes table for storing optimized route order
-- This allows the driver page to show deliveries in the correct sequence

CREATE TABLE IF NOT EXISTS delivery_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_day DATE NOT NULL,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_number INTEGER NOT NULL,
  route_position INTEGER NOT NULL,
  leg TEXT NOT NULL DEFAULT 'morning', -- 'morning' or 'afternoon'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Each order can only appear once per delivery day
  UNIQUE(delivery_day, order_id),
  -- Each position can only be used once per leg per day
  UNIQUE(delivery_day, leg, route_position)
);

-- Index for fast lookups by delivery day
CREATE INDEX idx_delivery_routes_day ON delivery_routes(delivery_day);

-- Enable RLS
ALTER TABLE delivery_routes ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Allow authenticated read" ON delivery_routes
  FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to insert/update/delete (admin operations)
CREATE POLICY "Allow authenticated write" ON delivery_routes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow service role full access
CREATE POLICY "Allow service role all" ON delivery_routes
  FOR ALL TO service_role USING (true);
