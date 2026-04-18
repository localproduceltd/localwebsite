-- Order Status Cascade Trigger
-- When admin updates order.status, cascade to order_items.supplier_status

-- Drop existing trigger/function if they exist (both naming variants)
DROP TRIGGER IF EXISTS cascade_order_status_trigger ON orders;
DROP TRIGGER IF EXISTS trigger_cascade_order_status ON orders;
DROP FUNCTION IF EXISTS cascade_order_status() CASCADE;

-- Create the cascade function
CREATE OR REPLACE FUNCTION cascade_order_status()
RETURNS TRIGGER AS $$
BEGIN
  -- When order is marked delivered or cancelled, cascade to all order items
  IF NEW.status = 'delivered' THEN
    UPDATE order_items 
    SET supplier_status = 'delivered' 
    WHERE order_id = NEW.id;
  ELSIF NEW.status = 'cancelled' THEN
    UPDATE order_items 
    SET supplier_status = 'cancelled' 
    WHERE order_id = NEW.id;
  ELSIF NEW.status = 'confirmed' AND OLD.status IN ('delivered', 'cancelled') THEN
    -- If reverting from delivered/cancelled back to confirmed, reset to dropped_at_depot
    UPDATE order_items 
    SET supplier_status = 'dropped_at_depot' 
    WHERE order_id = NEW.id;
  ELSIF NEW.status = 'pending' AND OLD.status IN ('confirmed', 'delivered', 'cancelled') THEN
    -- If reverting to pending, reset to order_placed
    UPDATE order_items 
    SET supplier_status = 'order_placed' 
    WHERE order_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER cascade_order_status_trigger
AFTER UPDATE OF status ON orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION cascade_order_status();

-- Fix any existing inconsistencies: if order is delivered/cancelled but items aren't
UPDATE order_items oi
SET supplier_status = o.status
FROM orders o
WHERE oi.order_id = o.id
  AND o.status IN ('delivered', 'cancelled')
  AND oi.supplier_status NOT IN ('delivered', 'cancelled');
