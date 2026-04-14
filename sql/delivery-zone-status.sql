-- Add zone_status field to delivery_zones table
-- Values: 'live' (delivering now) or 'not_live' (coming on launch_date)

ALTER TABLE delivery_zones 
ADD COLUMN IF NOT EXISTS zone_status TEXT NOT NULL DEFAULT 'live' 
CHECK (zone_status IN ('live', 'not_live'));

-- Add launch_date field for not_live zones (when deliveries will start)
ALTER TABLE delivery_zones 
ADD COLUMN IF NOT EXISTS launch_date DATE;

-- Update existing zones to 'live' (they should already be 'live' by default)
UPDATE delivery_zones SET zone_status = 'live' WHERE zone_status IS NULL;
