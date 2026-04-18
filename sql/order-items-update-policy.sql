-- Add UPDATE policy for order_items (missing from original schema)
-- This allows suppliers to update supplier_status on their order items

CREATE POLICY "Allow all updates on order_items" ON order_items FOR UPDATE USING (true);
