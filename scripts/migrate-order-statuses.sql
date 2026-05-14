-- ============================================================================
-- Migrate Order Statuses
-- Run this in Supabase SQL Editor
-- ============================================================================
-- 
-- Old statuses: pending, confirmed, delivered, cancelled
-- New statuses: ordered, prepped, next_hour, delivered, cancelled
--
-- Migration:
--   pending   → ordered
--   confirmed → ordered
--   delivered → delivered (no change)
--   cancelled → cancelled (no change)
-- ============================================================================

-- First, let's see what we have
SELECT status, COUNT(*) as count 
FROM orders 
GROUP BY status 
ORDER BY status;

-- Step 1: Drop the old constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Step 2: Migrate pending → ordered
UPDATE orders 
SET status = 'ordered' 
WHERE status = 'pending';

-- Step 3: Migrate confirmed → ordered
UPDATE orders 
SET status = 'ordered' 
WHERE status = 'confirmed';

-- Step 4: Add new constraint with updated values
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
CHECK (status IN ('ordered', 'prepped', 'next_hour', 'delivered', 'cancelled'));

-- Verify the migration
SELECT status, COUNT(*) as count 
FROM orders 
GROUP BY status 
ORDER BY status;
