-- Add delivery_option column to orders table
-- Values: 'in', 'in_no_disturb', 'out_need_coolbag', 'out_own_coolbag'

ALTER TABLE orders
ADD COLUMN delivery_option TEXT;

-- Add comment explaining the field
COMMENT ON COLUMN orders.delivery_option IS 'Delivery preference: in (hand to customer), in_no_disturb (leave outside, customer will bring in), out_need_coolbag (leave in our cool box, deposit required), out_own_coolbag (leave in customer cool bag)';

-- Backfill existing orders based on will_be_in field
UPDATE orders
SET delivery_option = CASE
  WHEN will_be_in = true THEN 'in'
  WHEN box_deposit_paid = true THEN 'out_need_coolbag'
  ELSE 'out_own_coolbag'
END
WHERE delivery_option IS NULL;
