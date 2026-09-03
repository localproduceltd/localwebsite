-- Stock mode: Off / Weekly / Overall, chosen per supplier in admin.
--
-- suppliers.stock_mode replaces the on/off stock_tracking switch:
--   'off'     - no stock limits (default; nothing changes for these suppliers)
--   'weekly'  - the existing behaviour: products.weekly_stock is a cap per
--               delivery day, remaining = cap minus what's ordered for that day
--   'overall' - for suppliers who drop stock at the warehouse (Belper Honey):
--               products.weekly_stock is the count on the shelf when the
--               supplier last counted it, products.stock_counted_on is when.
--               Remaining = count minus everything ordered for any delivery
--               day on or after the count date (so orders already placed for
--               a delivery that hasn't gone out yet come off it too), and it
--               rolls over week to week instead of resetting.
-- stock_tracking is kept in sync by the app (true = mode is not 'off') so
-- nothing that still reads it breaks; it can be dropped later.
--
-- As with weekly stock nothing is stored or decremented - remaining is always
-- computed live from orders, so cancellations and refunds free stock again.

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS stock_mode text NOT NULL DEFAULT 'off'
  CHECK (stock_mode IN ('off', 'weekly', 'overall'));
UPDATE suppliers SET stock_mode = 'weekly' WHERE stock_tracking AND stock_mode = 'off';

ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_counted_on date;

-- Units ordered per product for delivery days on or after the product's count
-- date. orders.delivery_day is ISO text (YYYY-MM-DD) so the text comparison
-- orders correctly. Cancelled lines are excluded, same as
-- product_ordered_quantities. Products with no count date have no row.
CREATE OR REPLACE VIEW product_ordered_since_count AS
SELECT
  oi.product_id,
  SUM(oi.quantity)::integer AS quantity_ordered
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN products p ON p.id = oi.product_id
WHERE oi.supplier_status <> 'cancelled'
  AND p.stock_counted_on IS NOT NULL
  AND o.delivery_day >= p.stock_counted_on::text
GROUP BY oi.product_id;

-- Recreate products_with_stats with stock_counted_on appended (new columns
-- must go at the end for CREATE OR REPLACE).
CREATE OR REPLACE VIEW products_with_stats AS
SELECT p.id,
    p.supplier_id,
    p.name,
    p.description,
    p.price,
    p.unit,
    p.image,
    p.category,
    p.in_stock,
    p.created_at,
    p.locality,
    p.lat,
    p.lng,
    p.status,
    p.rejection_reason,
    p.archived_at,
    p.allergens,
    p.tags,
    p.variable_location,
    p.ingredients,
    COALESCE(r.avg_rating, 0::numeric)::numeric(3,2) AS avg_rating,
    COALESCE(r.rating_count, 0::bigint)::integer AS rating_count,
    COALESCE(o.order_count, 0::bigint)::integer AS order_count,
    p.refrigerated,
    p.weekly_stock,
    p.featured_at,
    COALESCE(ro.recent_order_count, 0::bigint)::integer AS recent_order_count,
    COALESCE(rr.recent_rating_count, 0::bigint)::integer AS recent_rating_count,
    p.stock_counted_on
   FROM products p
     LEFT JOIN ( SELECT ratings.product_id,
            avg(ratings.stars) AS avg_rating,
            count(*) AS rating_count
           FROM ratings
          GROUP BY ratings.product_id) r ON r.product_id = p.id
     LEFT JOIN ( SELECT order_items.product_id,
            sum(order_items.quantity) AS order_count
           FROM order_items
          GROUP BY order_items.product_id) o ON o.product_id = p.id
     LEFT JOIN ( SELECT oi.product_id,
            sum(oi.quantity) AS recent_order_count
           FROM order_items oi
             JOIN orders ord ON ord.id = oi.order_id
          WHERE oi.supplier_status <> 'cancelled'
            AND ord.created_at >= now() - interval '14 days'
          GROUP BY oi.product_id) ro ON ro.product_id = p.id
     LEFT JOIN ( SELECT ratings.product_id,
            count(*) AS recent_rating_count
           FROM ratings
          WHERE ratings.created_at >= now() - interval '14 days'
          GROUP BY ratings.product_id) rr ON rr.product_id = p.id;
