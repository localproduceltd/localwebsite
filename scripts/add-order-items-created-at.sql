-- Add created_at column to order_items table
-- This helps track when items were added (especially for top-ups)

ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Backfill existing items with their order's created_at
UPDATE order_items oi
SET created_at = o.created_at
FROM orders o
WHERE oi.order_id = o.id
  AND oi.created_at IS NULL;
