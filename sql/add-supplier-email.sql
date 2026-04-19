-- Add email field to suppliers table
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS email TEXT;
