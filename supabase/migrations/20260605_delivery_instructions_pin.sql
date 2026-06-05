-- Add delivery instructions and pin coordinates to orders table
-- instructions: free-text field for finding/accessing the address
-- pin_lat/pin_lng: customer-confirmed coordinates (may differ from postcode geocode)

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS instructions text,
ADD COLUMN IF NOT EXISTS pin_lat numeric,
ADD COLUMN IF NOT EXISTS pin_lng numeric;

-- Add comment for documentation
COMMENT ON COLUMN orders.instructions IS 'Optional delivery instructions for finding/accessing the address';
COMMENT ON COLUMN orders.pin_lat IS 'Customer-confirmed latitude (may differ from postcode geocode)';
COMMENT ON COLUMN orders.pin_lng IS 'Customer-confirmed longitude (may differ from postcode geocode)';
