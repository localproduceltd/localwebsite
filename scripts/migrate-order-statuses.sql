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

-- Migrate pending → ordered
UPDATE orders 
SET status = 'ordered' 
WHERE status = 'pending';

-- Migrate confirmed → ordered
UPDATE orders 
SET status = 'ordered' 
WHERE status = 'confirmed';

-- Verify the migration
SELECT status, COUNT(*) as count 
FROM orders 
GROUP BY status 
ORDER BY status;
