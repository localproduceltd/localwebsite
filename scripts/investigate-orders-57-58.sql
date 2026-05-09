-- ============================================================================
-- INVESTIGATION: Orders 57 & 58 Duplicate Issue
-- Run these queries in Supabase SQL Editor
-- ============================================================================

-- 1. OVERVIEW: Compare both orders side by side
-- This shows the key fields to understand what happened
SELECT 
  order_number,
  id as order_id,
  customer_email,
  total,
  status,
  delivery_day,
  created_at,
  stripe_session_id,
  address_line1,
  postcode
FROM orders 
WHERE order_number IN (57, 58)
ORDER BY order_number;

-- 2. ORDER ITEMS: What items are in each order?
-- This shows if Order 58 is truly a duplicate of the top-up items
SELECT 
  o.order_number,
  o.created_at as order_created,
  oi.id as item_id,
  oi.product_name,
  oi.quantity,
  oi.price,
  oi.quantity * oi.price as line_total,
  s.name as supplier_name,
  oi.supplier_status
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
LEFT JOIN suppliers s ON s.id = oi.supplier_id
WHERE o.order_number IN (57, 58)
ORDER BY o.order_number, oi.product_name;

-- 3. STRIPE SESSION CHECK: Do both orders share the same session?
-- If stripe_session_id is the same, confirms the webhook created a duplicate
SELECT 
  order_number,
  stripe_session_id,
  created_at,
  total
FROM orders 
WHERE order_number IN (57, 58)
  AND stripe_session_id IS NOT NULL;

-- 4. BUTCHER'S VIEW: What did the butcher see?
-- Adjust the supplier name filter to match your butcher
SELECT 
  o.order_number,
  oi.product_name,
  oi.quantity,
  oi.price,
  oi.supplier_status,
  o.delivery_day,
  o.created_at as order_created
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN suppliers s ON s.id = oi.supplier_id
WHERE o.order_number IN (57, 58)
  AND s.name ILIKE '%butcher%'  -- Adjust this to match the butcher's name
ORDER BY o.order_number;

-- 5. ITEMS COMPARISON: Are Order 58 items duplicates of items in Order 57?
-- This compares product_id and quantity between the two orders
SELECT 
  oi57.product_name,
  oi57.quantity as qty_in_57,
  oi58.quantity as qty_in_58,
  CASE WHEN oi57.quantity = oi58.quantity THEN 'DUPLICATE' ELSE 'DIFFERENT' END as match_status
FROM order_items oi57
JOIN orders o57 ON o57.id = oi57.order_id AND o57.order_number = 57
JOIN order_items oi58 ON oi58.product_id = oi57.product_id
JOIN orders o58 ON o58.id = oi58.order_id AND o58.order_number = 58;

-- 6. CUSTOMER PAYMENT SUMMARY
-- What should the customer have paid vs what orders show
SELECT 
  order_number,
  total as order_total,
  (SELECT SUM(quantity * price) FROM order_items WHERE order_id = orders.id) as items_subtotal,
  stripe_session_id
FROM orders 
WHERE order_number IN (57, 58);

-- 7. ALL SUPPLIERS AFFECTED: Which suppliers got items in both orders?
SELECT DISTINCT
  s.name as supplier_name,
  s.email as supplier_email,
  o.order_number
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN suppliers s ON s.id = oi.supplier_id
WHERE o.order_number IN (57, 58)
ORDER BY s.name, o.order_number;

-- 8. FULL ORDER 57 DETAILS: See everything in the original order
SELECT 
  oi.product_name,
  oi.quantity,
  oi.price,
  oi.quantity * oi.price as line_total,
  s.name as supplier_name
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
LEFT JOIN suppliers s ON s.id = oi.supplier_id
WHERE o.order_number = 57
ORDER BY s.name, oi.product_name;

-- 9. FULL ORDER 58 DETAILS: See everything in the duplicate order
SELECT 
  oi.product_name,
  oi.quantity,
  oi.price,
  oi.quantity * oi.price as line_total,
  s.name as supplier_name
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
LEFT JOIN suppliers s ON s.id = oi.supplier_id
WHERE o.order_number = 58
ORDER BY s.name, oi.product_name;

-- ============================================================================
-- CLEANUP QUERIES (Run after investigation, if needed)
-- ============================================================================

-- CAUTION: Only run these after confirming Order 58 is a duplicate!

-- To see what would be deleted from Order 58:
-- SELECT * FROM order_items WHERE order_id = (SELECT id FROM orders WHERE order_number = 58);

-- To delete Order 58 items:
-- DELETE FROM order_items WHERE order_id = (SELECT id FROM orders WHERE order_number = 58);

-- To delete Order 58:
-- DELETE FROM orders WHERE order_number = 58;
