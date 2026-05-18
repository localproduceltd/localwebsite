-- Add holiday fields to suppliers table
-- Allows suppliers to be temporarily marked as "on holiday" while remaining launch_live

ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS on_holiday BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS holiday_until DATE,
ADD COLUMN IF NOT EXISTS holiday_message TEXT;

-- Add comment for documentation
COMMENT ON COLUMN suppliers.on_holiday IS 'When true, supplier is temporarily unavailable for orders (only applies to launch_live suppliers)';
COMMENT ON COLUMN suppliers.holiday_until IS 'Optional return date - supplier auto-returns when this date passes';
COMMENT ON COLUMN suppliers.holiday_message IS 'Optional custom message to display, falls back to default if empty';
