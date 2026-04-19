-- Add archived_at column to products table for soft delete
ALTER TABLE products ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Index for efficient filtering of non-archived products
CREATE INDEX IF NOT EXISTS idx_products_archived_at ON products(archived_at);
