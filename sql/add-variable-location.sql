-- Add variable_location flag to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS variable_location BOOLEAN DEFAULT false;

-- Set existing products without a location to variable_location = true
UPDATE products SET variable_location = true WHERE lat IS NULL OR lng IS NULL;
