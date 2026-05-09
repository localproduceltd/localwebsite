-- Delete orders 59 and 60 and their associated order items
-- Run this in Supabase SQL Editor

-- First delete order items (child records)
DELETE FROM order_items
WHERE order_id IN (
  SELECT id FROM orders WHERE order_number IN (59, 60)
);

-- Then delete the orders
DELETE FROM orders
WHERE order_number IN (59, 60);
