-- Add bottle_deposit_paid column to orders table
-- Run this in Supabase SQL Editor

ALTER TABLE orders ADD COLUMN IF NOT EXISTS bottle_deposit_paid BOOLEAN DEFAULT false;
