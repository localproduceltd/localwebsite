-- Quick investigation: Run all at once

-- 1. Both orders overview
SELECT 
  order_number,
  total,
  status,
  delivery_day,
  created_at,
  stripe_session_id
FROM orders 
WHERE order_number IN (57, 58)
ORDER BY order_number;

-- 2. All items in Order 57 (original order)
SELECT 
  'Order 57' as order_num,
  oi.product_name,
  oi.quantity,
  oi.price,
  s.name as supplier_name
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
LEFT JOIN suppliers s ON s.id = oi.supplier_id
WHERE o.order_number = 57
ORDER BY s.name, oi.product_name;

-- 3. All items in Order 58 (duplicate/top-up order)
SELECT 
  'Order 58' as order_num,
  oi.product_name,
  oi.quantity,
  oi.price,
  s.name as supplier_name
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
LEFT JOIN suppliers s ON s.id = oi.supplier_id
WHERE o.order_number = 58
ORDER BY s.name, oi.product_name;

-- 4. Butcher items across both orders
SELECT 
  o.order_number,
  oi.product_name,
  oi.quantity,
  oi.price
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN suppliers s ON s.id = oi.supplier_id
WHERE o.order_number IN (57, 58)
  AND s.name ILIKE '%anthony%'
ORDER BY o.order_number, oi.product_name;
