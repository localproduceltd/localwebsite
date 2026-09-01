-- Supplier categories: re-map to the agreed 16 + Other, then lock the column down.
--
-- Background: the app's dropdown only ever offered 10 categories, but
-- `suppliers.category` is free text and the onboarding path writes straight to
-- the database, so 17 different values had accumulated - Bakery/Bread/
-- "Pastries & Cakes" for the same thing, Fishmonger vs "Fish & Seafood",
-- Cheese/"Cheese & Deli"/Deli overlapping, and "Other" quietly grown to 8
-- suppliers. The new list separates growing/rearing/making from selling, which
-- is why Grower is now distinct from Greengrocer.
--
-- Keep in step with src/lib/supplier-categories.ts.

-- 1. Re-map existing rows. Must run before the constraint is added.
update suppliers set category = 'Grower'        where name in ('Wilde & Plenty', 'Pingle Produce', 'Grumpy Farmer');
update suppliers set category = 'Farm'          where name = 'Wyver Meats';
update suppliers set category = 'Dairy'         where name = 'Alkmonton Dairy';
update suppliers set category = 'Beekeeper'     where name = 'Secret Garden Honey';
update suppliers set category = 'Bakery'        where name in ('The LOAF', 'The Bakewell Bakery');
update suppliers set category = 'Cheesemaker'   where name = 'Hartington Creamery';
update suppliers set category = 'Kitchen'       where name in ('Frieda''s Little Kitchen', 'Staffordshire Scotch Eggs');
update suppliers set category = 'Deli'          where name = 'The Cheddar Gorge';
update suppliers set category = 'Fishmonger'    where name = 'The Lucky Catch Fish Market';
update suppliers set category = 'Refill Shop'   where name in ('Eartharmony', 'Natural Choice Health', 'Daisy Hill Refill');
update suppliers set category = 'Florist'       where name in ('The Flower Shop of Ashbourne', 'Gardening Gal');
update suppliers set category = 'Home & Gifts'  where name in ('Becalmed', 'Handmade Design');

-- 2. Backstop. The API validates too, but this catches anything writing directly.
alter table suppliers drop constraint if exists suppliers_category_check;
alter table suppliers add constraint suppliers_category_check check (
  category in (
    'Grower', 'Farm', 'Dairy', 'Beekeeper',
    'Greengrocer', 'Butcher', 'Fishmonger', 'Farm Shop',
    'Bakery', 'Cheesemaker', 'Coffee Roaster', 'Kitchen',
    'Deli', 'Refill Shop',
    'Florist', 'Home & Gifts',
    'Other'
  )
);
