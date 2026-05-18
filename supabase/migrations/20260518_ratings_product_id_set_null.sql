-- Change ratings.product_id foreign key from ON DELETE CASCADE to ON DELETE SET NULL
-- This allows reviews to survive when a product is hard-deleted

-- First, make product_id nullable (required for SET NULL)
ALTER TABLE ratings ALTER COLUMN product_id DROP NOT NULL;

-- Drop the existing foreign key constraint
ALTER TABLE ratings DROP CONSTRAINT IF EXISTS ratings_product_id_fkey;

-- Recreate with ON DELETE SET NULL
ALTER TABLE ratings 
ADD CONSTRAINT ratings_product_id_fkey 
FOREIGN KEY (product_id) 
REFERENCES products(id) 
ON DELETE SET NULL;

-- Add comment for documentation
COMMENT ON COLUMN ratings.product_id IS 'References products table - set to NULL when product is deleted to preserve review history';
