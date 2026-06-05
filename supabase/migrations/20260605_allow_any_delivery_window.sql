-- Allow 'any' ("I don't mind") as a delivery window.
-- The cart now offers an "I don't mind" timing option which submits delivery_window = 'any'.
-- The previous CHECK constraint only permitted 'morning'/'afternoon', so those orders failed to
-- insert *after* Stripe payment - the customer was charged but no order row was created.

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_delivery_window_check;

ALTER TABLE orders ADD CONSTRAINT orders_delivery_window_check
  CHECK (delivery_window = ANY (ARRAY['morning'::text, 'afternoon'::text, 'any'::text]));
