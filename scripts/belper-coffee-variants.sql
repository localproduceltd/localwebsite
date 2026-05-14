-- Belper Coffee: Create Ground and Beans variants for all products
-- This script duplicates each existing Belper Coffee product into Ground and Beans versions
-- and archives the originals (so existing orders still work)
-- Run in Supabase SQL Editor

-- First, let's see what products exist for Belper Coffee (uncomment to check)
-- SELECT p.id, p.name, p.description, p.price, p.unit, p.category, p.locality, p.lat, p.lng, p.variable_location, p.status, p.allergens, p.tags, p.image, p.archived_at
-- FROM products p
-- JOIN suppliers s ON p.supplier_id = s.id
-- WHERE s.name = 'Belper Coffee Co.';

-- Create Ground versions of all active Belper Coffee products
INSERT INTO products (supplier_id, name, description, price, unit, image, category, in_stock, locality, lat, lng, variable_location, status, allergens, tags)
SELECT 
  p.supplier_id,
  p.name || ' (Ground)',
  p.description || ' Ground for filter, cafetière or AeroPress.',
  p.price,
  p.unit,
  p.image,
  p.category,
  p.in_stock,
  p.locality,
  p.lat,
  p.lng,
  p.variable_location,
  p.status,
  p.allergens,
  p.tags
FROM products p
JOIN suppliers s ON p.supplier_id = s.id
WHERE s.name = 'Belper Coffee Co.'
  AND p.archived_at IS NULL
  AND p.name NOT LIKE '%(Ground)%'
  AND p.name NOT LIKE '%(Beans)%';

-- Create Beans versions of all active Belper Coffee products
INSERT INTO products (supplier_id, name, description, price, unit, image, category, in_stock, locality, lat, lng, variable_location, status, allergens, tags)
SELECT 
  p.supplier_id,
  p.name || ' (Beans)',
  p.description || ' Whole beans — grind fresh for maximum flavour.',
  p.price,
  p.unit,
  p.image,
  p.category,
  p.in_stock,
  p.locality,
  p.lat,
  p.lng,
  p.variable_location,
  p.status,
  p.allergens,
  p.tags
FROM products p
JOIN suppliers s ON p.supplier_id = s.id
WHERE s.name = 'Belper Coffee Co.'
  AND p.archived_at IS NULL
  AND p.name NOT LIKE '%(Ground)%'
  AND p.name NOT LIKE '%(Beans)%';

-- Archive the original products (soft delete - keeps them for order history)
UPDATE products
SET archived_at = NOW()
WHERE id IN (
  SELECT p.id
  FROM products p
  JOIN suppliers s ON p.supplier_id = s.id
  WHERE s.name = 'Belper Coffee Co.'
    AND p.archived_at IS NULL
    AND p.name NOT LIKE '%(Ground)%'
    AND p.name NOT LIKE '%(Beans)%'
);

-- Verify the results: Active products
SELECT p.name, p.price, p.unit, p.status, 'ACTIVE' as state
FROM products p
JOIN suppliers s ON p.supplier_id = s.id
WHERE s.name = 'Belper Coffee Co.'
  AND p.archived_at IS NULL
ORDER BY p.name;

-- Verify: Archived products (originals)
SELECT p.name, p.price, p.archived_at, 'ARCHIVED' as state
FROM products p
JOIN suppliers s ON p.supplier_id = s.id
WHERE s.name = 'Belper Coffee Co.'
  AND p.archived_at IS NOT NULL
ORDER BY p.name;
