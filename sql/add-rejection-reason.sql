-- Add rejection_reason column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
