-- Backfill all existing orders with test email
UPDATE orders SET customer_email = 'test@localproduce.com' WHERE customer_email IS NULL;
