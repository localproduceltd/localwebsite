-- Add refund reason type and item_arrived columns to order_item_refunds
-- This enables proper payout calculations and better reporting

-- Add reason_type column (structured reason)
ALTER TABLE order_item_refunds 
ADD COLUMN IF NOT EXISTS reason_type TEXT NOT NULL DEFAULT 'other';

-- Add item_arrived column (did the item arrive at depot?)
ALTER TABLE order_item_refunds 
ADD COLUMN IF NOT EXISTS item_arrived BOOLEAN NOT NULL DEFAULT true;

-- Reason types:
-- 'didnt_arrive' - Item never arrived at depot (itemArrived = false)
-- 'quality' - Item arrived but had quality issues (itemArrived = true)
-- 'damaged' - Item arrived but was damaged in transit (itemArrived = true)
-- 'changed_mind' - Customer changed their mind (itemArrived = true)
-- 'other' - Other reason, see refund_reason for details (itemArrived = varies)

-- Update existing refunds: try to infer from refund_reason text
UPDATE order_item_refunds
SET reason_type = 'didnt_arrive', item_arrived = false
WHERE refund_reason ILIKE '%didn''t arrive%' 
   OR refund_reason ILIKE '%did not arrive%'
   OR refund_reason ILIKE '%not arrive%'
   OR refund_reason ILIKE '%missing%';

-- Verify
SELECT id, product_name, refund_reason, reason_type, item_arrived, paid_by
FROM order_item_refunds
ORDER BY refunded_at DESC;
