-- Fix Alkmonton Dairy image paths (URL-encode spaces and parentheses)
-- Run this in Supabase SQL Editor after the initial import

-- Fix supplier image
UPDATE suppliers 
SET image = '/images/Alkmonton%20Dairy%20Photos/_Supplier%20Profile%20Photo%20%28Herd%29.webp'
WHERE name = 'Alkmonton Dairy';

-- Fix product images
UPDATE products SET image = '/images/Alkmonton%20Dairy%20Photos/Whole%20Milk%20%28500ml%20Glass%20Bottle%29.webp' WHERE name = 'Whole Milk (500ml Glass Bottle)' AND image LIKE '%Alkmonton%';
UPDATE products SET image = '/images/Alkmonton%20Dairy%20Photos/Whole%20Milk%20%281L%20Glass%20Bottle%29.webp' WHERE name = 'Whole Milk (1L Glass Bottle)' AND image LIKE '%Alkmonton%';
UPDATE products SET image = '/images/Alkmonton%20Dairy%20Photos/Semi-Skimmed%20Milk%20%28500ml%20Glass%20Bottle%29.webp' WHERE name = 'Semi-Skimmed Milk (500ml Glass Bottle)' AND image LIKE '%Alkmonton%';
UPDATE products SET image = '/images/Alkmonton%20Dairy%20Photos/Semi-Skimmed%20Milk%20%281L%20Glass%20Bottle%29.webp' WHERE name = 'Semi-Skimmed Milk (1L Glass Bottle)' AND image LIKE '%Alkmonton%';
UPDATE products SET image = '/images/Alkmonton%20Dairy%20Photos/Skimmed%20Milk%20%28500ml%20Glass%20Bottle%29.webp' WHERE name = 'Skimmed Milk (500ml Glass Bottle)' AND image LIKE '%Alkmonton%';
UPDATE products SET image = '/images/Alkmonton%20Dairy%20Photos/Skimmed%20Milk%20%281L%20Glass%20Bottle%29.webp' WHERE name = 'Skimmed Milk (1L Glass Bottle)' AND image LIKE '%Alkmonton%';
UPDATE products SET image = '/images/Alkmonton%20Dairy%20Photos/Double%20Cream%20%28290ml%29.webp' WHERE name = 'Double Cream (290ml)' AND image LIKE '%Alkmonton%';
UPDATE products SET image = '/images/Alkmonton%20Dairy%20Photos/Salted%20Butter%20%28250g%29.webp' WHERE name = 'Salted Butter (250g)' AND image LIKE '%Alkmonton%';
UPDATE products SET image = '/images/Alkmonton%20Dairy%20Photos/Free%20Range%20Eggs%20%28Box%20of%206%29.webp' WHERE name = 'Free Range Eggs (Box of 6)' AND image LIKE '%Alkmonton%';
UPDATE products SET image = '/images/Alkmonton%20Dairy%20Photos/Manor%20Farm%20Thick%20%26%20Creamy%20Live%20Natural%20Yoghurt.webp' WHERE name = 'Manor Farm Thick & Creamy Live Natural Yoghurt' AND image LIKE '%Alkmonton%';
