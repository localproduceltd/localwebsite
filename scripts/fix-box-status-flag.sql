-- Fix has_outstanding_box flag for customers
-- The flag was incorrectly being set at checkout instead of delivery
-- This resets the flag for customers who haven't actually received a box yet
-- Run this in Supabase SQL Editor

-- First, see what will be affected
SELECT 
  cp.clerk_user_id,
  cp.has_outstanding_box,
  o.order_number,
  o.status,
  o.box_deposit_paid
FROM customer_profiles cp
JOIN orders o ON o.user_id = cp.clerk_user_id
WHERE cp.has_outstanding_box = true
  AND o.box_deposit_paid = true
ORDER BY cp.clerk_user_id, o.order_number;

-- Reset the flag for customers who:
-- 1. Have paid a box deposit on at least one order that is NOT delivered yet
-- 2. Do NOT have any delivered orders with box deposit (i.e. they've never actually received a box)
UPDATE customer_profiles
SET has_outstanding_box = false, updated_at = NOW()
WHERE clerk_user_id IN (
  SELECT DISTINCT user_id FROM orders
  WHERE box_deposit_paid = true
    AND status != 'delivered'
)
AND clerk_user_id NOT IN (
  SELECT DISTINCT user_id FROM orders
  WHERE box_deposit_paid = true
    AND status = 'delivered'
);

-- Verify the fix
SELECT 
  cp.clerk_user_id,
  cp.has_outstanding_box,
  o.order_number,
  o.status,
  o.box_deposit_paid
FROM customer_profiles cp
JOIN orders o ON o.user_id = cp.clerk_user_id
WHERE o.box_deposit_paid = true
ORDER BY cp.clerk_user_id, o.order_number;
