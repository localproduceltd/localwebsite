-- Add unit column to order_items table
-- This captures the pack size at time of order (snapshot)
-- Run this in Supabase SQL Editor

-- Add the column
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT '';

-- Backfill existing rows from the products table
UPDATE order_items oi
SET unit = COALESCE(p.unit, '')
FROM products p
WHERE oi.product_id = p.id
  AND oi.unit = '';

-- Verify the backfill
SELECT 
  oi.product_name,
  oi.unit,
  oi.quantity,
  p.unit as current_product_unit
FROM order_items oi
LEFT JOIN products p ON p.id = oi.product_id
LIMIT 20;
