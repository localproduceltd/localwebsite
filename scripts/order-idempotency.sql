-- Add stripe_session_id column for idempotency
-- This prevents duplicate orders when the success page is refreshed or retried

ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_session_id text UNIQUE;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session_id ON orders(stripe_session_id);
