-- Drop the legacy 'active' column from suppliers table
-- Supplier visibility is now driven solely by status (launch_live / launch_not_live)
-- Code references have been removed in the same deploy

ALTER TABLE suppliers DROP COLUMN IF EXISTS active;
