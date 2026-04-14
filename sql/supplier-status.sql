-- Add supplier status field
-- Status options: 'live', 'not_live', 'pl_live', 'pl_coming_soon'
-- live = shows on both pre-launch and launch
-- not_live = hidden everywhere
-- pl_live = shows on pre-launch only (normal display)
-- pl_coming_soon = shows on pre-launch only (with "Coming Soon" banner)

-- Add the status column (default to 'live' for backwards compatibility)
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'live';

-- Update suppliers based on the order shown in admin:
-- 1. Loaf Bakery = pl_coming_soon
-- 2. Fresh Choice Ashbourne = pl_live
-- 3. Hulland Ward Farm Shop = pl_live
-- 4. Inn Farm Dairy = pl_coming_soon
-- 5. Cheddar Gorge, Ashbourne = pl_live
-- 6. The Zero Waste Shop Wirksworth = pl_coming_soon
-- 7. Barry Fitch Butchers = pl_coming_soon
-- 8. The Fish Man, Ashbourne = pl_live
-- 9. Fresh Choice = not_live
-- 10. Cheddar Gorge = not_live

UPDATE suppliers SET status = 'pl_coming_soon' WHERE name = 'Loaf Bakery';
UPDATE suppliers SET status = 'pl_live' WHERE name = 'Fresh Choice Ashbourne';
UPDATE suppliers SET status = 'pl_live' WHERE name = 'Hulland Ward Farm Shop';
UPDATE suppliers SET status = 'pl_coming_soon' WHERE name = 'Inn Farm Dairy';
UPDATE suppliers SET status = 'pl_live' WHERE name = 'Cheddar Gorge, Ashbourne';
UPDATE suppliers SET status = 'pl_coming_soon' WHERE name = 'The Zero Waste Shop Wirksworth';
UPDATE suppliers SET status = 'pl_coming_soon' WHERE name = 'Barry Fitch Butchers';
UPDATE suppliers SET status = 'pl_live' WHERE name = 'The Fish Man, Ashbourne';
UPDATE suppliers SET status = 'not_live' WHERE name = 'Fresh Choice';
UPDATE suppliers SET status = 'not_live' WHERE name = 'Cheddar Gorge';
