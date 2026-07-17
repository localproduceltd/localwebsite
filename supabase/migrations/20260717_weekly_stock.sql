-- Weekly stock limits.
-- suppliers.stock_tracking: admin-only toggle - the whole feature is off for a
-- supplier unless Josie switches it on (default off, nothing changes for anyone).
-- products.weekly_stock: per-item cap for one delivery week; NULL = not tracked.
-- Remaining stock is always computed live as weekly_stock minus what's already
-- ordered for the delivery day (see product_ordered_quantities below) - nothing
-- is stored or decremented, so cancellations free stock automatically and each
-- new delivery day starts from a fresh count with the same cap.

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS stock_tracking boolean NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS weekly_stock integer CHECK (weekly_stock IS NULL OR weekly_stock >= 0);

-- Units ordered per product per delivery day. Cancelled lines are excluded
-- (order-level cancellation cascades supplier_status='cancelled' to its items,
-- and per-item refunds set it directly), so both free the stock back up.
CREATE OR REPLACE VIEW product_ordered_quantities AS
SELECT
  oi.product_id,
  o.delivery_day,
  SUM(oi.quantity)::integer AS quantity_ordered
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
WHERE oi.supplier_status <> 'cancelled'
  AND oi.product_id IS NOT NULL
GROUP BY oi.product_id, o.delivery_day;

-- Recreate products_with_stats with weekly_stock appended (new columns must go
-- at the end for CREATE OR REPLACE).
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
    p.weekly_stock
   FROM products p
     LEFT JOIN ( SELECT ratings.product_id,
            avg(ratings.stars) AS avg_rating,
            count(*) AS rating_count
           FROM ratings
          GROUP BY ratings.product_id) r ON r.product_id = p.id
     LEFT JOIN ( SELECT order_items.product_id,
            sum(order_items.quantity) AS order_count
           FROM order_items
          GROUP BY order_items.product_id) o ON o.product_id = p.id;
