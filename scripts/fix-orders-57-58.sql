-- ============================================================================
-- FIX: Orders 57 & 58 Duplicate Items
-- Run these in order in Supabase SQL Editor
-- ============================================================================

-- STEP 1: Preview what we're going to delete from Order 57
-- We need to delete ONE of each duplicate sausage item
SELECT 
  oi.id as item_id_to_delete,
  oi.product_name,
  oi.quantity,
  oi.price
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
WHERE o.order_number = 57
  AND oi.product_name IN ('Pork and Tomato Sausages (Thin)', 'Pork Sausages (Thin)')
ORDER BY oi.product_name, oi.id;

-- STEP 2: Delete ONE duplicate of each sausage from Order 57
-- This keeps the first one and deletes duplicates
DELETE FROM order_items
WHERE id IN (
  SELECT id FROM (
    SELECT 
      oi.id,
      oi.product_name,
      ROW_NUMBER() OVER (PARTITION BY oi.product_name ORDER BY oi.id) as rn
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.order_number = 57
      AND oi.product_name IN ('Pork and Tomato Sausages (Thin)', 'Pork Sausages (Thin)')
  ) ranked
  WHERE rn > 1  -- Delete all but the first occurrence
);

-- STEP 3: Update Order 57 total (subtract the duplicate £7.90)
UPDATE orders 
SET total = total - 7.90
WHERE order_number = 57;

-- STEP 4: Delete Order 58 items
DELETE FROM order_items 
WHERE order_id = (SELECT id FROM orders WHERE order_number = 58);

-- STEP 5: Delete Order 58
DELETE FROM orders WHERE order_number = 58;

-- ============================================================================
-- VERIFY: Run these after the fix to confirm
-- ============================================================================

-- Check Order 57 now has correct items
SELECT 
  oi.product_name,
  oi.quantity,
  oi.price,
  s.name as supplier_name
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
LEFT JOIN suppliers s ON s.id = oi.supplier_id
WHERE o.order_number = 57
  AND s.name ILIKE '%anthony%'
ORDER BY oi.product_name;

-- Check Order 57 total
SELECT order_number, total FROM orders WHERE order_number = 57;

-- Confirm Order 58 is gone
SELECT * FROM orders WHERE order_number = 58;
