-- Migrate supplier statuses to new naming convention
-- Old -> New mapping:
-- live -> launch_live
-- not_live -> launch_not_live
-- pl_live -> development_live
-- pl_coming_soon -> development_coming_soon
-- archived -> archived (no change)

UPDATE suppliers SET status = 'launch_live' WHERE status = 'live';
UPDATE suppliers SET status = 'launch_not_live' WHERE status = 'not_live';
UPDATE suppliers SET status = 'development_live' WHERE status = 'pl_live';
UPDATE suppliers SET status = 'development_coming_soon' WHERE status = 'pl_coming_soon';
-- archived stays the same
