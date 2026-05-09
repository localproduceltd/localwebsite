-- Add paid_by column to order_item_refunds
-- Values: 'local' (Local Produce pays), 'supplier' (Supplier pays), '50-50' (split)

ALTER TABLE order_item_refunds 
ADD COLUMN IF NOT EXISTS paid_by TEXT NOT NULL DEFAULT 'local';

-- Add supplier_id to refunds so we know which supplier to deduct from
ALTER TABLE order_item_refunds 
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id);

-- Verify
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'order_item_refunds';
