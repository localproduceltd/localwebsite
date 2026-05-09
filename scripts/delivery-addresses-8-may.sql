-- Delivery addresses for orders on 8th May 2026
-- Run this in Supabase SQL Editor

-- For orders with address stored directly (new orders)
-- Falls back to customer_profiles for older orders
SELECT 
  o.order_number,
  o.customer_email,
  o.delivery_day,
  o.delivery_window,
  o.will_be_in,
  o.safe_place,
  COALESCE(o.address_line1, cp.address_line1) AS address_line1,
  COALESCE(o.address_line2, cp.address_line2) AS address_line2,
  COALESCE(o.city, cp.city) AS city,
  COALESCE(o.postcode, cp.postcode) AS postcode
FROM orders o
LEFT JOIN customer_profiles cp ON o.user_id = cp.clerk_user_id
WHERE o.delivery_day = '2026-05-08'
ORDER BY o.order_number;
