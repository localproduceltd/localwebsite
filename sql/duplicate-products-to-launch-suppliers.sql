-- Duplicate products from pre-launch suppliers to their launch counterparts
-- Fresh Choice Ashbourne (pl_live) -> Fresh Choice (live)
-- Cheddar Gorge, Ashbourne (pl_live) -> Cheddar Gorge (live)

-- First, get the supplier IDs (run these SELECT statements first to verify)
-- SELECT id, name, status FROM suppliers WHERE name LIKE '%Fresh Choice%';
-- SELECT id, name, status FROM suppliers WHERE name LIKE '%Cheddar Gorge%';

-- Duplicate products from Fresh Choice Ashbourne to Fresh Choice (live)
INSERT INTO products (supplier_id, name, description, price, unit, image, category, in_stock, locality, lat, lng, status, created_at)
SELECT 
  (SELECT id FROM suppliers WHERE name = 'Fresh Choice' AND status = 'live' LIMIT 1) as supplier_id,
  p.name,
  p.description,
  p.price,
  p.unit,
  p.image,
  p.category,
  p.in_stock,
  p.locality,
  p.lat,
  p.lng,
  p.status,
  NOW()
FROM products p
JOIN suppliers s ON p.supplier_id = s.id
WHERE s.name = 'Fresh Choice Ashbourne' AND s.status = 'pl_live'
AND NOT EXISTS (
  SELECT 1 FROM products p2 
  JOIN suppliers s2 ON p2.supplier_id = s2.id 
  WHERE s2.name = 'Fresh Choice' AND s2.status = 'live' AND p2.name = p.name
);

-- Duplicate products from Cheddar Gorge, Ashbourne to Cheddar Gorge (live)
INSERT INTO products (supplier_id, name, description, price, unit, image, category, in_stock, locality, lat, lng, status, created_at)
SELECT 
  (SELECT id FROM suppliers WHERE name = 'Cheddar Gorge' AND status = 'live' LIMIT 1) as supplier_id,
  p.name,
  p.description,
  p.price,
  p.unit,
  p.image,
  p.category,
  p.in_stock,
  p.locality,
  p.lat,
  p.lng,
  p.status,
  NOW()
FROM products p
JOIN suppliers s ON p.supplier_id = s.id
WHERE s.name = 'Cheddar Gorge, Ashbourne' AND s.status = 'pl_live'
AND NOT EXISTS (
  SELECT 1 FROM products p2 
  JOIN suppliers s2 ON p2.supplier_id = s2.id 
  WHERE s2.name = 'Cheddar Gorge' AND s2.status = 'live' AND p2.name = p.name
);
