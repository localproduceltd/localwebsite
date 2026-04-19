-- Add comment field to ratings table for written reviews
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS comment TEXT;
