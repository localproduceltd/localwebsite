-- 1. Add supplier_id and supplier_status to order_items
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id),
  ADD COLUMN IF NOT EXISTS supplier_status TEXT NOT NULL DEFAULT 'order_placed';

-- 2. Backfill supplier_id from products for existing order items
UPDATE order_items
SET supplier_id = products.supplier_id
FROM products
WHERE order_items.product_id = products.id
  AND order_items.supplier_id IS NULL;

-- 3. Index for fast supplier order lookups
CREATE INDEX IF NOT EXISTS idx_order_items_supplier_id ON order_items(supplier_id);
