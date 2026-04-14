-- Add priority field for supplier ordering
-- 1 = top priority (shows first)
-- 2 = medium priority
-- 3 = low priority (shows last)

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 2;

-- Set all existing suppliers to priority 2 by default
UPDATE suppliers SET priority = 2 WHERE priority IS NULL;
