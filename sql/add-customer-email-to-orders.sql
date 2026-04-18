-- Add customer_email column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email TEXT;

-- Optional: Update existing orders with email from Clerk (would need to be done manually or via API)
-- For now, existing orders will show the truncated user ID
