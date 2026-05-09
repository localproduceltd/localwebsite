-- Add customer_name field to orders table
-- Run this in Supabase SQL Editor

ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name TEXT;

-- Backfill existing orders with name derived from email (before the @)
UPDATE orders 
SET customer_name = INITCAP(SPLIT_PART(customer_email, '@', 1))
WHERE customer_name IS NULL AND customer_email IS NOT NULL;
