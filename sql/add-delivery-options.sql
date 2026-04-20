-- Add delivery options to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_window TEXT CHECK (delivery_window IN ('morning', 'afternoon'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS will_be_in BOOLEAN DEFAULT true;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS safe_place TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS box_deposit_paid BOOLEAN DEFAULT false;

-- Add outstanding box tracking to customer profiles
ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS has_outstanding_box BOOLEAN DEFAULT false;
