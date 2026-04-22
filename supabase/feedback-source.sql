-- Add source and order_number columns to feedback table
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'carrie';
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS order_number INTEGER;
